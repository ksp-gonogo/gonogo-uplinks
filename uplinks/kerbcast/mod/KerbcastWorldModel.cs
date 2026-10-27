using System;
using System.Collections.Generic;
using Kerbcast.Api;
using Sitrep.Contract;

namespace Gonogo.KerbcastUplink
{
    /// <summary>
    /// Builds and publishes Gonogo's world model into Kerbcast: which scope each
    /// command feed's site reads, and in each scope every craft that site's
    /// command centre knows of. Main thread only, once per capture tick while
    /// Gonogo holds the lock.
    ///
    /// <para>A feed is bound only when its site resolves to a command centre: a
    /// ground station found by its network node name, or a craft by the id of the
    /// craft its lens rides. Every other feed stays unbound, and Kerbcast reads
    /// every craft as unknown on an unbound feed. A scope is keyed by the centre
    /// id and holds what that centre knows as of the instant its knowledge has
    /// reached the lens.</para>
    ///
    /// <para>Records are <see cref="CraftFixState.Listed"/>: the craft lists, and a
    /// feed may not aim at it. A craft Kerbcast cannot give a persistentId for is
    /// left out, so it reads as unknown.</para>
    /// </summary>
    public sealed class KerbcastWorldModel
    {
        /// <summary>Real seconds between snapshots when nothing has changed, so an accepted publish keeps arriving.</summary>
        public const double RefreshSeconds = 2.0;

        private const string VesselCentrePrefix = "vessel:";

        private readonly CraftLabels _labels;
        private readonly Func<ApiFeature, bool> _supports;
        private readonly List<IdentityEvent> _pending = new List<IdentityEvent>();
        private readonly List<HeardAlias> _aliases = new List<HeardAlias>();
        private readonly HashSet<string> _bound = new HashSet<string>(StringComparer.Ordinal);
        private CraftKnowledgeSample[] _buffer = new CraftKnowledgeSample[64];
        private long _sequence;
        private long _epoch;
        private double? _lastUt;
        private long? _lastVersion;
        private double? _lastPublish;
        private int _lastTenure = -1;
        private string _lastBindings = "";
        private int _aliasVersion;
        private int _lastAliasVersion = -1;
        private long _lastEpoch = -1;

        /// <param name="labels">Craft names and kinds, fed on the main thread.</param>
        /// <param name="supports">Which API features this Kerbcast implements, normally <see cref="KerbcastApi.Supports"/>.</param>
        public KerbcastWorldModel(CraftLabels labels, Func<ApiFeature, bool> supports)
        {
            _labels = labels;
            _supports = supports;
        }

        /// <summary>The epoch of the timeline the model describes, raised when game time goes backwards and on every game load.</summary>
        public long Epoch => _epoch;

        /// <summary>
        /// A game state was loaded: Kerbcast holds the model invalid until a
        /// snapshot under a newer epoch, and nothing the old timeline merged
        /// carries over.
        /// </summary>
        public void OnGameLoaded()
        {
            _epoch++;
            _pending.Clear();
            _aliases.Clear();
            _aliasVersion++;
            _lastUt = null;
        }

        /// <summary>
        /// Takes one of Kerbcast's identity events. A renumbered craft is aliased at
        /// once, since it is the same craft under a new id. A merge is aliased once
        /// every scope that lists the merged craft has heard from the craft it joined
        /// after the merge, and a split undoes the merged craft's alias once every
        /// scope that lists the craft it left has heard from it after the split.
        /// </summary>
        public void OnIdentity(IdentityEvent? change)
        {
            if (change == null)
            {
                return;
            }
            switch (change.Change)
            {
                case IdentityChange.Renumber:
                    _labels.Renumber(change.PersistentId, change.OtherPersistentId);
                    TryAlias(change.PersistentId, change.OtherPersistentId, change.Ut);
                    break;
                case IdentityChange.Merge:
                case IdentityChange.Split:
                    _pending.Add(change);
                    break;
            }
        }

