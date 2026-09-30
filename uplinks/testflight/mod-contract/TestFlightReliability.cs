using System.Collections.Generic;
using Sitrep.Contract;
#if SITREP_CODEGEN
using Reinforced.Typings.Attributes;
#endif

namespace GonogoTestFlightUplink;

/// <summary>
/// Whether TestFlight is reporting on the craft's engines, published on
/// <c>testflight.reliability</c> whenever TestFlight is installed.
///
/// <para>The bound and unbound member lists are the provenance record: a
/// TestFlight release that renames a member the reader reflects on shows up here
/// without another decompile.</para>
/// </summary>
[SitrepContract]
#if SITREP_CODEGEN
[TsInterface]
#endif
[SitrepTopic("testflight.reliability")]
public class TestFlightReliabilitySummary
{
    /// <summary>
    /// <c>modeled</c> when each engine's part status can be read, or
    /// <c>indeterminate</c> when not even that bound. A partly-bound reader stays
    /// <c>modeled</c>: missing rated-time reads only leave the budgets out.
    /// </summary>
    [SitrepUnit(Units.Enumeration)]
    public string? Coverage { get; set; }

    /// <summary>The TestFlight members the reader resolved this session.</summary>
    [SitrepUnit(Units.Text)]
    public IReadOnlyList<string>? BoundMembers { get; set; }

    /// <summary>The TestFlight members the reader looked for and did not find.</summary>
    [SitrepUnit(Units.Text)]
    public IReadOnlyList<string>? UnboundMembers { get; set; }
}

/// <summary>
/// One live TestFlight core aboard the craft: the flying engine config of a part,
/// never one of the other configs an RO part carries. Published on
/// <c>testflight.reliabilityParts</c>.
/// </summary>
[SitrepContract]
#if SITREP_CODEGEN
[TsInterface]
#endif
[SitrepTopic("testflight.reliabilityParts", isArray: true)]
public class TestFlightReliabilityPart
{
    /// <summary>
    /// <c>"&lt;flightID&gt;:&lt;occurrence&gt;"</c>, unique within one payload and
    /// the id <c>testflight.repair</c> addresses: one part can carry more than one
    /// live core.
    /// </summary>
    [SitrepUnit(Units.Id)]
    public string? PartId { get; set; }

    /// <summary>The part's title.</summary>
    [SitrepUnit(Units.Text)]
    public string? Title { get; set; }

    /// <summary>The flying engine config's alias, which is the engine's identity under RO where the part title is not.</summary>
    [SitrepUnit(Units.Text)]
    public string? Configuration { get; set; }

    /// <summary>
    /// <c>nominal</c>, <c>failed</c> or <c>unknown</c>, off TestFlight's own part
    /// status. TestFlight grades no failure as more severe than another, so there
    /// is no critical class, and an unread status is <c>unknown</c>, never
    /// <c>nominal</c>.
    /// </summary>
    [SitrepUnit(Units.Enumeration)]
    public string? Condition { get; set; }

    /// <summary>The titles of the part's active failures, as TestFlight names them ("Loss of Thrust"), or null when there are none.</summary>
    [SitrepUnit(Units.Text)]
    public string? ConditionDetail { get; set; }

    /// <summary>
    /// The chance the engine survives <see cref="SurvivalHorizonSeconds"/> of
    /// operation at its current flight data, asked of TestFlight's own
    /// reliability curve. Null whenever either input could not be read.
    /// </summary>
    [SitrepUnit(Units.Ratio)]
    public double? Survival { get; set; }

    /// <summary>The span <see cref="Survival"/> is over: the rated cumulative burn, which is the horizon TestFlight's own window quotes it at.</summary>
    [SitrepUnit(Units.Seconds)]
    public double? SurvivalHorizonSeconds { get; set; }

    /// <summary>
    /// The rated burn times, continuous and cumulative, as independent budgets. Only
    /// one is sent when the two ratings are equal.
    /// </summary>
    public IReadOnlyList<TestFlightReliabilityBudget>? Budgets { get; set; }

    /// <summary>How far up its reliability curve this engine config has climbed, in TestFlight's data units.</summary>
    [SitrepUnit(Units.Dimensionless)]
    public double? FlightData { get; set; }
}

/// <summary>
/// One rated burn allowance. Past its rating an engine's failure chance climbs
/// along a config-authored curve: nothing stops and nothing is guaranteed.
/// </summary>
[SitrepContract]
#if SITREP_CODEGEN
[TsInterface]
#endif
public class TestFlightReliabilityBudget
{
    /// <summary><c>burn.continuous</c> or <c>burn.cumulative</c>.</summary>
    [SitrepUnit(Units.Id)]
    public string? Id { get; set; }

    /// <summary>The lower-case noun an operator reads, naming its scope so neither rating can be read as the other.</summary>
    [SitrepUnit(Units.Text)]
    public string? Label { get; set; }

    /// <summary><c>risk-ramp</c>.</summary>
    [SitrepUnit(Units.Enumeration)]
    public string? Kind { get; set; }

    /// <summary>Used over limit, past one once the engine runs beyond its rating. Null when the run time could not be read.</summary>
    [SitrepUnit(Units.Ratio)]
    public double? Consumed { get; set; }

    /// <summary>Rated seconds used. TestFlight wears an engine thrust-weighted, so these are not seconds of burn at partial throttle.</summary>
    [SitrepUnit(Units.Seconds)]
    public double? UsedSeconds { get; set; }

    /// <summary>The rated allowance, in the same seconds.</summary>
    [SitrepUnit(Units.Seconds)]
    public double? LimitSeconds { get; set; }
}

/// <summary>
/// <c>testflight.repair</c>'s args: which engine. TestFlight's repair takes no
/// crew, no consumable and no time, so the part is all it needs.
/// </summary>
[SitrepContract]
#if SITREP_CODEGEN
[TsInterface]
#endif
[SitrepCommand("testflight.repair", Payload = typeof(TestFlightRepairOutcome))]
public class TestFlightRepairPartArgs
{
    /// <summary>The engine, by the id <c>testflight.reliabilityParts</c> gives it.</summary>
    [SitrepUnit(Units.Id)]
    public string PartId { get; set; } = "";
}

/// <summary>What one TestFlight repair did.</summary>
[SitrepContract]
#if SITREP_CODEGEN
[TsInterface]
#endif
public class TestFlightRepairOutcome
{
    /// <summary>Whether TestFlight cleared the failures it was asked to.</summary>
    [SitrepUnit(Units.Flag)]
    public bool Repaired { get; set; }

    /// <summary>How many failures the repair cleared. A terminal failure alongside them stays.</summary>
    [SitrepUnit(Units.Count)]
    public int FailuresCleared { get; set; }
}
