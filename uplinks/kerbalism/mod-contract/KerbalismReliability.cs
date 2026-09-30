using System.Collections.Generic;
using Sitrep.Contract;
#if SITREP_CODEGEN
using Reinforced.Typings.Attributes;
#endif

namespace GonogoKerbalismUplink;

/// <summary>
/// Kerbalism's reliability picture of the craft: whether it is modelling part
/// failures at all, and the vessel-level figures that only mean anything while it
/// is. Published on <c>kerbalism.reliability</c>, and only while Kerbalism's
/// reliability feature and its MTBF failures are not definitely switched off.
///
/// <para>The four difficulty settings ride here because they are save-wide, not
/// per part: how likely a failure is to be the critical class, how likely one is
/// absorbed as a safe-mode reset, whether a repair needs kits, and whether a
/// breaking part extends its redundant siblings' lives.</para>
/// </summary>
[SitrepContract]
#if SITREP_CODEGEN
[TsInterface]
#endif
[SitrepTopic("kerbalism.reliability")]
public class KerbalismReliabilitySummary
{
    /// <summary>
    /// <c>modeled</c> when Kerbalism is breaking parts in this save, or
    /// <c>indeterminate</c> when it could not read its own switch. The topic is not
    /// published at all when either switch is definitely off.
    /// </summary>
    [SitrepUnit(Units.Enumeration)]
    public string? Coverage { get; set; }

    /// <summary>
    /// The shortest mean time between failures on the vessel, Kerbalism's "what
    /// fails first" figure. Null when no part is modelled as failing over time.
    /// </summary>
    [SitrepUnit(Units.Seconds)]
    public double? WorstMtbfSeconds { get; set; }

    /// <summary>How many modelled parts are broken. Null when any part's broken flag could not be read.</summary>
    [SitrepUnit(Units.Count)]
    public int? BrokenPartCount { get; set; }

    /// <summary>
    /// How many intact parts Kerbalism says need service: the engineer's preventive
    /// work list. Null when any part's state could not be read.
    /// </summary>
    [SitrepUnit(Units.Count)]
    public int? ServiceDuePartCount { get; set; }

    /// <summary>Given a failure happens, the chance it is the critical class. A save-wide difficulty setting, never a per-part probability.</summary>
    [SitrepUnit(Units.Ratio)]
    public double? CriticalChance { get; set; }

    /// <summary>Given a failure falls due on an uncrewed vessel, the chance it is absorbed as a safe-mode reset instead of a break.</summary>
    [SitrepUnit(Units.Ratio)]
    public double? SafeModeChance { get; set; }

    /// <summary>Whether a repair consumes EVA repair kits.</summary>
    [SitrepUnit(Units.Flag)]
    public bool? RequireRepairKits { get; set; }

    /// <summary>Whether a breaking part extends the lives of its redundant siblings, which moves their maintenance clocks with no event the operator saw.</summary>
    [SitrepUnit(Units.Flag)]
    public bool? IncentiveRedundancy { get; set; }
}

/// <summary>
/// One Kerbalism reliability module aboard the craft: a part carrying two modules
/// yields two entries. Published on <c>kerbalism.reliabilityParts</c>.
///
/// <para>Kerbalism has no per-part failure probability, so nothing here forecasts
/// survival: the per-part picture is a condition plus at most one service
/// budget.</para>
/// </summary>
[SitrepContract]
#if SITREP_CODEGEN
[TsInterface]
#endif
[SitrepTopic("kerbalism.reliabilityParts", isArray: true)]
public class KerbalismReliabilityPart
{
    /// <summary>
    /// <c>"&lt;flightID&gt;:&lt;occurrence&gt;"</c>, unique within one payload and
    /// the id <c>kerbalism.repair</c> addresses. Never a bare flightID: an unloaded
    /// vessel reports every part as 0, and one part can carry several modules.
    /// </summary>
    [SitrepUnit(Units.Id)]
    public string? PartId { get; set; }

    /// <summary>The module's title, which names the subsystem rather than the part.</summary>
    [SitrepUnit(Units.Text)]
    public string? Title { get; set; }

    /// <summary>One of <c>nominal</c>, <c>service-due</c>, <c>failed</c>, <c>failed-critical</c> or <c>unknown</c>. An unread flag is <c>unknown</c>, never <c>nominal</c>.</summary>
    [SitrepUnit(Units.Enumeration)]
    public string? Condition { get; set; }

    /// <summary>Kerbalism's own word for the condition ("busted", "needs repair", "needs service"), or null when there is none to quote.</summary>
    [SitrepUnit(Units.Text)]
    public string? ConditionDetail { get; set; }

