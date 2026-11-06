using System;
using System.Collections.Generic;
using Kerbcast.Api;
using Sitrep.Contract;

namespace Gonogo.KerbcastUplink
{
    /// <summary>
    /// What the Uplink drives each capture tick to keep Kerbcast's command feeds to
    /// what Gonogo's command centres know. Names no Kerbcast type, so the Uplink
    /// can hold one before it knows Kerbcast.API resolves.
    /// </summary>
    public interface IKerbcastGovernor : IDisposable
    {
        /// <summary>Main thread: one capture tick.</summary>
        void Tick(double nowUt, double realSeconds);

        /// <summary>Main thread: a game state was loaded.</summary>
        void OnGameLoaded();

        /// <summary>Any thread: a countdown to liftoff has <paramref name="remainingSeconds"/> left of its <paramref name="lengthSeconds"/>.</summary>
        void SayLaunchCountdown(double remainingSeconds, double lengthSeconds);

        /// <summary>Any thread: the countdown to liftoff was called off.</summary>
        void CancelLaunchCountdown();
    }

    /// <summary>
    /// <see cref="KerbcastAuthority"/> and <see cref="KerbcastWorldModel"/> fed from
    /// Gonogo's capabilities: <c>signalSpeed</c> decides whether to govern at all,
    /// <c>lensSites</c> places each feed, and <c>craftKnowledge</c> fills its scope.
    /// A capability this Gonogo does not offer is absence: with no signal speed
    /// nothing is governed, and with no lens sites or knowledge every governed
    /// feed reads every craft as unknown.
    /// </summary>
    public sealed class KerbcastGovernor : IKerbcastGovernor
    {
        private readonly Func<IKerbcast?> _kerbcast;
        private readonly Func<Kernel?> _kernel;
        private readonly KerbcastAuthority _authority;
        private readonly KerbcastWorldModel _model;
        private readonly Action<bool>? _onFollowing;
        private readonly Action<IReadOnlyList<CraftKnowledgeFact>, double>? _onKnowledge;

        /// <param name="kerbcast">Kerbcast in this scene, normally <see cref="KerbcastApi.Instance"/>.</param>
        /// <param name="supports">Which API features this Kerbcast implements, normally <see cref="KerbcastApi.Supports"/>.</param>
        /// <param name="labels">Craft names and kinds, fed on the main thread.</param>
        /// <param name="kernel">The host's capability kernel.</param>
        /// <param name="supportsOcclusion">Whether this Kerbcast reports a command feed's view as blocked (API 1.2), normally <see cref="KerbcastApiMinor2.Supported"/>; null means it does not.</param>
        /// <param name="onKnowledge">Told on every governed tick how each command centre knows each craft it knows of, and the game time that describes.</param>
        /// <param name="onFollowing">Told on every tick whether a command feed is following a craft, so the caller can ask for fresher samples only while one is.</param>
        public KerbcastGovernor(
            Func<IKerbcast?> kerbcast,
            Func<ApiFeature, bool> supports,
            CraftLabels labels,
            Func<Kernel?> kernel,
            CraftPlaces? places = null,
            Action<string>? log = null,
            Action<IReadOnlyDictionary<string, string>>? onFeedSites = null,
            Func<string, LaunchSiteReading>? launchSite = null,
            Func<uint?>? activeCraft = null,
            Func<int, double?>? bodyMu = null,
            Func<bool>? supportsAcceleration = null,
            Action<bool>? onFollowing = null,
            Func<bool>? supportsOcclusion = null,
            Action<IReadOnlyList<CraftKnowledgeFact>, double>? onKnowledge = null)
        {
            _onFollowing = onFollowing;
            _onKnowledge = onKnowledge;
            _kerbcast = kerbcast;
            _kernel = kernel;
            _authority = new KerbcastAuthority(kerbcast, supports);
            _model = new KerbcastWorldModel(labels, supports, places, log, onFeedSites, launchSite, activeCraft, bodyMu, supportsAcceleration, supportsOcclusion, onKnowledge);
            KerbcastApi.Identity += _model.OnIdentity;
        }

        public AuthorityState State => _authority.State;

        public void Tick(double nowUt, double realSeconds)
        {
            var speed = Query<ISignalSpeed>(SignalSpeedCapability.Id)?.Current?.MetresPerSecond;
            var state = _authority.Tick(realSeconds, speed);
            var kerbcast = _kerbcast();
            var publisher = _authority.Publisher;
            if (state != AuthorityState.Governing || kerbcast == null || publisher == null)
            {
                _onFollowing?.Invoke(false);
                // A centre that is not being governed is not known to know anything: say so, so no entry outlives its tick.
                _onKnowledge?.Invoke(Array.Empty<CraftKnowledgeFact>(), nowUt);
                return;
            }
            _model.Publish(
                kerbcast,
                publisher,
                _authority.Tenure,
                Query<ILensSites>(LensSitesCapability.Id),
                Query<ICraftKnowledge>(CraftKnowledgeCapability.Id) as IBulkCraftKnowledge,
                nowUt,
                realSeconds);
            _onFollowing?.Invoke(_model.Following);
        }

        public void OnGameLoaded() => _model.OnGameLoaded();

        public void SayLaunchCountdown(double remainingSeconds, double lengthSeconds) => _model.SayLaunchCountdown(remainingSeconds, lengthSeconds);

        public void CancelLaunchCountdown() => _model.CancelLaunchCountdown();

        public void Dispose() => KerbcastApi.Identity -= _model.OnIdentity;

        /* Query throws for a capability that is unknown or unresolved; both are this Gonogo not offering it. */
        private T? Query<T>(string capability) where T : class
        {
            var kernel = _kernel();
            if (kernel == null)
            {
                return null;
            }
            try
            {
                return kernel.Query<T>(capability);
            }
            catch (Exception)
            {
                return null;
            }
        }
    }
}
