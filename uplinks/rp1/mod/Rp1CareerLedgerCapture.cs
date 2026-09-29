using System.Collections.Generic;

namespace GonogoRp1Uplink
{
    /// <summary>
    /// Pure mapper: RP-1's monthly ledger to the <c>rp1.careerLedger</c> dict.
    /// KSP-free, RP-1-free and side-effect-free.
    /// </summary>
    public static class Rp1CareerLedgerCapture
    {
        /// <summary>The payload, or nothing when RP-1's log handler could not be read.</summary>
        public static Dictionary<string, object?>? Build(Rp1CareerLedgerRaw? raw)
        {
            if (raw == null || !raw.Available)
            {
                return null;
            }

            var periods = new List<object?>(raw.Periods.Count);
            foreach (var p in raw.Periods)
            {
                var row = new Dictionary<string, object?>
                {
                    ["startUt"] = p.StartUt,
                    ["endUt"] = p.EndUt,
                    ["open"] = p.Open,
                };
                foreach (var figure in p.Figures)
                {
                    row[figure.Key] = figure.Value;
                }
                periods.Add(row);
            }

            return new Dictionary<string, object?>
            {
                ["enabled"] = raw.Enabled,
                ["periods"] = periods,
            };
        }
    }
}