    /// <summary>
    /// The crew trait Kerbalism requires for a repair, already raised for a critical
    /// failure. Several traits are comma-separated; null means anyone may.
    /// </summary>
    [SitrepUnit(Units.Text)]
    public string? RepairTrait { get; set; }

    /// <summary>The experience level that trait must hold, raised with it. Null when Kerbalism states none.</summary>
    [SitrepUnit(Units.Count)]
    public int? RepairLevel { get; set; }

    /// <summary>
    /// What repairing this part in its current condition consumes. Null means
    /// nothing is consumed: a service is free, and so is every repair when the save
    /// does not require kits.
    /// </summary>
    public IReadOnlyList<KerbalismRepairCostItem>? RepairCost { get; set; }

    /// <summary>The service clock, when both its inputs could be read. Null otherwise.</summary>
    public IReadOnlyList<KerbalismReliabilityBudget>? Budgets { get; set; }

    /// <summary>The redundancy set this module belongs to: parts that are each other's spares. Null when it has none.</summary>
    [SitrepUnit(Units.Text)]
    public string? RedundancyGroup { get; set; }

    /// <summary>The module's effective mean time between failures, quality included.</summary>
    [SitrepUnit(Units.Seconds)]
    public double? MtbfSeconds { get; set; }

    /// <summary>Whether the part was built to Kerbalism's high-quality standard, which lengthens its MTBF.</summary>
    [SitrepUnit(Units.Flag)]
    public bool? Quality { get; set; }
}

/// <summary>
/// One consumed dimension of a part's life. Kerbalism counts exactly one: the time
/// since the last clean inspection against half the effective MTBF.
/// </summary>
[SitrepContract]
#if SITREP_CODEGEN
[TsInterface]
#endif
public class KerbalismReliabilityBudget
{
    /// <summary>The budget's id: <c>service</c>.</summary>
    [SitrepUnit(Units.Id)]
    public string? Id { get; set; }

    /// <summary>The lower-case noun an operator reads for it.</summary>
    [SitrepUnit(Units.Text)]
    public string? Label { get; set; }

    /// <summary><c>schedule</c>: a maintenance date falls due and nothing fails at the line.</summary>
    [SitrepUnit(Units.Enumeration)]
    public string? Kind { get; set; }

    /// <summary>Used over limit, which passes one once the service is overdue.</summary>
    [SitrepUnit(Units.Ratio)]
    public double? Consumed { get; set; }

    /// <summary>Seconds since the last clean inspection.</summary>
    [SitrepUnit(Units.Seconds)]
    public double? UsedSeconds { get; set; }

    /// <summary>Seconds a clean inspection lasts before service falls due.</summary>
    [SitrepUnit(Units.Seconds)]
    public double? LimitSeconds { get; set; }
}

/// <summary>One item a Kerbalism repair consumes, named as the inventory names it so a console can join the two.</summary>
[SitrepContract]
#if SITREP_CODEGEN
[TsInterface]
#endif
public class KerbalismRepairCostItem
{
    /// <summary>The item's <c>AvailablePart.name</c>: <c>evaRepairKit</c>.</summary>
    [SitrepUnit(Units.Id)]
    public string Name { get; set; } = "";

    /// <summary>How many one repair takes: two for a critical failure, one otherwise.</summary>
    [SitrepUnit(Units.Count)]
    public int Quantity { get; set; }
}

/// <summary>
/// <c>kerbalism.repair</c>'s args: which part, and which kerbal does it. One
/// command carries the whole intent, kit fetch included, because every step would
/// otherwise cost its own round trip.
/// </summary>
[SitrepContract]
#if SITREP_CODEGEN
[TsInterface]
#endif
[SitrepCommand("kerbalism.repair", Payload = typeof(KerbalismRepairOutcome))]
public class KerbalismRepairPartArgs
{
    /// <summary>The part, by the id <c>kerbalism.reliabilityParts</c> gives it.</summary>
    [SitrepUnit(Units.Id)]
    public string PartId { get; set; } = "";

    /// <summary>The kerbal who does it, by name, as <c>vessel.crew</c> keys them.</summary>
    [SitrepUnit(Units.Text)]
    public string CrewName { get; set; } = "";
}

/// <summary>What one Kerbalism repair did.</summary>
[SitrepContract]
#if SITREP_CODEGEN
[TsInterface]
#endif
public class KerbalismRepairOutcome
{
    /// <summary>Whether the part is repaired or serviced.</summary>
    [SitrepUnit(Units.Flag)]
    public bool Repaired { get; set; }

    /// <summary>Repair kits consumed.</summary>
    [SitrepUnit(Units.Count)]
    public int KitsUsed { get; set; }

    /// <summary><c>carried</c> when the kerbal held the kits, otherwise the part id of the store they came from. Null when none were used.</summary>
    [SitrepUnit(Units.Id)]
    public string? KitsFrom { get; set; }
}
