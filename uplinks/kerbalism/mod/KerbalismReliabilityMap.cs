using System.Collections.Generic;
using GonogoKerbalismUplink;

namespace Gonogo.KerbalismUplink
{
    /// <summary>
    /// Pure mappers from the reflected ReliabilityRaw to the
    /// <c>kerbalism.reliability</c> and <c>kerbalism.reliabilityParts</c>
    /// payloads. KSP-free so it is headless-testable.
    ///
    /// <para>What Kerbalism can honestly fill, and nothing else. It has NO per-part
    /// probability: the only probabilities in the assembly are the save-wide
    /// difficulty settings criticalChance / safeModeChance, consulted once at the
    /// instant a break resolves. So the per-part contribution is a Condition plus
    /// at most one "service" budget.</para>
    /// </summary>
    public static class KerbalismReliabilityMap
    {

        /// <summary>Kerbalism's own status vocabulary (FailuresManager.StatusString), kept verbatim.</summary>
        private const string Busted = "busted";
        private const string NeedsRepair = "needs repair";
        private const string NeedsService = "needs service";

        /// <summary>
        /// The vessel-level summary. The rollup is filled only while Kerbalism is
        /// modelling and the craft has modelled parts: nothing is rolled up about a
        /// craft nobody is watching.
        /// </summary>
        public static KerbalismReliabilitySummary Summary(
            ReliabilityRaw raw,
            ReliabilityPreferencesRaw prefs,
            string coverage)
        {
            var summary = new KerbalismReliabilitySummary { Coverage = coverage };
            if (coverage != ReliabilityCoverage.Modeled || raw.Parts.Count == 0)
            {
                return summary;
            }

            var worstMtbf = double.MaxValue;
            // Null the moment one part's flag is unreadable. A tally is only a
            // tally of the whole vessel: "1 broken" over a list where a second
            // part could not be read is a smaller number than the truth, and it
            // is the number an operator decides on.
            int? broken = 0;
            int? serviceDue = 0;
            foreach (var p in raw.Parts)
            {
                if (p.MtbfSeconds is > 0 && p.MtbfSeconds.Value < worstMtbf) worstMtbf = p.MtbfSeconds.Value;

                if (p.Broken == null) broken = serviceDue = null;
                else if (p.Broken == true) broken++;
                else if (p.NeedsService == null) serviceDue = null;
                else if (p.NeedsService == true) serviceDue++;
            }

            // No positive MTBF anywhere means nothing on the vessel is modelled as
            // failing over time; a sentinel MaxValue would read as a real number.
            summary.WorstMtbfSeconds = worstMtbf == double.MaxValue ? null : worstMtbf;
            summary.BrokenPartCount = broken;
            summary.ServiceDuePartCount = serviceDue;
            summary.CriticalChance = prefs.CriticalChance;
            summary.SafeModeChance = prefs.SafeModeChance;
            summary.RequireRepairKits = prefs.RequireRepairKits;
            summary.IncentiveRedundancy = prefs.IncentiveRedundancy;
            return summary;
        }

        /// <summary>
        /// The <c>AvailablePart.name</c> of the item a Kerbalism repair consumes.
        /// One authority for the id, read by the wire mapper below and by
        /// <c>KerbalismReflection</c>'s own kit counting and taking.
        /// </summary>
        public const string RepairKitPartName = "evaRepairKit";

        /// <summary>
        /// Kerbalism's kit arithmetic: a critical failure costs two, anything else
        /// one. Read off its <c>Repair()</c> path.
        ///
        /// <para>Here rather than at either call site because there are now two:
        /// <see cref="RepairCostOf"/>, which STATES the cost on the wire, and
        /// <c>KerbalismReflection.AttemptRepair</c>, which CHARGES it. Two copies
        /// of <c>critical ? 2 : 1</c> is how the number a console shows comes to
        /// disagree with the number a repair takes.</para>
        /// </summary>
        public static int KitsForRepair(bool? critical) => critical == true ? 2 : 1;

        /// <summary>
        /// What repairing this part consumes, for <c>KerbalismReliabilityPart.RepairCost</c>.
        ///
        /// <para>Null means nothing is consumed, which the contract distinguishes
        /// from a cost of zero. Three cases reach it: the part is not BROKEN (a
        /// service-due part is cleared by the same <c>Repair()</c> and costs no
        /// kits), kits are switched off in the install's reliability preferences,
        /// or that preference could not be read at all.</para>
        ///
        /// <para>A part whose broken flag could not be read joins the first case
        /// and states no cost, on the same understate-rather-than-block
        /// reasoning.</para>
        ///
        /// <para>The last two collapse deliberately, and into the same expression
        /// <c>AttemptRepair</c> uses (<c>RequireRepairKits == true</c>), so the
        /// cost stated here cannot disagree with the cost charged there. Treating
        /// an unreadable preference as "no kits" also fails in the recoverable
        /// direction: understating a cost lets the operator dispatch a repair that
        /// answers "no-kits" after one round trip, where overstating one blocks
        /// the command outright.</para>
        /// </summary>
        public static List<KerbalismRepairCostItem>? RepairCostOf(
            ReliabilityPartRaw p,
            bool? requireRepairKits)
        {
            if (p.Broken != true) return null;
            if (requireRepairKits != true) return null;
            return new List<KerbalismRepairCostItem>
            {
                new KerbalismRepairCostItem
                {
                    Name = RepairKitPartName,
                    Quantity = KitsForRepair(p.Critical),
                },
            };
        }

