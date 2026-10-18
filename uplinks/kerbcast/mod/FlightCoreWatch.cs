namespace Gonogo.KerbcastUplink
{
    /// <summary>
    /// Decides when a capture core that is down in a flight scene has been down
    /// long enough to be a fault rather than the scene still loading.
    ///
    /// <para>Kerbcast's core exists only once its flight-scene Awake has run, so
    /// it reads inactive for a moment after the scene becomes the loaded one.
    /// The window is measured in real seconds from the first in-flight sample,
    /// and restarts whenever the scene is left or the core comes up.</para>
    /// </summary>
    public sealed class FlightCoreWatch
    {
        /// <summary>Seconds a flight scene may run with no core before it is a fault.</summary>
        public const double SettleSeconds = 10;

        private double? _downSince;

        /// <summary>True once the core has been down for the whole settle window.</summary>
        public bool Settled { get; private set; }

        /// <summary>Feeds one capture tick, in tick order, with a monotonic clock in seconds.</summary>
        public void Observe(bool inFlight, bool coreActive, double nowSeconds)
        {
            if (!inFlight || coreActive)
            {
                _downSince = null;
                Settled = false;
                return;
            }
            _downSince ??= nowSeconds;
            Settled = nowSeconds - _downSince.Value >= SettleSeconds;
        }
    }
}
