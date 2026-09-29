using System.Collections.Generic;

namespace GonogoRp1Uplink
{
    /// <summary>
    /// RP-1's monthly ledger as the main thread read it. Plain data, so the mapper
    /// is unit-testable with no game at all.
    /// </summary>
    public sealed class Rp1CareerLedgerRaw
    {
        public double Ut;

        /// <summary>
        /// RP-1's log handler was live and the periods below came off it. False
        /// publishes the channel's absence, stamped at the tick that found it.
        /// </summary>
        public bool Available;

        /// <summary>
        /// Whether RP-1 is keeping the log. False is not an empty ledger: a career
        /// with logging off records nothing and never will.
        /// </summary>
        public bool? Enabled;

        /// <summary>Every period RP-1 holds, oldest first.</summary>
        public List<Rp1LedgerPeriodRaw> Periods = new List<Rp1LedgerPeriodRaw>();
    }

    /// <summary>One of RP-1's log periods: a calendar month under its default settings.</summary>
    public sealed class Rp1LedgerPeriodRaw
    {
        public double? StartUt;
        public double? EndUt;

        /// <summary>
        /// The period RP-1 is still writing to. Its closing figures are absent,
        /// because RP-1 records them only when it moves on to the next period.
        /// </summary>
        public bool Open;

        /// <summary>
        /// Each figure by its wire name, as RP-1 recorded it. A figure RP-1 would
        /// not give is null, and every closing figure of the open period is null.
        /// </summary>
        public Dictionary<string, double?> Figures = new Dictionary<string, double?>();
    }
}
