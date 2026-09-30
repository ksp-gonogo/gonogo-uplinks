// mod/GonogoTestFlightUplink/TestFlightReliabilityMap.cs
// Pure (KSP-free) mapper: per-engine reflection reads -> the testflight.reliability
// and testflight.reliabilityParts payloads, defined in this Uplink's contract
// slice. It builds the contract POCOs directly and the backend calls it, rather
// than each writing its own copy of the mapping: the two copies that used to
// exist were a corroborating pair, both green while the reflection layer
// underneath them returned nothing.
using System.Collections.Generic;

namespace GonogoTestFlightUplink
{
    public static class TestFlightReliabilityMap
    {
        /// <summary>
        /// The summary, carrying the binder's provenance: an install that regresses
        /// the binder is visible without another decompile.
        /// </summary>
        public static TestFlightReliabilitySummary Summary(
            string coverage,
            TestFlightBindingReport? binding = null) => new()
        {
            Coverage = coverage,
            BoundMembers = binding?.Bound,
            UnboundMembers = binding?.Unbound,
        };

        public static List<TestFlightReliabilityPart> Parts(IEnumerable<EngineReliabilityRaw> engines)
        {
            var list = new List<TestFlightReliabilityPart>();
            var seen = new Dictionary<string, int>();
            foreach (var e in engines)
            {
                // "<flightID>:<occurrence>". A part can carry more than one active
                // core, and a bare flightID would silently merge the rows.
                seen.TryGetValue(e.PartId, out var n);
                seen[e.PartId] = n + 1;

                list.Add(new TestFlightReliabilityPart
                {
                    PartId = e.PartId + ":" + n,
                    Title = e.Title,
                    Condition = ConditionOf(e),
                    ConditionDetail = Clamp(e.FailureTitles, 120),
                    Survival = e.Survival,
                    SurvivalHorizonSeconds = e.Survival == null ? null : e.SurvivalHorizonSeconds,
                    Budgets = BurnBudgets(e),
                    Configuration = e.Configuration,
                    FlightData = e.FlightData,
                });
            }
            return list;
        }

        /// <summary>
        /// TestFlight's own part status is the condition, and there is no
        /// two-tier failure grade to read: <c>CanAttemptRepair()</c> says whether
        /// a failure class can be repaired at all, not how severe it is, so
        /// nothing here ever emits "failed-critical".
        ///
        /// <para>An unread status is "unknown", never "nominal". That substitution
        /// is what the old layer made, on every part, on every install.</para>
        /// </summary>
        private static string ConditionOf(EngineReliabilityRaw e)
        {
            if (e.PartStatus == null) return "unknown";
            return e.PartStatus.Value != 0 ? "failed" : "nominal";
        }

        /// <summary>
        /// The two rated-burn budgets. They are INDEPENDENT ratings, not two views
        /// of one: under RO a BNTR rates 36000 s cumulative against 3600 s
        /// continuous, so a single "remaining rated burn" slot has to pick one and
        /// be wrong about the other. Each names its scope in the label so the
        /// number on screen cannot be read as the other one.
        ///
        /// <para>When the two rated limits are EQUAL only the cumulative one is
        /// emitted, labelled plainly "rated burn": that mirrors TestFlight's own
        /// GUI collapsing to a single field, and avoids two identical rows.</para>
        ///
        /// <para>A null run time is never substituted with 0: zero used reads as a
        /// brand-new part. The budget is still carried (the rating is real
        /// information) but with no Consumed, so it can never select a row.</para>
        /// </summary>
        private static List<TestFlightReliabilityBudget>? BurnBudgets(EngineReliabilityRaw e)
        {
            var budgets = new List<TestFlightReliabilityBudget>();
            var collapsed = e.RatedCumulativeSeconds is > 0
                && e.RatedContinuousSeconds is > 0
                && e.RatedCumulativeSeconds.Value == e.RatedContinuousSeconds.Value;

            if (!collapsed && e.RatedContinuousSeconds is > 0)
            {
                budgets.Add(Burn("burn.continuous", "continuous rated burn",
                    e.RatedContinuousSeconds, e.RunContinuousSeconds));
            }
            if (e.RatedCumulativeSeconds is > 0)
            {
                budgets.Add(Burn("burn.cumulative", collapsed ? "rated burn" : "cumulative rated burn",
                    e.RatedCumulativeSeconds, e.RunCumulativeSeconds));
            }
            return budgets.Count == 0 ? null : budgets;
        }

        private static TestFlightReliabilityBudget Burn(string id, string label, double? limit, double? used) => new()
        {
            Id = id,
            Label = label,
            // Past the rating, failure probability begins climbing along a
            // config-authored curve. Nothing stops and nothing is guaranteed.
            Kind = "risk-ramp",
            Consumed = used.HasValue && limit is > 0 ? used.Value / limit.Value : null,
            UsedSeconds = used,
            LimitSeconds = limit,
        };

        private static string? Clamp(string? text, int max)
        {
            if (string.IsNullOrEmpty(text)) return null;
            return text!.Length <= max ? text : text.Substring(0, max);
        }
    }
}
