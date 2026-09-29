using System.Collections.Generic;

namespace GonogoRp1Uplink
{
    /// <summary>
    /// Pure mapper: the construction rate tables to the <c>rp1.constructionRates</c>
    /// dict. KSP-free, RP-1-free and side-effect-free.
    /// </summary>
    public static class Rp1ConstructionRatesCapture
    {
        /// <summary>The payload, or nothing when RP-1 is not running a career here.</summary>
        public static Dictionary<string, object?>? Build(Rp1ConstructionRatesRaw? raw)
        {
            if (raw == null)
            {
                return null;
            }
            return new Dictionary<string, object?>
            {
                ["refreshedAt"] = raw.RefreshedAt,
                ["constructions"] = Tables(raw.Constructions),
                ["facilityUpgrades"] = Facilities(raw.FacilityUpgrades),
            };
        }

        private static List<object?>? Tables(List<Rp1ConstructionRateTableRaw>? tables)
        {
            if (tables == null)
            {
                return null;
            }
            var rows = new List<object?>(tables.Count);
            foreach (var t in tables)
            {
                var steps = new List<object?>(t.Steps.Count);
                foreach (var s in t.Steps)
                {
                    steps.Add(new Dictionary<string, object?>
                    {
                        ["workRate"] = s.WorkRate,
                        ["costMultiplier"] = s.CostMultiplier,
                        ["costPerDay"] = s.CostPerDay,
                        ["finishesAt"] = s.FinishesAt,
                    });
                }
                rows.Add(new Dictionary<string, object?>
                {
                    ["id"] = t.Id,
                    ["steps"] = steps,
                });
            }
            return rows;
        }

        private static List<object?>? Facilities(List<Rp1FacilityUpgradeRateRaw>? facilities)
        {
            if (facilities == null)
            {
                return null;
            }
            var rows = new List<object?>(facilities.Count);
            foreach (var f in facilities)
            {
                rows.Add(new Dictionary<string, object?>
                {
                    ["facility"] = f.Facility,
                    ["costPerDay"] = f.CostPerDay,
                    ["buildSeconds"] = f.BuildSeconds,
                });
            }
            return rows;
        }
    }
}
