using Sitrep.Contract;

namespace Gonogo.KosUplink
{
    /// <summary>
    /// <see cref="KosExtension"/>'s <see cref="ISitrepUplink.Health"/> state
    /// machine, as a pure function: mirrors
    /// <c>Gonogo.KerbcastUplink.KerbcastHealth</c> (same split rationale: a
    /// pure function over plain inputs, headless-tested, while the live
    /// uplink only ever touches kOS/Unity).
    ///
    /// <para><b>Divergence from the original design doc:</b> the
    /// telemetry-mod design's original framing for kOS health was "no active
    /// CPU selected": but "which CPU is active" is a CLIENT-side concept
    /// (<c>KosConfig.activeCpu</c> in the app), not something this mod-side
    /// Uplink can observe; the mod has no notion of which CPU the operator
    /// has picked in the browser. The mod-honest signal this reports instead
    /// is processor-list emptiness, <c>kos.processors</c>' own captured CPU
    /// count (<see cref="KosExtension.HandleProcessors"/>): whether the
    /// active vessel carries any kOS CPU at all. That is a strictly weaker
    /// claim than "a CPU is selected" (a vessel can have CPUs and still have
    /// none selected client-side), but it is the honest ceiling of what a
    /// mod-side <see cref="ISitrepUplink.Health"/> can report.</para>
    /// </summary>
    public static class KosHealth
    {
        /// <summary>
        /// Decides the health state.
        /// </summary>
        /// <param name="unavailableReason">
        /// Non-null when the uplink went inert at registration (the kOS
        /// version guard failed: kOS absent or its reflection surface
        /// moved, see <see cref="KosVersionGuard"/>). Wins over everything
        /// else.
        /// </param>
        /// <param name="sampledOnce">Whether the main-thread processor capture has run at least once.</param>
        /// <param name="cpuCount">CPUs seen on the active vessel at the last sample.</param>
        public static UplinkHealth Evaluate(string? unavailableReason, bool sampledOnce, int cpuCount)
        {
            if (unavailableReason != null)
            {
                return new UplinkHealth(UplinkHealthState.Unavailable, unavailableReason);
            }
            if (!sampledOnce || cpuCount <= 0)
            {
                // Nothing to run a script on is the normal state outside a
                // flight, and on a vessel without a kOS CPU. Not a fault.
                return new UplinkHealth(UplinkHealthState.Healthy,
                    "idle, no kOS CPU on the active vessel");
            }
            return new UplinkHealth(UplinkHealthState.Healthy,
                cpuCount == 1 ? "1 CPU" : cpuCount + " CPUs");
        }
    }
}