        /// <summary>
        /// Publishes a snapshot when anything it describes may have changed, and at
        /// least every <see cref="RefreshSeconds"/>. Returns Kerbcast's answer, or
        /// null when nothing was due or the snapshot could not be built.
        /// </summary>
        /// <param name="kerbcast">Kerbcast in this scene.</param>
        /// <param name="publisher">The publisher for this lock tenure.</param>
        /// <param name="tenure">The lock tenure the publisher belongs to, as <see cref="KerbcastAuthority.Tenure"/> counts it.</param>
        /// <param name="sites">Gonogo's lens sites, or null when the capability is missing.</param>
        /// <param name="knowledge">Gonogo's craft knowledge, or null when the capability is missing.</param>
        /// <param name="nowUt">Game time now.</param>
        /// <param name="realSeconds">A monotonic real-time clock in seconds.</param>
        public PublishResult? Publish(
            IKerbcast kerbcast,
            IWorldModelPublisher publisher,
            int tenure,
            ILensSites? sites,
            IBulkCraftKnowledge? knowledge,
            double nowUt,
            double realSeconds)
        {
            if (_lastUt.HasValue && nowUt < _lastUt.Value)
            {
                _epoch++;
                _pending.RemoveAll(m => m.Ut > nowUt);
                if (_aliases.RemoveAll(a => a.Ut > nowUt) > 0)
                {
                    _aliasVersion++;
                }
            }
            _lastUt = nowUt;

            var bindings = Bindings(kerbcast, sites);
            SyncLensSites(sites, bindings);

            var scopes = new List<string>();
            foreach (var scope in bindings.Values)
            {
                if (!scopes.Contains(scope))
                {
                    scopes.Add(scope);
                }
            }
            scopes.Sort(StringComparer.Ordinal);

            var identity = _supports(ApiFeature.CraftIdentity);
            var heard = new Dictionary<string, Dictionary<uint, double?>>(StringComparer.Ordinal);
            var listed = new Dictionary<string, List<uint>>(StringComparer.Ordinal);
            var scopeUt = new Dictionary<string, double>(StringComparer.Ordinal);
            long? version = null;
            foreach (var scope in scopes)
            {
                var ut = sites?.KnowledgeUt(scope);
                var crafts = new List<uint>();
                var lastHeard = new Dictionary<uint, double?>();
                if (ut.HasValue && knowledge != null)
                {
                    scopeUt[scope] = ut.Value;
                    var count = Read(knowledge, scope, ut.Value, out var read);
                    version = version.HasValue ? Math.Max(version.Value, read) : read;
                    for (var i = 0; i < count; i++)
                    {
                        var sample = _buffer[i];
                        if (sample.State == CraftKnowledgeState.Unknown || !identity
                            || !Guid.TryParse(sample.VesselId, out var vesselId)
                            || !kerbcast.Cameras.TryPersistentId(vesselId, out var pid))
                        {
                            continue;
                        }
                        crafts.Add(pid);
                        lastHeard[pid] = sample.LastKnownUt;
                    }
                }
                listed[scope] = crafts;
                heard[scope] = lastHeard;
            }

            ApplyHeardChanges(listed, heard);

            var bindingKey = BindingKey(bindings);
            var due = tenure != _lastTenure
                || _epoch != _lastEpoch
                || version != _lastVersion
                || bindingKey != _lastBindings
                || _aliasVersion != _lastAliasVersion
                || !_lastPublish.HasValue
                || realSeconds - _lastPublish.Value >= RefreshSeconds;
            if (!due)
            {
                return null;
            }

            var knowledgeUt = nowUt;
            foreach (var ut in scopeUt.Values)
            {
                knowledgeUt = Math.Min(knowledgeUt, ut);
            }

            var builder = publisher.Begin(++_sequence, _epoch, knowledgeUt);
            PublishResult result;
            var sent = false;
            try
            {
                Fill(builder, bindings, scopes, listed);
                sent = true;
                result = publisher.Publish(builder, out _);
            }
            catch (Exception)
            {
                /* The real store pools builder storage, and a builder neither published nor abandoned never returns it. */
                if (!sent)
                {
                    publisher.Abandon(builder);
                }
                return null;
            }

            _lastTenure = tenure;
            _lastEpoch = _epoch;
            _lastVersion = version;
            _lastBindings = bindingKey;
            _lastAliasVersion = _aliasVersion;
            _lastPublish = realSeconds;
            return result;
        }

        private void Fill(
            WorldModelBuilder builder,
            Dictionary<string, string> bindings,
            List<string> scopes,
            Dictionary<string, List<uint>> listed)
        {
            foreach (var binding in bindings)
            {
                builder.BindSite(binding.Key, binding.Value);
            }
            foreach (var alias in _aliases)
            {
                builder.Alias(alias.From, alias.To);
            }
            foreach (var scope in scopes)
            {
                builder.Scope(scope);
                foreach (var pid in listed[scope])
                {
                    builder.Listed(pid);
                    if (_labels.TryLabel(pid, out var label))
                    {
                        if (label.Name != null)
                        {
                            builder.Name(label.Name);
                        }
                        if (label.Kind != null)
                        {
                            builder.Kind(label.Kind);
                        }
                    }
                }
            }
        }

        /// <summary>Each command feed's site key, mapped to the scope of the centre at that site; unresolved sites are left out.</summary>
        private Dictionary<string, string> Bindings(IKerbcast kerbcast, ILensSites? sites)
        {
            var bindings = new Dictionary<string, string>(StringComparer.Ordinal);
            if (!_supports(ApiFeature.CommandFeeds))
            {
                return bindings;
            }
            foreach (var feed in kerbcast.Command.Feeds())
            {
                if (feed == null || string.IsNullOrEmpty(feed.SiteKey) || bindings.ContainsKey(feed.SiteKey))
                {
                    continue;
                }
                var centre = CentreAt(kerbcast, sites, feed);
                if (centre != null)
                {
                    bindings[feed.SiteKey] = centre;
                }
            }
            return bindings;
        }