        public static List<KerbalismReliabilityPart> Parts(
            ReliabilityRaw raw,
            string coverage,
            bool? requireRepairKits)
        {
            var list = new List<KerbalismReliabilityPart>();
            if (coverage != ReliabilityCoverage.Modeled) return list;

            var seen = new Dictionary<string, int>();
            foreach (var p in raw.Parts)
            {
                // PartId is "<rawId>:<occurrence>" and is never a bare flightID.
                // ReliabilityInfo's proto constructor sets partId = 0 for every part
                // on an unloaded vessel, and BuildList iterates MODULES, so a part
                // carrying two Reliability modules (the install's own configs do
                // this, one redundancy block per subsystem) yields two entries with
                // the same id. Either collision would silently merge two rows.
                seen.TryGetValue(p.PartId, out var n);
                seen[p.PartId] = n + 1;

                list.Add(new KerbalismReliabilityPart
                {
                    PartId = p.PartId + ":" + n,
                    Title = p.Title,
                    Condition = ConditionOf(p),
                    ConditionDetail = ConditionDetailOf(p),
                    RepairTrait = string.IsNullOrEmpty(p.RepairTrait) ? null : p.RepairTrait,
                    RepairLevel = p.RepairLevel,
                    RepairCost = RepairCostOf(p, requireRepairKits),
                    Budgets = ServiceBudget(p, raw.Ut),
                    // ReliabilityInfo.group is a redundancy SET name ("these parts
                    // are each other's spares"), not a category.
                    RedundancyGroup = string.IsNullOrEmpty(p.Group) ? null : p.Group,
                    MtbfSeconds = p.MtbfSeconds,
                    Quality = p.Quality,
                });
            }
            return list;
        }

        /// <summary>
        /// The coverage decision as a PURE function of the two things it reads, so
        /// it can be tested without standing up reflection into a live Kerbalism.
        /// </summary>
        public static string ComputeCoverage(
            IReadOnlyDictionary<string, bool> features,
            ReliabilityPreferencesRaw prefs)
        {
            if (features.Count == 0) return ReliabilityCoverage.Indeterminate;
            if (!features.TryGetValue("Reliability", out var on)) return ReliabilityCoverage.Indeterminate;
            if (!on) return ReliabilityCoverage.Disabled;
            if (prefs.MtbfFailures == null) return ReliabilityCoverage.Indeterminate;
            if (prefs.MtbfFailures == false) return ReliabilityCoverage.Disabled;
            return ReliabilityCoverage.Modeled;
        }

        /// <summary>
        /// Whether Kerbalism is modelling reliability at all. Lives here rather than beside the backend because the backend reads
        /// <c>FlightGlobals</c> and so cannot be compiled into a test assembly,
        /// and a decision nothing can test is the kind that quietly stops being
        /// true.
        /// </summary>
        public static bool CanServe(
            IReadOnlyDictionary<string, bool> features,
            ReliabilityPreferencesRaw prefs) =>
            ComputeCoverage(features, prefs) != ReliabilityCoverage.Disabled;

        /// <summary>
        /// The contract's five-value condition, including its "unknown" arm.
        ///
        /// <para>That arm was written and then unreachable: the reflected flags
        /// substituted <c>false</c> for a failed read, so a part nobody could
        /// ask about reported "nominal", which is the one answer here an
        /// operator acts on by doing nothing.</para>
        ///
        /// <para>A broken part whose criticality is unreadable is still
        /// <c>failed</c>, because <c>failed-critical</c> is a claim about the
        /// severity class and the base failure is the one we actually read.</para>
        /// </summary>
        private static string ConditionOf(ReliabilityPartRaw p)
        {
            if (p.Broken == null) return "unknown";
            if (p.Broken == true) return p.Critical == true ? "failed-critical" : "failed";
            if (p.NeedsService == null) return "unknown";
            return p.NeedsService == true ? "service-due" : "nominal";
        }

        /// <summary>
        /// Kerbalism's own word for the condition, or null when there is no word
        /// to quote: an unread flag has no vocabulary, and "needs repair" would
        /// be gonogo's phrasing rather than the provider's.
        /// </summary>
        private static string? ConditionDetailOf(ReliabilityPartRaw p)
        {
            if (p.Broken == null) return null;
            if (p.Broken == true) return p.Critical == true ? Busted : p.Critical == null ? null : NeedsRepair;
            return p.NeedsService == true ? NeedsService : null;
        }

        /// <summary>
        /// The one dimension Kerbalism counts: time since the last clean inspection,
        /// against half an effective MTBF (Kerbalism's own <c>maintenance_after =
        /// last_inspection + mtbf * 0.5</c>). <c>ReliabilityInfo.mtbf</c> is already
        /// <c>EffectiveMTBF(quality, mtbf)</c>, so the quality multiplier is in it.
        ///
        /// <para>Omitted entirely when either input is missing, and a
        /// <c>service-due</c> row then renders with no number, which is correct:
        /// <c>NeedsMaintenance()</c> has TWO independent sources (an explicit wear
        /// flag an EVA inspection sets, and this time-based clock) and they are
        /// unrelated. A part inspected today and found 40% worn is service-due NOW
        /// with its maintenance clock far in the future.</para>
        /// </summary>
        private static List<KerbalismReliabilityBudget>? ServiceBudget(ReliabilityPartRaw p, double ut)
        {
            if (p.MtbfSeconds is not > 0 || p.LastInspection is not > 0) return null;

            var limit = p.MtbfSeconds.Value * 0.5;
            var used = ut - p.LastInspection.Value;
            if (used < 0) used = 0;

            return new List<KerbalismReliabilityBudget>
            {
                new()
                {
                    Id = "service",
                    Label = "service",
                    Kind = "schedule",
                    Consumed = used / limit,
                    UsedSeconds = used,
                    LimitSeconds = limit,
                },
            };
        }
    }
}
