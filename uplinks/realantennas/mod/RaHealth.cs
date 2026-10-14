using Sitrep.Contract;

namespace Gonogo.RealAntennasUplink
{
    /// <summary>The Uplink's health, from what it found of RealAntennas at Register.</summary>
    public static class RaHealth
    {
        /// <summary>
        /// Unavailable when the RealAntennas assembly is not loaded. Degraded when it is
        /// but its <c>Physics.ReceivedPower</c> could not be found, because
        /// <c>comms.linkMargin</c> then falls back to a geometry-only figure that ignores
        /// where each dish is aimed. Healthy otherwise.
        /// </summary>
        public static UplinkHealth Of(bool raLoaded, bool hasReceivedPower)
        {
            if (!raLoaded)
            {
                return new UplinkHealth(UplinkHealthState.Unavailable, "RealAntennas assembly not loaded");
            }
            return hasReceivedPower
                ? UplinkHealth.Healthy
                : new UplinkHealth(
                    UplinkHealthState.Degraded,
                    "RealAntennas Physics.ReceivedPower(RealAntenna, RealAntenna, float, float) not found: the link margin ignores where each dish is aimed");
        }
    }
}