        private string? CentreAt(IKerbcast kerbcast, ILensSites? sites, CommandFeed feed)
        {
            switch (feed.SiteKind)
            {
                case SiteKind.Station:
                case SiteKind.LaunchSite:
                    return sites?.GroundStationNamed(feed.SiteKey);
                case SiteKind.Vessel:
                    if (feed.VantagePersistentId == 0 || !_supports(ApiFeature.CraftIdentity)
                        || !kerbcast.Cameras.TryVessel(feed.VantagePersistentId, out var vesselId)
                        || vesselId == Guid.Empty)
                    {
                        return null;
                    }
                    return VesselCentrePrefix + vesselId;
                default:
                    return null;
            }
        }

        /* A bound site is commanded by the centre standing at it, so its knowledge reaches the lens at once. */
        private void SyncLensSites(ILensSites? sites, Dictionary<string, string> bindings)
        {
            if (sites == null)
            {
                return;
            }
            var wanted = new HashSet<string>(bindings.Values, StringComparer.Ordinal);
            foreach (var centre in wanted)
            {
                if (_bound.Add(centre))
                {
                    sites.Bind(centre, centre, centre);
                }
            }
            _bound.RemoveWhere(centre =>
            {
                if (wanted.Contains(centre))
                {
                    return false;
                }
                sites.Unbind(centre, centre);
                return true;
            });
        }

        private int Read(IBulkCraftKnowledge knowledge, string centre, double ut, out long version)
        {
            var count = knowledge.ReadCentre(centre, ut, _buffer, out version);
            if (count > _buffer.Length)
            {
                _buffer = new CraftKnowledgeSample[count * 2];
                count = knowledge.ReadCentre(centre, ut, _buffer, out version);
            }
            return Math.Min(count, _buffer.Length);
        }

        /*
         * A merged craft falls silent at the merge, so the craft it joined is the one
         * whose later word tells a centre of the dock; a split is told by the craft
         * that left. An alias is snapshot-wide, so each change waits for the last scope
         * that lists the craft it concerns to hear of it: until then a scope that
         * already knows keeps the old picture, which tells it less than it knows and
         * never more. Changes apply in the order they happened, so an undock is never
         * taken before the dock it undoes.
         */
        private void ApplyHeardChanges(Dictionary<string, List<uint>> listed, Dictionary<string, Dictionary<uint, double?>> heard)
        {
            if (listed.Count == 0)
            {
                return;
            }
            while (_pending.Count > 0)
            {
                var change = _pending[0];
                var concerns = change.Change == IdentityChange.Merge ? change.PersistentId : change.OtherPersistentId;
                var teller = change.Change == IdentityChange.Merge ? change.OtherPersistentId : change.PersistentId;
                foreach (var scope in listed)
                {
                    if (!scope.Value.Contains(concerns))
                    {
                        continue;
                    }
                    if (!heard[scope.Key].TryGetValue(teller, out var lastHeard)
                        || !lastHeard.HasValue
                        || lastHeard.Value < change.Ut)
                    {
                        return;
                    }
                }
                _pending.RemoveAt(0);
                if (change.Change == IdentityChange.Merge)
                {
                    TryAlias(change.PersistentId, change.OtherPersistentId, change.Ut);
                }
                else if (_aliases.RemoveAll(a => a.From == change.PersistentId) > 0)
                {
                    _aliasVersion++;
                }
            }
        }

        /*
         * Kerbcast refuses the whole snapshot for one alias that names a craft twice or
         * closes a loop, which would fail every feed closed until the lock is released.
         * Such an alias describes an identity history the model cannot hold, so it is
         * left out and the two craft stay apart.
         */
        private bool TryAlias(uint from, uint to, double ut)
        {
            if (from == 0 || to == 0 || from == to)
            {
                return false;
            }
            foreach (var alias in _aliases)
            {
                if (alias.From == from)
                {
                    return false;
                }
            }
            for (var at = to; ;)
            {
                var next = 0u;
                foreach (var alias in _aliases)
                {
                    if (alias.From == at)
                    {
                        next = alias.To;
                        break;
                    }
                }
                if (next == 0)
                {
                    break;
                }
                if (next == from)
                {
                    return false;
                }
                at = next;
            }
            _aliases.Add(new HeardAlias(from, to, ut));
            _aliasVersion++;
            return true;
        }

        private readonly struct HeardAlias
        {
            public HeardAlias(uint from, uint to, double ut)
            {
                From = from;
                To = to;
                Ut = ut;
            }

            public uint From { get; }

            public uint To { get; }

            /// <summary>Game time of the identity change, so a rewind past it drops the alias.</summary>
            public double Ut { get; }
        }

        private static string BindingKey(Dictionary<string, string> bindings)
        {
            var keys = new List<string>(bindings.Count);
            foreach (var binding in bindings)
            {
                keys.Add(binding.Key + "=" + binding.Value);
            }
            keys.Sort(StringComparer.Ordinal);
            return string.Join("|", keys);
        }
    }
}
