// mod/GonogoTestFlightUplink/TestFlightModuleFold.cs
// How a part's several reliability modules combine into one number. Pure
// (KSP-free) so the headless Tests project can enter it, the same carve-out
// TestFlightRepairScope follows.
//
// An RO engine carries one ITestFlightReliability module per failure mode, so
// every rated time and every base failure rate on the wire is already a fold
// over a list. A fold that SKIPS a term it could not read answers with the terms
// it could, and there is nothing in the answer to say a term is missing: the sum
// came out lower than the truth and the survival odds built on it came out
// higher.
using System.Collections.Generic;

namespace GonogoTestFlightUplink
{
    public static class TestFlightModuleFold
    {
        /// <summary>
        /// The sum over the part's modules, or null if ANY of them could not be
        /// read. A partial sum of failure rates understates the risk, and the
        /// survival probability derived from it is optimistic by an amount nobody
        /// downstream can see.
        ///
        /// <para>Null on an empty sequence too: a part with no reliability modules
        /// has no rate, and 0 per second reads as an engine that never fails.</para>
        /// </summary>
        public static double? Total(IEnumerable<double?> perModule)
        {
            double total = 0.0;
            var any = false;
            foreach (var value in perModule)
            {
                if (value == null) return null;
                total += value.Value;
                any = true;
            }
            return any ? total : null;
        }

        /// <summary>
        /// The largest reading over the part's modules, or null if ANY of them
        /// could not be read. The rating governs a burn budget and the survival
        /// horizon, so a max taken over only the readable modules quietly moves
        /// both: it is the highest rating we happened to see, presented as the
        /// part's rating.
        /// </summary>
        public static double? Highest(IEnumerable<double?> perModule)
        {
            double? highest = null;
            foreach (var value in perModule)
            {
                if (value == null) return null;
                if (highest == null || value.Value > highest.Value) highest = value;
            }
            return highest;
        }
    }
}
