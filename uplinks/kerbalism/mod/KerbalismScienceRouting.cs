using Sitrep.Contract;

namespace Gonogo.KerbalismUplink
{
    /// <summary>
    /// Chooses which <see cref="IDelayedScienceSink"/> entry a retrieved science increment goes to:
    /// science Kerbalism retrieves while a vessel is being recovered at the Space Center is credited
    /// at once, and every other increment (a transmission from a craft in flight) rides its signal
    /// delay. Kept free of Harmony and KSP types so it runs under plain unit tests.
    /// </summary>
    internal static class KerbalismScienceRouting
    {
        /// <summary>
        /// True between the start and the end of one stock vessel recovery. Recovery runs on the main
        /// thread and does not nest, so one flag is enough.
        /// </summary>
        public static bool Recovering { get; private set; }

        public static void BeginRecovery() => Recovering = true;

        public static void EndRecovery() => Recovering = false;

        public static void Route(
            IDelayedScienceSink sink, string vesselId, double amount, double ut, string origin)
        {
            if (Recovering)
            {
                sink.RecordRecoveredScience(vesselId, amount, ut, origin);
                return;
            }

            sink.RecordDelayedScienceIncrement(vesselId, amount, ut, origin);
        }
    }
}
