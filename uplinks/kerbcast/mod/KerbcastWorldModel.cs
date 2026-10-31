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
    /// <para>A craft a centre hears or sees, or carries forward on a course it was
    /// holding, is positioned where the game had it when the centre last knew it, with
    /// the centre's uncertainty, so a feed aims at that place. A craft held with
    /// nothing to carry it forward, or one whose place or uncertainty is not known,
    /// is <see cref="CraftFixState.Listed"/>: it lists, and a feed may not aim at it.
    /// A craft Kerbcast cannot give a persistentId for is left out, so it reads as
    /// unknown.</para>
    /// </summary>
    public sealed class KerbcastWorldModel
    {
        /// <summary>Real seconds between snapshots when nothing has changed, so an accepted publish keeps arriving.</summary>
        public const double RefreshSeconds = 2.0;

        private const string VesselCentrePrefix = "vessel:";

        /// <summary>How long a positioned record stands, measured from the instant it describes; each snapshot replaces the last long before this.</summary>
        private const double RecordValiditySeconds = 1e9;

        /// <summary>How far past the instant read a predicted place is read again, to give the craft the velocity its prediction implies.</summary>
        private const double VelocitySpanSeconds = 1.0;


        private readonly CraftLabels _labels;
        private readonly CraftPlaces _places;
        private readonly Func<ApiFeature, bool> _supports;
        private readonly Action<string>? _log;
        private readonly Action<IReadOnlyDictionary<string, string>>? _onFeedSites;
        private readonly Func<string, LaunchSiteReading>? _launchSite;
        private readonly Func<uint?>? _activeCraft;
        private readonly Func<int, double?>? _bodyMu;
        private readonly Dictionary<uint, uint> _followed = new Dictionary<uint, uint>();
        private int _followTenure = -1;
        private readonly Dictionary<string, string> _logged = new Dictionary<string, string>(StringComparer.Ordinal);
        private readonly Dictionary<string, double> _recordRadius = new Dictionary<string, double>(StringComparer.Ordinal);
        private readonly List<IdentityEvent> _pending = new List<IdentityEvent>();
        private readonly List<HeardAlias> _aliases = new List<HeardAlias>();
        private readonly HashSet<string> _bound = new HashSet<string>(StringComparer.Ordinal);
        private CraftKnowledgeSample[] _buffer = new CraftKnowledgeSample[64];
        private CraftKnowledgeSample[] _ahead = new CraftKnowledgeSample[64];
        private CraftKnowledgeSample[] _mid = new CraftKnowledgeSample[64];
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
        /// <param name="places">Where each craft was, fed on the main thread; null positions nothing.</param>
        /// <param name="log">Receives one line each time a craft's place or radius in a scope changes; null logs nothing.</param>
        /// <param name="bodyMu">A body's gravitational parameter by index, which is what Kerbcast moves a record's craft by between snapshots; null leaves the velocity as the place implies it.</param>
        /// <param name="onFeedSites">Receives, on every publish and on a game load, each command feed's camera id in decimal mapped to the command centre its lens stands at; null reports nothing.</param>
        public KerbcastWorldModel(CraftLabels labels, Func<ApiFeature, bool> supports, CraftPlaces? places = null, Action<string>? log = null, Action<IReadOnlyDictionary<string, string>>? onFeedSites = null, Func<string, LaunchSiteReading>? launchSite = null, Func<uint?>? activeCraft = null, Func<int, double?>? bodyMu = null)
        {
            _bodyMu = bodyMu;
            _log = log;
            _onFeedSites = onFeedSites;
            _launchSite = launchSite;
            _activeCraft = activeCraft;
            _labels = labels;
            _places = places ?? new CraftPlaces();
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
            _places.Clear();
            _logged.Clear();
            _recordRadius.Clear();
            _onFeedSites?.Invoke(new Dictionary<string, string>());
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
                _places.DropAfter(nowUt);
                _pending.RemoveAll(m => m.Ut > nowUt);
                if (_aliases.RemoveAll(a => a.Ut > nowUt) > 0)
                {
                    _aliasVersion++;
                }
            }
            _lastUt = nowUt;

            var bindings = Bindings(kerbcast, sites, out var feedSites);
            _onFeedSites?.Invoke(feedSites);
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
            var listed = new Dictionary<string, List<ScopeCraft>>(StringComparer.Ordinal);
            var scopeUt = new Dictionary<string, double>(StringComparer.Ordinal);
            long? version = null;
            foreach (var scope in scopes)
            {
                var ut = sites?.KnowledgeUt(scope);
                var crafts = new List<ScopeCraft>();
                var lastHeard = new Dictionary<uint, double?>();
                if (ut.HasValue && knowledge != null)
                {
                    scopeUt[scope] = ut.Value;
                    var count = Read(knowledge, scope, ut.Value, out var read);
                    version = version.HasValue ? Math.Max(version.Value, read) : read;
                    var aheadCount = 0;
                    var midCount = 0;
                    var aheadVersion = read;
                    for (var i = 0; i < count && aheadCount == 0; i++)
                    {
                        if (_buffer[i].State != CraftKnowledgeState.Unknown && (_buffer[i].Place != null || _buffer[i].UncertaintyM.HasValue))
                        {
                            aheadCount = Read(knowledge, scope, ut.Value + VelocitySpanSeconds, ref _ahead, out aheadVersion);
                            midCount = Read(knowledge, scope, ut.Value + VelocitySpanSeconds / 2.0, ref _mid, out _);
                        }
                    }
                    for (var i = 0; i < count; i++)
                    {
                        var sample = _buffer[i];
                        if (sample.State == CraftKnowledgeState.Unknown || !identity
                            || !Guid.TryParse(sample.VesselId, out var vesselId)
                            || !kerbcast.Cameras.TryPersistentId(vesselId, out var pid))
                        {
                            continue;
                        }
                        crafts.Add(new ScopeCraft(pid, vesselId, sample, ut.Value, AheadOf(sample, aheadCount, _ahead), read, aheadVersion, AheadOf(sample, midCount, _mid)));
                        lastHeard[pid] = sample.LastKnownUt;
                    }
                }
                listed[scope] = crafts;
                heard[scope] = lastHeard;
            }

            ApplyHeardChanges(listed, heard);
            Follow(kerbcast, tenure, feedSites, listed);

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
            LogEligibility(kerbcast);
            return result;
        }

        /*
         * Each command feed follows the active craft while the centre at its site has
         * heard from it and Kerbcast judges it in view for that feed. The aim is sent
         * only when the subject changes, and again after a new lock tenure, since a new
         * tenure starts from Kerbcast's own default. A craft still heard whose view
         * Kerbcast judges too uncertain for now stays the subject, so its return to
         * view sends no aim and leaves the framing as it was. When the craft stops
         * qualifying otherwise the feed is left to Kerbcast, which shows its own waiting view for a subject it
         * cannot watch; the API has no call that clears an aim.
         */
        private void Follow(IKerbcast kerbcast, int tenure, Dictionary<string, string> feedSites, Dictionary<string, List<ScopeCraft>> listed)
        {
            if (_activeCraft == null || !_supports(ApiFeature.CommandFeeds))
            {
                return;
            }
            if (tenure != _followTenure)
            {
                _followed.Clear();
                _followTenure = tenure;
            }
            var active = _activeCraft();
            foreach (var feed in kerbcast.Command.Feeds())
            {
                if (feed == null)
                {
                    continue;
                }
                var subject = active.HasValue && Qualifies(kerbcast, feed, active.Value, feedSites, listed) ? active.Value : 0u;
                if (subject == 0u && active.HasValue && _followed.TryGetValue(feed.FlightId, out var aimed) && aimed == active.Value && IsHeard(feed, active.Value, feedSites, listed))
                {
                    continue;
                }
                if (subject == 0u)
                {
                    _followed.Remove(feed.FlightId);
                    LogFollow(feed.FlightId, "none");
                    continue;
                }
                if (_followed.TryGetValue(feed.FlightId, out var sent) && sent == subject)
                {
                    continue;
                }
                _followed[feed.FlightId] = subject;
                var result = kerbcast.Command.SetAim(feed.FlightId, Aim.Vessel(subject, 0.0, false), KerbcastAuthority.Owner);
                LogFollow(feed.FlightId, subject + " result=" + result);
            }
        }

        private static bool IsHeard(CommandFeed feed, uint craft, Dictionary<string, string> feedSites, Dictionary<string, List<ScopeCraft>> listed)
        {
            if (!feedSites.TryGetValue(KerbcastLensSites.KeyFor(feed.FlightId), out var scope) || !listed.TryGetValue(scope, out var crafts))
            {
                return false;
            }
            foreach (var candidate in crafts)
            {
                if (candidate.PersistentId == craft && candidate.Sample.State == CraftKnowledgeState.Heard)
                {
                    return true;
                }
            }
            return false;
        }

        private static bool Qualifies(IKerbcast kerbcast, CommandFeed feed, uint craft, Dictionary<string, string> feedSites, Dictionary<string, List<ScopeCraft>> listed)
        {
            if (!IsHeard(feed, craft, feedSites, listed))
            {
                return false;
            }
            foreach (var target in kerbcast.Command.Targets(feed.FlightId))
            {
                if (target.PersistentId == craft)
                {
                    return string.Equals(target.Eligibility, "ok", StringComparison.OrdinalIgnoreCase);
                }
            }
            return false;
        }

        private void LogFollow(uint feedFlightId, string detail)
        {
            if (_log == null)
            {
                return;
            }
            var key = "follow" + feedFlightId;
            if (_logged.TryGetValue(key, out var last) && last == detail)
            {
                return;
            }
            _logged[key] = detail;
            _log("[Kerbcast][WORLD] follow feed=" + feedFlightId + " subject=" + detail);
        }

        private void Fill(
            WorldModelBuilder builder,
            Dictionary<string, string> bindings,
            List<string> scopes,
            Dictionary<string, List<ScopeCraft>> listed)
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
                foreach (var craft in listed[scope])
                {
                    var pid = craft.PersistentId;
                    Describe(builder, scope, craft);
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

        /*
         * A craft the centre has a predicted place for is aimed at that place, at the
         * instant the scope's knowledge has reached, with the radius the centre gives.
         * Any other heard, seen or modelled craft is placed where the game had it when
         * the centre last knew it, and its radius is the whole of the uncertainty at
         * that instant, so it does not grow here. A held craft has nothing to carry it
         * forward, and a craft with no place on record that early, or whose uncertainty
         * cannot be bounded, has nothing to aim at: those list.
         */
        private void Describe(WorldModelBuilder builder, string scope, ScopeCraft craft)
        {
            var sample = craft.Sample;
            var pid = craft.PersistentId;
            if (sample.State != CraftKnowledgeState.Held && sample.UncertaintyM.HasValue && sample.Place != null)
            {
                DescribePredicted(builder, scope, craft, sample.Place, sample.UncertaintyM.Value);
                return;
            }
            if (sample.State == CraftKnowledgeState.Held
                || !sample.LastKnownUt.HasValue
                || !sample.UncertaintyM.HasValue
                || !_places.TryAt(craft.VesselId, sample.LastKnownUt.Value, out var place))
            {
                builder.Listed(pid);
                Log(scope, craft, "listed", null);
                return;
            }
            var from = place.Ut;
            var until = place.Ut + RecordValiditySeconds;
            if (place.OnSurface)
            {
                builder.Surface(pid, place.BodyIndex, place.Latitude, place.Longitude, place.Altitude, from, until);
            }
            else
            {
                builder.StateVector(pid, place.BodyIndex, place.Ut, new Vec3d(place.State6[0], place.State6[1], place.State6[2]), new Vec3d(place.State6[3], place.State6[4], place.State6[5]), from, until);
            }
            var publishedM = EndOfLifeRadius(craft, sample.UncertaintyM.Value);
            builder.Uncertainty(publishedM, 0.0, 0.0, 0.0);
            SayExtent(builder, craft);
            LogRecord(scope, craft, from, publishedM, sample.UncertaintyM.Value);
            Log(scope, craft, "positioned", sample.UncertaintyM.Value);
        }

        /*
         * Kerbcast carries a record's craft on from its instant under the body's gravity
         * and nothing else, so for a craft the centre reckons under any other
         * acceleration (drag holding it at terminal speed, an engine) it falls away from
         * the reckoned path as half the difference times the time squared. The velocity
         * is therefore given so that Kerbcast's path and the reckoned one meet at the
         * start of the record and again at the end of the span a record stands for, which
         * leaves a quarter of the error the other way about at most in the middle. The
         * reckoned path is read at the start, half way and the end of the span, so the
         * acceleration it carries is known and not assumed. With no body to take gravity
         * from, or a read missing, the velocity is the place's own motion over the span.
         */
        private void DescribePredicted(WorldModelBuilder builder, string scope, ScopeCraft craft, Sitrep.Contract.CraftPlace place, double radiusM)
        {
            var position = place.Position;
            var ahead = craft.Ahead;
            var velocity = ahead == null
                ? new Vec3d(0.0, 0.0, 0.0)
                : new Vec3d(
                    (ahead.Position.X - position.X) / VelocitySpanSeconds,
                    (ahead.Position.Y - position.Y) / VelocitySpanSeconds,
                    (ahead.Position.Z - position.Z) / VelocitySpanSeconds);
            var residualM = 0.0;
            if (ahead != null && craft.MidSample?.Place is { } mid && mid.BodyIndex == place.BodyIndex && _bodyMu?.Invoke(place.BodyIndex) is double mu && mu > 0.0)
            {
                var half = VelocitySpanSeconds / 2.0;
                var r = position.Magnitude();
                var axes = new[] { position.X, position.Y, position.Z };
                var midAxes = new[] { mid.Position.X, mid.Position.Y, mid.Position.Z };
                var endAxes = new[] { ahead.Position.X, ahead.Position.Y, ahead.Position.Z };
                var published = new double[3];
                var squared = 0.0;
                for (var i = 0; i < 3; i++)
                {
                    // Position at 0, half and 1 times the span: velocity at the start and the acceleration it carries.
                    var v0 = (-3.0 * axes[i] + 4.0 * midAxes[i] - endAxes[i]) / (2.0 * half);
                    var a = (axes[i] - 2.0 * midAxes[i] + endAxes[i]) / (half * half);
                    var g = -mu * axes[i] / (r * r * r);
                    var gap = g - a;
                    published[i] = v0 - 0.5 * gap * VelocitySpanSeconds;
                    squared += gap * gap;
                }
                velocity = new Vec3d(published[0], published[1], published[2]);
                residualM = Math.Sqrt(squared) * VelocitySpanSeconds * VelocitySpanSeconds / 8.0;
            }
            var ut = craft.Ut;
            builder.StateVector(craft.PersistentId, place.BodyIndex, ut, new Vec3d(position.X, position.Y, position.Z), velocity, ut, ut + RecordValiditySeconds);
            var publishedM = EndOfLifeRadius(craft, radiusM) + residualM;
            builder.Uncertainty(publishedM, 0.0, 0.0, 0.0);
            SayExtent(builder, craft);
            LogRecord(scope, craft, ut, publishedM, radiusM);
            Log(scope, craft, place.Basis.ToString().ToLowerInvariant(), radiusM);
        }

        /* What Kerbcast then says each command feed may watch, once per craft per feed and again only when its answer changes. */
        private void LogEligibility(IKerbcast kerbcast)
        {
            if (_log == null || !_supports(ApiFeature.CommandFeeds))
            {
                return;
            }
            foreach (var feed in kerbcast.Command.Feeds())
            {
                if (feed == null)
                {
                    continue;
                }
                foreach (var target in kerbcast.Command.Targets(feed.FlightId))
                {
                    var detail = "eligibility=" + target.Eligibility + " rangeM=" + (double.IsNaN(target.RangeM) ? "none" : Math.Round(target.RangeM).ToString(System.Globalization.CultureInfo.InvariantCulture));
                    var key = "feed" + feed.FlightId + "|" + target.PersistentId;
                    if (_logged.TryGetValue(key, out var last) && last == detail)
                    {
                        continue;
                    }
                    _logged[key] = detail;
                    _log("[Kerbcast][WORLD] feed=" + feed.FlightId + " craft=" + target.PersistentId + " " + detail);
                }
            }
        }

        /*
         * The craft's own size, as the centre last heard it and with the canopy of a
         * parachute that is open, goes in the record's radius; Kerbcast frames that plus
         * the uncertainty and takes a nominal radius for a record that gives none, so a
         * craft whose size was not heard is left to it.
         */
        private static void SayExtent(WorldModelBuilder builder, ScopeCraft craft)
        {
            if (craft.Sample.ExtentM is double extent && extent > 0.0 && !double.IsInfinity(extent))
            {
                builder.Radius(extent);
            }
        }

        /*
         * A record is replaced by the next snapshot, one VelocitySpanSeconds on, and
         * Kerbcast holds its radius until then, so the radius is the bound at the end
         * of that span, read from the same craft a moment later, and never less than
         * the bound now. The bound grows with the age of the capture, and a record
         * made when the capture is already a second old is replaced by one made at the
         * same age, so a radius that grew across each record would widen and fall back
         * once a second; the bound at the end of the span holds the craft from the
         * start of the record to its replacement. A capture that is late is read at its
         * true age each time, so the radius keeps following it.
         */
        private static double EndOfLifeRadius(ScopeCraft craft, double radiusAtUt)
        {
            var later = craft.AheadSample;
            return later.HasValue && later.Value.UncertaintyM.HasValue && later.Value.UncertaintyM.Value > radiusAtUt
                ? later.Value.UncertaintyM.Value
                : radiusAtUt;
        }

        /*
         * What each positioned record says about its uncertainty, for finding where a
         * framing radius steps. Written when the radius moves by more than five percent
         * since the last line for the craft, and whenever the read a moment later came
         * from a different capture than the first, which would put two captures into one
         * record.
         */
        private void LogRecord(string scope, ScopeCraft craft, double validFromUt, double radiusM, double radiusAtUt)
        {
            if (_log == null)
            {
                return;
            }
            var sample = craft.Sample;
            var aheadKnown = craft.AheadSample?.LastKnownUt;
            var mixed = craft.AheadSample.HasValue && aheadKnown != sample.LastKnownUt;
            var key = scope + "|" + craft.PersistentId;
            var moved = !_recordRadius.TryGetValue(key, out var last) || Math.Abs(radiusAtUt - last) > 0.05 * Math.Max(Math.Abs(last), 1.0);
            if (!moved && !mixed)
            {
                return;
            }
            _recordRadius[key] = radiusAtUt;
            _log("[Kerbcast][RECORD] centre=" + scope + " craft=" + craft.PersistentId
                + " ut=" + Num(craft.Ut) + " from=" + Num(validFromUt) + " radiusM=" + Num(radiusM) + " radiusAtUt=" + Num(radiusAtUt) + " extentM=" + Num(craft.Sample.ExtentM)
                + " lastKnownUt=" + Num(sample.LastKnownUt) + " aheadLastKnownUt=" + Num(aheadKnown)
                + " version=" + craft.ReadVersion + " aheadVersion=" + craft.AheadVersion + (mixed ? " mixed=true" : ""));
        }

        private static string Num(double? value) =>
            value.HasValue ? Math.Round(value.Value, 3).ToString(System.Globalization.CultureInfo.InvariantCulture) : "none";

        /* One line per craft per scope, repeated only when what it says changes, so a steady craft does not fill the log every snapshot. */
        private void Log(string scope, ScopeCraft craft, string fix, double? radiusM)
        {
            if (_log == null)
            {
                return;
            }
            var detail = fix + " state=" + craft.Sample.State + (radiusM.HasValue ? " radiusM=" + Math.Round(radiusM.Value).ToString(System.Globalization.CultureInfo.InvariantCulture) : "");
            var key = scope + "|" + craft.PersistentId;
            if (_logged.TryGetValue(key, out var last) && last == detail)
            {
                return;
            }
            _logged[key] = detail;
            _log("[Kerbcast][WORLD] scope=" + scope + " craft=" + craft.PersistentId + " " + detail);
        }

        private readonly struct ScopeCraft
        {
            public ScopeCraft(uint persistentId, Guid vesselId, CraftKnowledgeSample sample, double ut, CraftKnowledgeSample? aheadSample, long readVersion, long aheadVersion, CraftKnowledgeSample? midSample)
            {
                MidSample = midSample;
                PersistentId = persistentId;
                VesselId = vesselId;
                Sample = sample;
                Ut = ut;
                AheadSample = aheadSample;
                ReadVersion = readVersion;
                AheadVersion = aheadVersion;
            }

            public uint PersistentId { get; }

            public Guid VesselId { get; }

            public CraftKnowledgeSample Sample { get; }

            /// <summary>The instant the scope's knowledge was read at.</summary>
            public double Ut { get; }

            /// <summary>The craft as the centre reads it a moment after <see cref="Ut"/>, for its velocity and the way its uncertainty is growing; null when that read does not list it.</summary>
            public CraftKnowledgeSample? AheadSample { get; }

            /// <summary>The craft as the centre reads it half the span after <see cref="Ut"/>, which with the two reads either side gives its acceleration; null when that read does not list it.</summary>
            public CraftKnowledgeSample? MidSample { get; }

            /// <summary>The knowledge board version of the read at <see cref="Ut"/>.</summary>
            public long ReadVersion { get; }

            /// <summary>The knowledge board version of the read a moment after <see cref="Ut"/>.</summary>
            public long AheadVersion { get; }

            /// <summary>The craft's predicted place a moment after <see cref="Ut"/>, for its velocity; null when it has none there or was not placed.</summary>
            public Sitrep.Contract.CraftPlace? Ahead =>
                Sample.Place != null && AheadSample?.Place is { } later && later.BodyIndex == Sample.Place.BodyIndex ? later : null;
        }

        /// <summary>Each command feed's site key, mapped to the scope of the centre at that site; unresolved sites are left out.</summary>
        private Dictionary<string, string> Bindings(IKerbcast kerbcast, ILensSites? sites, out Dictionary<string, string> feedSites)
        {
            var bindings = new Dictionary<string, string>(StringComparer.Ordinal);
            feedSites = new Dictionary<string, string>(StringComparer.Ordinal);
            if (!_supports(ApiFeature.CommandFeeds))
            {
                return bindings;
            }
            foreach (var feed in kerbcast.Command.Feeds())
            {
                if (feed == null || string.IsNullOrEmpty(feed.SiteKey))
                {
                    continue;
                }
                var centre = CentreAt(kerbcast, sites, feed);
                if (centre == null)
                {
                    continue;
                }
                feedSites[KerbcastLensSites.KeyFor(feed.FlightId)] = centre;
                if (!bindings.ContainsKey(feed.SiteKey))
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
                    return sites?.GroundStationNamed(feed.SiteKey);
                case SiteKind.LaunchSite:
                    return StationNear(sites, feed.SiteKey, feed.FlightId);
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

        /* A launch site is no network node, so it belongs to the ground station nearest it. */
        private string? StationNear(ILensSites? sites, string siteKey, uint feedFlightId)
        {
            if (_launchSite == null)
            {
                return null;
            }
            LaunchSiteReading reading;
            try
            {
                reading = _launchSite(siteKey);
            }
            catch (Exception e)
            {
                reading = new LaunchSiteReading(null, "none: reading the launch site threw " + e.GetType().Name + ": " + e.Message);
            }
            if (!(reading.Place is LaunchSitePlace at))
            {
                LogLaunchSite(feedFlightId, siteKey, reading.Source + " near=none");
                return null;
            }
            var near = sites?.GroundStationNear(at.BodyIndex, at.Latitude, at.Longitude);
            var where = " body=" + at.BodyIndex + " lat=" + Math.Round(at.Latitude, 5).ToString(System.Globalization.CultureInfo.InvariantCulture)
                + " lon=" + Math.Round(at.Longitude, 5).ToString(System.Globalization.CultureInfo.InvariantCulture);
            LogLaunchSite(feedFlightId, siteKey, "source=" + reading.Source + where + " near=" + (near ?? (sites == null ? "none (no lens sites)" : "none")));
            return near;
        }

        private void LogLaunchSite(uint feedFlightId, string siteKey, string detail)
        {
            if (_log == null)
            {
                return;
            }
            var key = "launchsite" + feedFlightId;
            var line = "site=" + siteKey + " " + detail;
            if (_logged.TryGetValue(key, out var last) && last == line)
            {
                return;
            }
            _logged[key] = line;
            _log("[Kerbcast][WORLD] launch-site feed=" + feedFlightId + " " + line);
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

        private int Read(IBulkCraftKnowledge knowledge, string centre, double ut, out long version) =>
            Read(knowledge, centre, ut, ref _buffer, out version);

        private static int Read(IBulkCraftKnowledge knowledge, string centre, double ut, ref CraftKnowledgeSample[] buffer, out long version)
        {
            var count = knowledge.ReadCentre(centre, ut, buffer, out version);
            if (count > buffer.Length)
            {
                buffer = new CraftKnowledgeSample[count * 2];
                count = knowledge.ReadCentre(centre, ut, buffer, out version);
            }
            return Math.Min(count, buffer.Length);
        }

        /// <summary>The same craft as the centre reads it <see cref="VelocitySpanSeconds"/> later, or null when that read does not list it.</summary>
        private static CraftKnowledgeSample? AheadOf(CraftKnowledgeSample sample, int count, CraftKnowledgeSample[] buffer)
        {
            for (var i = 0; i < count; i++)
            {
                if (buffer[i].VesselId == sample.VesselId)
                {
                    return buffer[i];
                }
            }
            return null;
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
        private void ApplyHeardChanges(Dictionary<string, List<ScopeCraft>> listed, Dictionary<string, Dictionary<uint, double?>> heard)
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
                    if (!scope.Value.Exists(c => c.PersistentId == concerns))
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
