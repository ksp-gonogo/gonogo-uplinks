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

        /// <param name="kerbcast">Kerbcast in this scene, normally <see cref="KerbcastApi.Instance"/>.</param>
        /// <param name="supports">Which API features this Kerbcast implements, normally <see cref="KerbcastApi.Supports"/>.</param>
        /// <param name="labels">Craft names and kinds, fed on the main thread.</param>
        /// <param name="kernel">The host's capability kernel.</param>
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
            Func<int, double?>? bodyMu = null)
        {
            _kerbcast = kerbcast;
            _kernel = kernel;
            _authority = new KerbcastAuthority(kerbcast, supports);
            _model = new KerbcastWorldModel(labels, supports, places, log, onFeedSites, launchSite, activeCraft, bodyMu);
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
        }

        public void OnGameLoaded() => _model.OnGameLoaded();

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
