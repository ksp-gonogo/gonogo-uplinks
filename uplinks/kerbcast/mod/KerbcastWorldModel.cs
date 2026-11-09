using System;
using System.Collections.Concurrent;
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

        /// <summary>Seconds between records while the launch framing is widening or easing back.</summary>
        public const double FramingRefreshSeconds = 0.25;

        private const string VesselCentrePrefix = "vessel:";

        /// <summary>How long a positioned record stands, measured from the instant it describes; each snapshot replaces the last long before this.</summary>
        private const double RecordValiditySeconds = 1e9;

        /// <summary>How far past the instant read a predicted place is read again, to give the craft the velocity its prediction implies.</summary>
        private const double VelocitySpanSeconds = 1.0;

        /// <summary>The fewest pixels across a craft must cover for a relay's camera to make it out.</summary>
        private const double RelaySightMinPixels = 2.0;

        /// <summary>The angle one pixel of a relay's camera covers when Kerbcast does not report it, in radians: its shipped tightest vertical field of view, 0.02 degrees, over its shipped frame height, 576 pixels.</summary>
        private const double RelayDefaultPixelRad = 0.02 * Math.PI / 180.0 / 576.0;

        /// <summary>The size of a craft whose size was not heard, in metres across: Kerbcast's nominal craft radius, twice.</summary>
        private const double RelaySightDefaultCraftAcrossM = 4.0;

        /// <summary>
        /// The furthest a relay's camera can make out a craft <paramref name="craftAcrossM"/>
        /// metres across, in metres, given the smallest angle it resolves toward the craft.
        ///
        /// <para>A craft spans <c>N</c> resolved angles at <c>range = size / (resolutionRad * N)</c>.
        /// N is 2 because a target takes two samples across to be told from a single stray
        /// pixel. Kerbcast reports the angle for the line tested: one pixel at its tightest zoom,
        /// or the wider blur of its lens when deep-space optics are drawn, as they are by default.
        /// From a craft in vacuum the top 1 arcsecond lens reads 206 km for a 2 m probe, 413 km for
        /// a default 4 m craft and 3,094 km for a 30 m station; the level 1 lens of 15 arcseconds
        /// reads 14 km, 28 km and 206 km.</para>
        /// </summary>
        public static double RelaySightRangeM(double craftAcrossM, double resolutionRad = RelayDefaultPixelRad) =>
            craftAcrossM / (resolutionRad * RelaySightMinPixels);

        /* Whether a tested line counts as sight of a craft this size: known, unblocked, on and within what the camera can resolve there. */
        private bool Sees(LineOfSightResult line, double? extentM)
        {
            if (!line.Known || !line.Visible || line.Disabled)
            {
                return false;
            }
            var resolution = _supports(ApiFeature.VantageResolution) ? KerbcastApiMinor5.ResolutionRad(line) : double.NaN;
            if (double.IsNaN(resolution) || resolution <= 0.0)
            {
                resolution = RelayDefaultPixelRad;
            }
            var across = extentM is double radius && radius > 0.0 ? 2.0 * radius : RelaySightDefaultCraftAcrossM;
            return line.RangeM <= RelaySightRangeM(across, resolution);
        }

        /// <summary>Real seconds a relay's line of sight is kept before it is tested again.</summary>
        private const double SightRefreshSeconds = 0.5;

        /// <summary>Real seconds a relay's frontier may stand still before its path home is called lost.</summary>
        private const double RelayPathLostSeconds = 2.0;

        /** Net acceleration beyond gravity, in m/s², above which a record is given its acceleration; below it the craft follows its conic. */
        private const double ThrustThreshold = 0.1;


        private readonly CraftLabels _labels;
        private readonly CraftPlaces _places;
        private readonly Func<ApiFeature, bool> _supports;
        private readonly Action<string>? _log;
        private readonly Action<IReadOnlyList<CraftKnowledgeFact>, double>? _onKnowledge;
        private readonly Action<IReadOnlyDictionary<string, string>>? _onFeedSites;
        private readonly Func<string, LaunchSiteReading>? _launchSite;
        private readonly Func<uint?>? _activeCraft;
        private readonly Func<int, double?>? _bodyMu;
        private readonly Func<bool>? _supportsAcceleration;
        private readonly Func<bool>? _supportsNetworks;
        private readonly Dictionary<uint, uint> _followed = new Dictionary<uint, uint>();
        private readonly HashSet<(uint Feed, uint Craft)> _refusedSincePublish = new HashSet<(uint Feed, uint Craft)>();
        private int _followTenure = -1;
        private readonly HashSet<uint> _networksSeen = new HashSet<uint>();
        private readonly HashSet<uint> _networksFollowing = new HashSet<uint>();
        private readonly ConcurrentQueue<uint> _viewerAims = new ConcurrentQueue<uint>();
        private readonly Dictionary<uint, HashSet<string>> _networkScopes = new Dictionary<uint, HashSet<string>>();
        private readonly Dictionary<string, RelayPath> _relayPaths = new Dictionary<string, RelayPath>(StringComparer.Ordinal);
        private readonly Dictionary<string, RelayReading> _relayReadings = new Dictionary<string, RelayReading>(StringComparer.Ordinal);
        private readonly Dictionary<string, string> _logged = new Dictionary<string, string>(StringComparer.Ordinal);
        private readonly Dictionary<string, double> _recordRadius = new Dictionary<string, double>(StringComparer.Ordinal);
        private readonly List<IdentityEvent> _pending = new List<IdentityEvent>();
        private readonly List<HeardAlias> _aliases = new List<HeardAlias>();
        private readonly Dictionary<string, string> _bound = new Dictionary<string, string>(StringComparer.Ordinal);
        private CraftKnowledgeSample[] _buffer = new CraftKnowledgeSample[64];
        private CraftKnowledgeSample[] _ahead = new CraftKnowledgeSample[64];
        private CraftKnowledgeSample[] _mid = new CraftKnowledgeSample[64];
        private CraftKnowledgeSample[] _heardBuffer = new CraftKnowledgeSample[64];
        private CraftKnowledgeSample[] _heardAhead = new CraftKnowledgeSample[64];
        private CraftKnowledgeSample[] _heardMid = new CraftKnowledgeSample[64];
        private long _sequence;
        private long _epoch;
        private double? _lastUt;
        private long? _lastVersion;
        private double? _lastPublish;
        private int _lastTenure = -1;
        private string _lastBindings = "";
        private string _lastRelaySight = "";
        private int _aliasVersion;
        private int _lastAliasVersion = -1;
        private long _lastEpoch = -1;
        private readonly KerbcastLaunchFraming _framing = new KerbcastLaunchFraming();
        private double _realSeconds;
        private bool _occluded;
        private double _occludedRangeM = double.NaN;
        private readonly Func<bool>? _supportsOcclusion;

        /// <param name="labels">Craft names and kinds, fed on the main thread.</param>
        /// <param name="supports">Which API features this Kerbcast implements, normally <see cref="KerbcastApi.Supports"/>.</param>
        /// <param name="places">Where each craft was, fed on the main thread; null positions nothing.</param>
        /// <param name="log">Receives one line each time a craft's place or radius in a scope changes; null logs nothing.</param>
        /// <param name="bodyMu">A body's gravitational parameter by index, which is what Kerbcast moves a record's craft by between snapshots; null leaves the velocity as the place implies it.</param>
        /// <param name="supportsAcceleration">Whether this Kerbcast takes a record's net acceleration (API 1.1), normally <see cref="KerbcastApiMinor1.Supported"/>; null means it does not.</param>
        /// <param name="supportsOcclusion">Whether this Kerbcast reports a command feed's view as blocked (API 1.2), normally <see cref="KerbcastApiMinor2.Supported"/>; null means it does not.</param>
        /// <param name="onKnowledge">Receives, on every publish attempt, how each command centre knows each craft it knows of, and the game time it describes; null reports nothing.</param>
        /// <param name="onFeedSites">Receives, on every publish and on a game load, each command feed's camera id in decimal mapped to the command centre its lens stands at; null reports nothing.</param>
        /// <param name="supportsNetworks">Whether this Kerbcast says which vantages a tracking network has and which feeds follow the active craft (API 1.5), normally <see cref="KerbcastApiMinor5.Supported"/>; null means it does not.</param>
        public KerbcastWorldModel(CraftLabels labels, Func<ApiFeature, bool> supports, CraftPlaces? places = null, Action<string>? log = null, Action<IReadOnlyDictionary<string, string>>? onFeedSites = null, Func<string, LaunchSiteReading>? launchSite = null, Func<uint?>? activeCraft = null, Func<int, double?>? bodyMu = null, Func<bool>? supportsAcceleration = null, Func<bool>? supportsOcclusion = null, Action<IReadOnlyList<CraftKnowledgeFact>, double>? onKnowledge = null, Func<bool>? supportsNetworks = null)
        {
            _supportsNetworks = supportsNetworks;
            _supportsOcclusion = supportsOcclusion;
            _bodyMu = bodyMu;
            _supportsAcceleration = supportsAcceleration;
            _log = log;
            _onKnowledge = onKnowledge;
            _onFeedSites = onFeedSites;
            _launchSite = launchSite;
            _activeCraft = activeCraft;
            _labels = labels;
            _places = places ?? new CraftPlaces();
            _supports = supports;
        }

        /// <summary>Any thread: a countdown to liftoff of the active craft has <paramref name="remainingSeconds"/> left of its <paramref name="lengthSeconds"/>, so the camera widens over what is left.</summary>
        public void SayLaunchCountdown(double remainingSeconds, double lengthSeconds) => _framing.Start(remainingSeconds, lengthSeconds);

        /// <summary>Any thread: the countdown to liftoff was called off, so the camera eases back in.</summary>
        public void CancelLaunchCountdown() => _framing.Cancel();

        /// <summary>Any thread: an operator aimed command feed <paramref name="flightId"/> at a craft, so a tracking network no longer follows the active craft for the rest of this lock tenure.</summary>
        public void SayViewerAim(uint flightId) => _viewerAims.Enqueue(flightId);

        /// <summary>Whether at least one command feed is aimed at a craft Gonogo follows for it.</summary>
        public bool Following => _followed.Count > 0;

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
            _relayPaths.Clear();
            _relayReadings.Clear();
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
        /// <param name="lightSpeed">How fast signals travel, in metres per second; null gives a relay no sight of its own.</param>
        public PublishResult? Publish(
            IKerbcast kerbcast,
            IWorldModelPublisher publisher,
            int tenure,
            ILensSites? sites,
            IBulkCraftKnowledge? knowledge,
            double nowUt,
            double realSeconds,
            double? lightSpeed = null)
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
            _realSeconds = realSeconds;

            if (tenure != _followTenure)
            {
                _followed.Clear();
                _refusedSincePublish.Clear();
                _networksSeen.Clear();
                _networksFollowing.Clear();
                _followTenure = tenure;
            }
            while (_viewerAims.TryDequeue(out var aimed))
            {
                if (_networksFollowing.Remove(aimed))
                {
                    _followed.Remove(aimed);
                }
            }
            var active = _activeCraft?.Invoke();
            var bindings = Bindings(kerbcast, sites, out var feedSites);
            _onFeedSites?.Invoke(feedSites);
            var relays = RelayScopes(knowledge, bindings, nowUt);
            var commanders = Commanders(sites, relays, bindings);
            SyncLensSites(sites, bindings, commanders);

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
            var facts = _onKnowledge == null ? null : new List<CraftKnowledgeFact>();
            long? version = null;
            var ownSight = new Dictionary<string, List<RelaySighting>>(StringComparer.Ordinal);
            foreach (var scope in scopes)
            {
                var ut = sites?.KnowledgeUt(scope);
                var crafts = new List<ScopeCraft>();
                var lastHeard = new Dictionary<uint, double?>();
                if (relays.Contains(scope))
                {
                    if (ut.HasValue && commanders.TryGetValue(scope, out var commander) && knowledge != null)
                    {
                        scopeUt[scope] = ut.Value;
                        ownSight[scope] = RelaySights(kerbcast, knowledge, scope, commander, ut.Value, nowUt, realSeconds, lightSpeed, crafts, lastHeard);
                    }
                    listed[scope] = crafts;
                    heard[scope] = lastHeard;
                    continue;
                }
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
                        facts?.Add(new CraftKnowledgeFact(scope, pid, sample.State, sample.LastKnownUt));
                        var at = ut.Value;
                        var ahead = AheadOf(sample, aheadCount, _ahead);
                        var mid = AheadOf(sample, midCount, _mid);
                        var sampleRead = read;
                        var sampleAheadVersion = aheadVersion;
                        if (sample.State != CraftKnowledgeState.Held && sample.UncertaintyM.HasValue && sample.Place != null
                            && sample.LastKnownUt.HasValue && sample.LastKnownUt.Value < at
                            && TryHeard(knowledge, scope, sample, sample.LastKnownUt.Value, out var heardSample, out var heardAhead, out var heardMid, out var heardRead, out var heardAheadVersion))
                        {
                            at = sample.LastKnownUt.Value;
                            sample = heardSample;
                            ahead = heardAhead;
                            mid = heardMid;
                            sampleRead = heardRead;
                            sampleAheadVersion = heardAheadVersion;
                        }
                        crafts.Add(new ScopeCraft(pid, vesselId, sample, at, ahead, sampleRead, sampleAheadVersion, mid));
                        lastHeard[pid] = sample.LastKnownUt;
                    }
                }
                listed[scope] = crafts;
                heard[scope] = lastHeard;
            }

            if (facts != null)
            {
                _onKnowledge!(facts, nowUt);
            }
            ApplyHeardChanges(listed, heard);
            Follow(kerbcast, active, relays, feedSites, listed, ownSight);
            _occluded = LaunchpadOccluded(kerbcast, out _occludedRangeM);

            var bindingKey = BindingKey(bindings);
            var relaySight = RelaySightKey(ownSight, listed, relays);
            var due = tenure != _lastTenure
                || _epoch != _lastEpoch
                || version != _lastVersion
                || bindingKey != _lastBindings
                || relaySight != _lastRelaySight
                || _aliasVersion != _lastAliasVersion
                || !_lastPublish.HasValue
                || realSeconds - _lastPublish.Value >= RefreshSeconds
                || (_framing.Active && realSeconds - _lastPublish.Value >= FramingRefreshSeconds);
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
                Fill(builder, bindings, scopes, listed, ownSight);
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
            _lastRelaySight = relaySight;
            _lastAliasVersion = _aliasVersion;
            _lastPublish = realSeconds;
            _refusedSincePublish.Clear();
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
         *
         * Under the lock a feed with no aim has no subject, so a tracking network that
         * follows the active craft is only ever shown by being aimed at it here, and that
         * aim clears FollowsActiveVessel. So which networks follow is read once, the first
         * time each is seen in a lock tenure, and a network that was watching a chosen
         * craft then is never aimed; a viewer's aim takes a network out of the set. The
         * network chooses its own vantage per craft, so the on-air site's Targets says
         * nothing about it: a network is aimed once any of its vantages' scopes hears the
         * active craft or a relay among them sees it.
         *
         * Kerbcast judges an aim against the last world model it was given, and this runs
         * ahead of the publish that names a newly heard craft. A network is aimed on what
         * Gonogo knows, without Kerbcast's targets to hold it back, so its first aim can be
         * refused with the craft still unknown there. A refused aim is not recorded as
         * sent: only a new model can change the answer, so it goes again after the next
         * publish.
         */
        private void Follow(IKerbcast kerbcast, uint? active, HashSet<string> relays, Dictionary<string, string> feedSites, Dictionary<string, List<ScopeCraft>> listed, Dictionary<string, List<RelaySighting>> ownSight)
        {
            if (_activeCraft == null || !_supports(ApiFeature.CommandFeeds))
            {
                return;
            }
            foreach (var feed in kerbcast.Command.Feeds())
            {
                if (feed == null)
                {
                    continue;
                }
                var network = IsNetwork(feed);
                if (network && !_networksFollowing.Contains(feed.FlightId))
                {
                    continue;
                }
                var subject = active.HasValue
                    && (network
                        ? KnownToNetwork(feed.FlightId, active.Value, relays, listed, ownSight)
                        : Qualifies(kerbcast, feed, active.Value, feedSites, listed))
                    ? active.Value
                    : 0u;
                if (subject == 0u && active.HasValue && _followed.TryGetValue(feed.FlightId, out var aimed) && aimed == active.Value && (network || IsHeard(feed, active.Value, feedSites, listed)))
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
                if (_refusedSincePublish.Contains((feed.FlightId, subject)))
                {
                    continue;
                }
                var result = kerbcast.Command.SetAim(feed.FlightId, Aim.Vessel(subject, 0.0, false), KerbcastAuthority.Owner);
                LogFollow(feed.FlightId, subject + " result=" + result);
                if (result == AimResult.Ok)
                {
                    _followed[feed.FlightId] = subject;
                }
                else
                {
                    _refusedSincePublish.Add((feed.FlightId, subject));
                }
            }
        }

        private bool KnownToNetwork(uint flightId, uint craft, HashSet<string> relays, Dictionary<string, List<ScopeCraft>> listed, Dictionary<string, List<RelaySighting>> ownSight)
        {
            if (!_networkScopes.TryGetValue(flightId, out var scopes))
            {
                return false;
            }
            foreach (var scope in scopes)
            {
                if (relays.Contains(scope))
                {
                    if (ownSight.TryGetValue(scope, out var seen) && seen.Exists(s => s.PersistentId == craft))
                    {
                        return true;
                    }
                }
                else if (listed.TryGetValue(scope, out var crafts) && crafts.Exists(c => c.PersistentId == craft && c.Sample.State == CraftKnowledgeState.Heard))
                {
                    return true;
                }
            }
            return false;
        }

        private bool IsNetwork(CommandFeed feed) => _supportsNetworks?.Invoke() == true && KerbcastApiMinor5.IsNetwork(feed);

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
            Dictionary<string, List<ScopeCraft>> listed,
            Dictionary<string, List<RelaySighting>> ownSight)
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
                    Describe(builder, scope, craft);
                    Label(builder, craft.PersistentId);
                }
                if (ownSight.TryGetValue(scope, out var seen))
                {
                    foreach (var sighting in seen)
                    {
                        DescribeSighting(builder, sighting);
                        Label(builder, sighting.PersistentId);
                    }
                }
            }
        }

        private void Label(WorldModelBuilder builder, uint pid)
        {
            if (!_labels.TryLabel(pid, out var label))
            {
                return;
            }
            if (label.Name != null)
            {
                builder.Name(label.Name);
            }
            if (label.Kind != null)
            {
                builder.Kind(label.Kind);
            }
        }

        /* A relay sees where the craft was when its light left, so the record starts there and Kerbcast carries it on from that instant. */
        private static void DescribeSighting(WorldModelBuilder builder, RelaySighting sighting)
        {
            var place = sighting.Place;
            var from = place.Ut;
            var until = place.Ut + RecordValiditySeconds;
            if (place.OnSurface)
            {
                builder.Surface(sighting.PersistentId, place.BodyIndex, place.Latitude, place.Longitude, place.Altitude, from, until);
            }
            else
            {
                builder.StateVector(sighting.PersistentId, place.BodyIndex, place.Ut, new Vec3d(place.State6[0], place.State6[1], place.State6[2]), new Vec3d(place.State6[3], place.State6[4], place.State6[5]), from, until);
            }
            builder.Uncertainty(0.0, 0.0, 0.0, 0.0);
        }

        /*
         * A craft the centre has a predicted place for is aimed at the place and radius
         * the centre gives for the instant it last heard the craft, and its record starts
         * there.
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
            var publishedM = Math.Max(EndOfLifeRadius(craft, sample.UncertaintyM.Value), LaunchFramingM(craft, place.OnSurface));
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
         * When the reckoned acceleration differs from gravity by more than a thrust threshold
         * and this Kerbcast takes a net acceleration (API 1.1), the record instead carries the
         * velocity at its start and the reckoned net acceleration, which Kerbcast holds over
         * the record's life, so there is no gravity residual left to widen the radius by.
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
            Vec3d? net = null;
            if (ahead != null && craft.MidSample?.Place is { } mid && mid.BodyIndex == place.BodyIndex && _bodyMu?.Invoke(place.BodyIndex) is double mu && mu > 0.0)
            {
                var half = VelocitySpanSeconds / 2.0;
                var r = position.Magnitude();
                var axes = new[] { position.X, position.Y, position.Z };
                var midAxes = new[] { mid.Position.X, mid.Position.Y, mid.Position.Z };
                var endAxes = new[] { ahead.Position.X, ahead.Position.Y, ahead.Position.Z };
                var published = new double[3];
                var v0s = new double[3];
                var nets = new double[3];
                var squared = 0.0;
                for (var i = 0; i < 3; i++)
                {
                    // Position at 0, half and 1 times the span: velocity at the start and the acceleration it carries.
                    var v0 = (-3.0 * axes[i] + 4.0 * midAxes[i] - endAxes[i]) / (2.0 * half);
                    var a = (axes[i] - 2.0 * midAxes[i] + endAxes[i]) / (half * half);
                    var g = -mu * axes[i] / (r * r * r);
                    var gap = g - a;
                    published[i] = v0 - 0.5 * gap * VelocitySpanSeconds;
                    v0s[i] = v0;
                    nets[i] = a;
                    squared += gap * gap;
                }
                velocity = new Vec3d(published[0], published[1], published[2]);
                residualM = Math.Sqrt(squared) * VelocitySpanSeconds * VelocitySpanSeconds / 8.0;
                if (Math.Sqrt(squared) > ThrustThreshold && _supportsAcceleration?.Invoke() == true)
                {
                    velocity = new Vec3d(v0s[0], v0s[1], v0s[2]);
                    net = new Vec3d(nets[0], nets[1], nets[2]);
                    residualM = 0.0;
                }
            }
            var ut = craft.Ut;
            builder.StateVector(craft.PersistentId, place.BodyIndex, ut, new Vec3d(position.X, position.Y, position.Z), velocity, ut, ut + RecordValiditySeconds);
            if (net is { } acceleration)
            {
                KerbcastApiMinor1.Accelerate(builder, acceleration.X, acceleration.Y, acceleration.Z);
            }
            var publishedM = Math.Max(EndOfLifeRadius(craft, radiusM) + residualM, LaunchFramingM(craft, false));
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
         * Whether a launch-site command feed that is following the active craft reports its
         * view blocked, and how far the craft is from it. Only a launch-site feed counts: a station's feed is blocked by the
         * planet whenever the craft is over the horizon, which says nothing about the pad.
         * The raw reading flickers at an edge; the framing's easing is what smooths it.
         */
        private bool LaunchpadOccluded(IKerbcast kerbcast, out double rangeM)
        {
            rangeM = double.NaN;
            if (_supportsOcclusion?.Invoke() != true || _activeCraft?.Invoke() is not uint active)
            {
                return false;
            }
            foreach (var feed in kerbcast.Command.Feeds())
            {
                if (feed != null
                    && feed.SiteKind == SiteKind.LaunchSite
                    && _followed.TryGetValue(feed.FlightId, out var subject)
                    && subject == active
                    && KerbcastApiMinor2.Occluded(kerbcast, feed.FlightId))
                {
                    foreach (var target in kerbcast.Command.Targets(feed.FlightId))
                    {
                        if (target.PersistentId == active)
                        {
                            rangeM = target.RangeM;
                        }
                    }
                    return true;
                }
            }
            return false;
        }

        /*
         * While a countdown to liftoff runs, the active craft is framed wider than its
         * uncertainty by the launch framing's radius, so a camera on the pad has the
         * whole climb in view when the record it holds is still a craft sitting on the
         * ground. Every other craft is framed as its record says.
         */
        private double LaunchFramingM(ScopeCraft craft, bool onGround)
        {
            return _activeCraft?.Invoke() is uint active && active == craft.PersistentId
                ? _framing.RadiusM(_realSeconds, onGround, _occluded, _occludedRangeM)
                : 0.0;
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

        /*
         * A relay's picture counts at home only when all of it holds: a signal path home,
         * a clear line to the craft where the craft's light left it, within the sight
         * range, and a place to point at. The relay's observe time is the newest instant
         * of home's knowledge that has reached it: the path is the same one the picture
         * comes home along, so the two delays match. A line the camera could not test is
         * unknown and shows nothing. The place comes from the relay's own sight when the
         * game recorded the craft at that moment, or else from what its commanding centre
         * has told it, which is read at the same observe time and so aged by the delay.
         */
        private List<RelaySighting> RelaySights(
            IKerbcast kerbcast,
            IBulkCraftKnowledge knowledge,
            string scope,
            string commander,
            double observeUt,
            double nowUt,
            double realSeconds,
            double? lightSpeed,
            List<ScopeCraft> fromCommander,
            Dictionary<uint, double?> lastHeard)
        {
            var seen = new List<RelaySighting>();
            if (!RelayPathLive(scope, observeUt, nowUt, realSeconds) || !lightSpeed.HasValue
                || !Guid.TryParse(scope.Substring(VesselCentrePrefix.Length), out var relayId)
                || !kerbcast.Cameras.TryPersistentId(relayId, out var relayPid)
                || !_subjects.TryGetValue(scope, out var subjects))
            {
                return seen;
            }
            var vantage = NetworkVantage.Vessel(relayPid);
            Dictionary<string, double?>? extents = null;
            foreach (var pid in subjects)
            {
                if (pid == relayPid || !kerbcast.Cameras.TryVessel(pid, out var craftId))
                {
                    continue;
                }
                var cacheKey = scope + "|" + pid;
                if (!_relayReadings.TryGetValue(cacheKey, out var reading) || realSeconds - reading.AtRealSeconds >= SightRefreshSeconds)
                {
                    extents ??= Extents(knowledge, commander, nowUt);
                    extents.TryGetValue(craftId.ToString(), out var extent);
                    reading = ReadSight(kerbcast, vantage, craftId, observeUt, lightSpeed.Value, realSeconds, extent);
                    _relayReadings[cacheKey] = reading;
                }
                if (reading.Sees && reading.Place is CraftPlace place)
                {
                    seen.Add(new RelaySighting(pid, place));
                    lastHeard[pid] = place.Ut;
                    continue;
                }
                if (reading.NoPlace)
                {
                    CommanderKnows(kerbcast, knowledge, vantage, commander, observeUt, craftId, pid, fromCommander, lastHeard);
                }
            }
            return seen;
        }

        /* A craft's size as its commanding centre last heard it, keyed by craft id; a craft the centre has not heard reads as absent. */
        private Dictionary<string, double?> Extents(IBulkCraftKnowledge knowledge, string commander, double nowUt)
        {
            var extents = new Dictionary<string, double?>(StringComparer.Ordinal);
            var count = Read(knowledge, commander, nowUt, out _);
            for (var i = 0; i < count; i++)
            {
                extents[_buffer[i].VesselId] = _buffer[i].ExtentM;
            }
            return extents;
        }

        private RelayReading ReadSight(IKerbcast kerbcast, NetworkVantage vantage, Guid craftId, double observeUt, double lightSpeed, double realSeconds, double? extentM)
        {
            if (!_places.TryAt(craftId, observeUt, out var atObserve) || atObserve.Position == null)
            {
                return new RelayReading(realSeconds, false, null, noPlace: true);
            }
            var nearest = KerbcastApiMinor5.Sight(kerbcast, vantage, observeUt, atObserve.BodyIndex, atObserve.Position, extentM);
            if (!nearest.Known || double.IsNaN(nearest.RangeM) || double.IsInfinity(nearest.RangeM))
            {
                return new RelayReading(realSeconds, false, null, noPlace: false);
            }
            var emitUt = observeUt - nearest.RangeM / lightSpeed;
            if (!_places.TryAt(craftId, emitUt, out var atEmit) || atEmit.Position == null)
            {
                return new RelayReading(realSeconds, false, null, noPlace: true);
            }
            var line = KerbcastApiMinor5.Sight(kerbcast, vantage, observeUt, atEmit.BodyIndex, atEmit.Position, extentM);
            return new RelayReading(realSeconds, Sees(line, extentM), atEmit, noPlace: false);
        }

        private void CommanderKnows(IKerbcast kerbcast, IBulkCraftKnowledge knowledge, NetworkVantage vantage, string commander, double observeUt, Guid craftId, uint pid, List<ScopeCraft> fromCommander, Dictionary<uint, double?> lastHeard)
        {
            var count = Read(knowledge, commander, observeUt, out var version);
            var idText = craftId.ToString();
            for (var i = 0; i < count; i++)
            {
                var sample = _buffer[i];
                if (sample.VesselId != idText || sample.Place == null || !sample.UncertaintyM.HasValue || sample.State == CraftKnowledgeState.Unknown || sample.State == CraftKnowledgeState.Held)
                {
                    continue;
                }
                var position = sample.Place.Position;
                var line = KerbcastApiMinor5.Sight(kerbcast, vantage, observeUt, sample.Place.BodyIndex, new[] { position.X, position.Y, position.Z }, sample.ExtentM);
                if (Sees(line, sample.ExtentM))
                {
                    fromCommander.Add(new ScopeCraft(pid, craftId, sample, observeUt, null, version, version, null));
                    lastHeard[pid] = sample.LastKnownUt;
                }
                return;
            }
        }

        /*
         * The frontier holds still while no path reaches the relay, and moves on every
         * courier tick while one does, so a frontier that has stopped moving for a couple
         * of real seconds is a lost path. A paused game moves neither clock.
         */
        private bool RelayPathLive(string scope, double observeUt, double nowUt, double realSeconds)
        {
            if (!_relayPaths.TryGetValue(scope, out var path))
            {
                _relayPaths[scope] = new RelayPath(observeUt, nowUt, realSeconds);
                return true;
            }
            if (observeUt > path.DeliveredUt)
            {
                _relayPaths[scope] = new RelayPath(observeUt, nowUt, realSeconds);
                return true;
            }
            if (nowUt <= path.AtUt)
            {
                _relayPaths[scope] = new RelayPath(path.DeliveredUt, nowUt, realSeconds);
                return true;
            }
            return realSeconds - path.AtRealSeconds < RelayPathLostSeconds;
        }

        private static string RelaySightKey(Dictionary<string, List<RelaySighting>> ownSight, Dictionary<string, List<ScopeCraft>> listed, HashSet<string> relays)
        {
            var keys = new List<string>();
            foreach (var relay in relays)
            {
                if (ownSight.TryGetValue(relay, out var seen))
                {
                    foreach (var sighting in seen)
                    {
                        keys.Add(relay + ":" + sighting.PersistentId);
                    }
                }
                if (listed.TryGetValue(relay, out var crafts))
                {
                    foreach (var craft in crafts)
                    {
                        keys.Add(relay + "~" + craft.PersistentId);
                    }
                }
            }
            keys.Sort(StringComparer.Ordinal);
            return string.Join("|", keys);
        }

        private readonly struct RelaySighting
        {
            public RelaySighting(uint persistentId, CraftPlace place)
            {
                PersistentId = persistentId;
                Place = place;
            }

            public uint PersistentId { get; }

            public CraftPlace Place { get; }
        }

        private readonly struct RelayPath
        {
            public RelayPath(double deliveredUt, double atUt, double atRealSeconds)
            {
                DeliveredUt = deliveredUt;
                AtUt = atUt;
                AtRealSeconds = atRealSeconds;
            }

            public double DeliveredUt { get; }

            public double AtUt { get; }

            public double AtRealSeconds { get; }
        }

        private readonly struct RelayReading
        {
            public RelayReading(double atRealSeconds, bool sees, CraftPlace? place, bool noPlace)
            {
                AtRealSeconds = atRealSeconds;
                Sees = sees;
                Place = place;
                NoPlace = noPlace;
            }

            public double AtRealSeconds { get; }

            public bool Sees { get; }

            public CraftPlace? Place { get; }

            public bool NoPlace { get; }
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

            /// <summary>The instant the record describes: the one the centre last heard the craft at, or the scope's read instant for a craft with no predicted place.</summary>
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

        /// <summary>Each command feed's site key, and every vantage of a tracking network, mapped to the scope of the centre at that site; unresolved sites are left out.</summary>
        private Dictionary<string, string> Bindings(IKerbcast kerbcast, ILensSites? sites, out Dictionary<string, string> feedSites)
        {
            var bindings = new Dictionary<string, string>(StringComparer.Ordinal);
            feedSites = new Dictionary<string, string>(StringComparer.Ordinal);
            _networkScopes.Clear();
            _subjects.Clear();
            if (!_supports(ApiFeature.CommandFeeds))
            {
                return bindings;
            }
            foreach (var feed in kerbcast.Command.Feeds())
            {
                if (feed == null)
                {
                    continue;
                }
                if (!string.IsNullOrEmpty(feed.SiteKey))
                {
                    var centre = CentreAt(kerbcast, sites, feed.SiteKey, feed.SiteKind, feed.VantagePersistentId, feed.FlightId);
                    if (centre != null)
                    {
                        feedSites[KerbcastLensSites.KeyFor(feed.FlightId)] = centre;
                        if (!bindings.ContainsKey(feed.SiteKey))
                        {
                            bindings[feed.SiteKey] = centre;
                        }
                        AddSubject(centre, feed);
                    }
                }
                if (IsNetwork(feed))
                {
                    BindVantages(kerbcast, sites, feed, bindings);
                }
            }
            return bindings;
        }

        /*
         * A network scores every vantage on what that vantage's own site knows, so every
         * one has to be bound and not only the one on air. Binding one at the moment of a
         * cut is too late, since a new binding holds its knowledge for one more delay.
         */
        private void BindVantages(IKerbcast kerbcast, ILensSites? sites, CommandFeed feed, Dictionary<string, string> bindings)
        {
            if (_networksSeen.Add(feed.FlightId) && KerbcastApiMinor5.FollowsActive(feed))
            {
                _networksFollowing.Add(feed.FlightId);
            }
            var scopes = new HashSet<string>(StringComparer.Ordinal);
            _networkScopes[feed.FlightId] = scopes;
            foreach (var vantage in KerbcastApiMinor5.Vantages(kerbcast, feed.FlightId))
            {
                if (string.IsNullOrEmpty(vantage.SiteKey))
                {
                    continue;
                }
                var centre = CentreAt(kerbcast, sites, vantage.SiteKey, vantage.SiteKind, vantage.VantagePersistentId, feed.FlightId);
                if (centre == null)
                {
                    continue;
                }
                scopes.Add(centre);
                if (!bindings.ContainsKey(vantage.SiteKey))
                {
                    bindings[vantage.SiteKey] = centre;
                }
                AddSubject(centre, feed);
            }
        }

        /* The craft a relay's scope has to answer for: what the feed is aimed at, or the active craft for a network that follows it and is not aimed yet. */
        private void AddSubject(string centre, CommandFeed feed)
        {
            var subject = feed.SubjectPersistentId;
            if (subject == 0u && _networksFollowing.Contains(feed.FlightId) && _activeCraft?.Invoke() is uint active)
            {
                subject = active;
            }
            if (subject == 0u)
            {
                return;
            }
            if (!_subjects.TryGetValue(centre, out var crafts))
            {
                _subjects[centre] = crafts = new HashSet<uint>();
            }
            crafts.Add(subject);
        }

        private readonly Dictionary<string, HashSet<uint>> _subjects = new Dictionary<string, HashSet<uint>>(StringComparer.Ordinal);

        /*
         * A craft is a command centre only while crewed, and only a centre has knowledge
         * of its own, so a craft site whose board holds nothing is an uncrewed relay.
         */
        private HashSet<string> RelayScopes(IBulkCraftKnowledge? knowledge, Dictionary<string, string> bindings, double nowUt)
        {
            var relays = new HashSet<string>(StringComparer.Ordinal);
            if (knowledge == null)
            {
                return relays;
            }
            foreach (var scope in bindings.Values)
            {
                if (scope.StartsWith(VesselCentrePrefix, StringComparison.Ordinal) && !relays.Contains(scope)
                    && Read(knowledge, scope, nowUt, out _) == 0)
                {
                    relays.Add(scope);
                }
            }
            return relays;
        }

        /*
         * Which centre commands each relay: stock's home node when the game has one, else
         * the first ground station bound this tick. Every ground station reaches home over
         * the ground network, so any of them holds what home knows; the capabilities offer
         * no way to name home itself from a mod.
         */
        private static Dictionary<string, string> Commanders(ILensSites? sites, HashSet<string> relays, Dictionary<string, string> bindings)
        {
            var commanders = new Dictionary<string, string>(StringComparer.Ordinal);
            if (relays.Count == 0 || sites == null)
            {
                return commanders;
            }
            var home = sites.GroundStationNamed("KSC");
            if (home == null)
            {
                foreach (var scope in bindings.Values)
                {
                    if (scope.StartsWith("ground:", StringComparison.Ordinal) && (home == null || string.CompareOrdinal(scope, home) < 0))
                    {
                        home = scope;
                    }
                }
            }
            if (home == null)
            {
                return commanders;
            }
            foreach (var relay in relays)
            {
                commanders[relay] = home;
            }
            return commanders;
        }

        private string? CentreAt(IKerbcast kerbcast, ILensSites? sites, string siteKey, SiteKind kind, uint vantagePersistentId, uint feedFlightId)
        {
            switch (kind)
            {
                case SiteKind.Station:
                    return sites?.GroundStationNamed(siteKey);
                case SiteKind.LaunchSite:
                    return StationNear(sites, siteKey, feedFlightId);
                case SiteKind.Vessel:
                    if (vantagePersistentId == 0 || !_supports(ApiFeature.CraftIdentity)
                        || !kerbcast.Cameras.TryVessel(vantagePersistentId, out var vesselId)
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

        /* A site is commanded by the centre standing at it, whose knowledge reaches the lens at once, unless it is a relay. */
        private void SyncLensSites(ILensSites? sites, Dictionary<string, string> bindings, Dictionary<string, string> commanders)
        {
            if (sites == null)
            {
                return;
            }
            var wanted = new HashSet<string>(bindings.Values, StringComparer.Ordinal);
            foreach (var centre in wanted)
            {
                var commander = commanders.TryGetValue(centre, out var home) ? home : centre;
                if (!_bound.TryGetValue(centre, out var last) || last != commander)
                {
                    _bound[centre] = commander;
                    sites.Bind(centre, centre, commander);
                }
            }
            foreach (var centre in new List<string>(_bound.Keys))
            {
                if (!wanted.Contains(centre))
                {
                    _bound.Remove(centre);
                    sites.Unbind(centre, centre);
                }
            }
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

        /*
         * A predicted record starts at the instant the centre last heard the craft, with
         * the place and radius it had then, as a heard craft's record does. Kerbcast
         * reads a record forward from its start, so a record started at the scope's read
         * instant would count the signal delay a second time. The three reads that give
         * the velocity and acceleration are taken from the heard instant too. Returns
         * false, leaving the prediction at the read instant, when the centre lists the
         * craft there in a different state or without a place and radius.
         */
        private bool TryHeard(
            IBulkCraftKnowledge knowledge,
            string scope,
            CraftKnowledgeSample sample,
            double heardUt,
            out CraftKnowledgeSample heard,
            out CraftKnowledgeSample? ahead,
            out CraftKnowledgeSample? mid,
            out long readVersion,
            out long aheadVersion)
        {
            heard = default;
            ahead = null;
            mid = null;
            aheadVersion = 0;
            var count = Read(knowledge, scope, heardUt, ref _heardBuffer, out readVersion);
            if (AheadOf(sample, count, _heardBuffer) is not { } found
                || found.State != sample.State || found.Place == null || !found.UncertaintyM.HasValue)
            {
                return false;
            }
            heard = found;
            var aheadCount = Read(knowledge, scope, heardUt + VelocitySpanSeconds, ref _heardAhead, out aheadVersion);
            var midCount = Read(knowledge, scope, heardUt + VelocitySpanSeconds / 2.0, ref _heardMid, out _);
            ahead = AheadOf(sample, aheadCount, _heardAhead);
            mid = AheadOf(sample, midCount, _heardMid);
            return true;
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
