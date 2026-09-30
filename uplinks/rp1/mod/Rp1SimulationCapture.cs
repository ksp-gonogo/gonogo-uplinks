using System.Collections.Generic;

namespace GonogoRp1Uplink
{
    /// <summary>
    /// Pure mapper: turns RP-1's two simulation answers into the
    /// <c>rp1.simulation</c> dict. KSP-free, so it is unit tested headless.
    /// </summary>
    public static class Rp1SimulationCapture
    {
        /// <summary>The kind of a simulation started on the pad.</summary>
        public const string LaunchKind = "Launch";

        /// <summary>The kind of a simulation placed straight into orbit.</summary>
        public const string OrbitKind = "Orbit";

        /// <summary>
        /// The payload, or <c>null</c> when RP-1 cannot say whether this is a
        /// simulation at all. The kind is stated only while one is running,
        /// because RP-1 keeps the last dialog choice between simulations.
        /// </summary>
        /// <param name="simulated">RP-1's <c>IsSimulatedFlight</c>, or null when it cannot answer.</param>
        /// <param name="inOrbit">RP-1's <c>SimulateInOrbit</c>, or null when it cannot answer.</param>
        public static Dictionary<string, object?>? Build(bool? simulated, bool? inOrbit)
        {
            if (simulated == null)
            {
                return null;
            }
            var active = simulated.Value;
            return new Dictionary<string, object?>
            {
                ["active"] = active,
                ["kind"] = !active || inOrbit == null ? null : inOrbit.Value ? OrbitKind : LaunchKind,
            };
        }
    }
}
