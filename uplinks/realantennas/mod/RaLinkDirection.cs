namespace Gonogo.RealAntennasUplink
{
    /// <summary>
    /// Resolves a RACommLink's forward/reverse rates onto the operator's
    /// downlink/uplink axis, orientation-aware.
    ///
    /// <para><b>Why this is not a fixed mapping.</b> RA's <c>FwdDataRate</c> is the
    /// throughput in the link's stored <c>a -&gt; b</c> direction, and RA assigns
    /// <c>a</c>/<c>b</c> by node index, not by vessel-vs-home role
    /// (<c>Precompute</c> calls <c>MakeLink(..., a: Nodes[x], b: Nodes[y])</c> with
    /// <c>x &lt;= y</c>). So whether <c>Fwd</c> is the vessel-to-home (downlink) or
    /// home-to-vessel (uplink) direction depends on the arbitrary registration
    /// order of the two endpoints, which is exactly why the old fixed
    /// <c>Down = Fwd, Up = Rev</c> mapping was flagged in-code as possibly swapped.
    /// RA's own <c>RACommNetwork.MaxDataRateToHome</c> resolves it the same way this
    /// does: by checking which endpoint the path is traversing from.</para>
    ///
    /// <para>Pure and KSP-free so it is exercised headlessly; the caller supplies
    /// <paramref name="forwardIsDownlink"/> (whether the link's <c>a</c> node is
    /// the vessel side, so <c>a -&gt; b</c> runs vessel-to-home).</para>
    /// </summary>
    public static class RaLinkDirection
    {
        /// <summary>
        /// (uplink = home-to-vessel, downlink = vessel-to-home) bits/sec.
        /// <paramref name="forwardIsDownlink"/> true means <c>Fwd</c> is the
        /// vessel-to-home direction, so downlink is <c>Fwd</c> and uplink is
        /// <c>Rev</c>; false swaps them.
        /// </summary>
        public static (double up, double down) Resolve(
            bool forwardIsDownlink, double forwardBitsPerSec, double reverseBitsPerSec) =>
            forwardIsDownlink
                ? (reverseBitsPerSec, forwardBitsPerSec)
                : (forwardBitsPerSec, reverseBitsPerSec);

        /// <summary>
        /// The antennas and rate a hop reads, from a link whose stored
        /// <c>a -&gt; b</c> direction may run with or against the hop.
        /// <paramref name="fromIsForwardEnd"/> is whether the hop's near end is the
        /// link's <c>a</c> node; the hop's transmitter and receiver are then the
        /// forward pair, otherwise the reverse pair, and the rate the other way is
        /// the reverse rate or the forward one to match.
        /// </summary>
        public static (T? Transmit, T? Receive, double? OppositeBitsPerSec) ForHop<T>(
            bool fromIsForwardEnd,
            T? forwardTransmit,
            T? forwardReceive,
            T? reverseTransmit,
            T? reverseReceive,
            double? forwardBitsPerSec,
            double? reverseBitsPerSec) =>
            fromIsForwardEnd
                ? (forwardTransmit, forwardReceive, reverseBitsPerSec)
                : (reverseTransmit, reverseReceive, forwardBitsPerSec);
    }
}
