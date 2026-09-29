using System.Collections.Generic;

namespace GonogoRp1Uplink
{
    /// <summary>
    /// Pure mapper: the research rate table to the <c>rp1.researchRates</c>
    /// dict. KSP-free, RP-1-free and side-effect-free.
    /// </summary>
    public static class Rp1ResearchRatesCapture
    {
        /// <summary>The payload, or nothing when RP-1 is not running a career here.</summary>
        public static Dictionary<string, object?>? Build(Rp1ResearchRatesRaw? raw)
        {
            if (raw == null)
            {
                return null;
            }
            var steps = new List<object?>(raw.Steps.Count);
            foreach (var s in raw.Steps)
            {
                steps.Add(new Dictionary<string, object?>
                {
                    ["workRate"] = s.WorkRate,
                    ["researcherSalaryPerDay"] = s.ResearcherSalaryPerDay,
                    ["unlockCreditPerDay"] = s.UnlockCreditPerDay,
                    ["finishesAt"] = s.FinishesAt,
                });
            }
            return new Dictionary<string, object?>
            {
                ["refreshedAt"] = raw.RefreshedAt,
                ["techId"] = raw.TechId,
                ["steps"] = steps,
            };
        }
    }
}
