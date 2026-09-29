using System.Collections.Generic;

namespace GonogoRp1Uplink
{
    /// <summary>
    /// Pure mapper: RP-1's budget to the <c>rp1.budget</c> dict. KSP-free,
    /// RP-1-free and side-effect-free.
    /// </summary>
    public static class Rp1BudgetCapture
    {
        /// <summary>The payload, or nothing when RP-1 is not running a career here.</summary>
        public static Dictionary<string, object?>? Build(Rp1BudgetRaw? raw)
        {
            if (raw == null)
            {
                return null;
            }
            return new Dictionary<string, object?>
            {
                ["refreshedAt"] = raw.RefreshedAt,
                ["day"] = Period(raw.Day),
                ["month"] = Period(raw.Month),
                ["year"] = Period(raw.Year),
                ["reputation"] = raw.Reputation,
                ["subsidyPerDay"] = raw.SubsidyPerDay,
                ["subsidyMinPerDay"] = raw.SubsidyMinPerDay,
                ["subsidyMaxPerDay"] = raw.SubsidyMaxPerDay,
                ["subsidyMaxRep"] = raw.SubsidyMaxRep,
                ["reputationDecayPerDay"] = raw.ReputationDecayPerDay,
                ["reputationDecayPerYear"] = raw.ReputationDecayPerYear,
                ["unlockCreditBalance"] = raw.UnlockCreditBalance,
                ["forecast"] = Forecast(raw.Forecast),
            };
        }

        private static Dictionary<string, object?>? Period(Rp1BudgetPeriodRaw? period)
        {
            if (period == null)
            {
                return null;
            }
            return new Dictionary<string, object?>
            {
                ["span"] = period.Span,
                ["fundsDelta"] = period.FundsDelta,
                ["facilities"] = period.Facilities,
                ["integrationTeams"] = period.IntegrationTeams,
                ["researchTeams"] = period.ResearchTeams,
                ["astronauts"] = period.Astronauts,
                ["upkeep"] = period.Upkeep,
                ["upkeepBeforeModifiers"] = period.UpkeepBeforeModifiers,
                ["upkeepModifiers"] = period.UpkeepModifiers,
                ["subsidy"] = period.Subsidy,
                ["net"] = period.Net,
                ["rollout"] = period.Rollout,
                ["constructions"] = period.Constructions,
                ["programBudget"] = period.ProgramBudget,
                ["balance"] = period.Balance,
                ["unlockCredit"] = period.UnlockCredit,
            };
        }

        private static List<object?>? Forecast(List<Rp1BudgetForecastRaw>? samples)
        {
            if (samples == null)
            {
                return null;
            }
            var rows = new List<object?>(samples.Count);
            foreach (var s in samples)
            {
                rows.Add(new Dictionary<string, object?>
                {
                    ["horizon"] = s.Horizon,
                    ["fundsDelta"] = s.FundsDelta,
                });
            }
            return rows;
        }
    }
}
