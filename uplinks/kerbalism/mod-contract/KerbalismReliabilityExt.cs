using Sitrep.Contract;
#if SITREP_CODEGEN
using Reinforced.Typings.Attributes;
#endif

namespace GonogoKerbalismUplink;

// The Kerbalism namespace of this Uplink's reliability summary's extension bag,
// declared and typed here. TYPING-ONLY, exactly like KerbalismPayloads.cs: the
// value tree KerbalismReliabilityMap builds is what would reach the wire.
//
// The vessel-level at-a-glance figures a Kerbalism operator has live here, with
// the four difficulty settings that make the per-part condition mean anything:
// how likely a failure is to be the unrepairable class, how likely one is
// absorbed as a safe-mode reset, and whether repair needs kits at all. All four
// are save-wide, none is per part.

/// <summary>
/// Kerbalism's vessel-level reliability rollup: the <c>extensions["kerbalism"]</c>
/// sub-tree of this Uplink's reliability summary. No Topic publishes the summary
/// yet.
///
/// <para>Absent entirely when <c>Features.Reliability</c> is off (the summary
/// reports <c>disabled</c> and there is no per-part list to roll up).</para>
/// </summary>
[SitrepContract]
#if SITREP_CODEGEN
[TsInterface]
#endif
public class KerbalismReliabilityExt
{
    /// <summary>
    /// The shortest mean-time-between-failures on the vessel: Kerbalism's
    /// at-a-glance "what fails first" number. SECONDS, which is what
    /// <c>ReliabilityInfo.mtbf</c> has always been; it previously rode a field
    /// named <c>WorstMtbfHours</c> and was labelled hours by every reader of it, so
    /// a default part read 21,600,000 h. Null when no part on the vessel is
    /// modelled as failing over time.
    /// </summary>
    [SitrepUnit(Units.Seconds)]
    public double? WorstMtbfSeconds { get; set; }

    /// <summary>How many modelled parts are currently broken.</summary>
    [SitrepUnit(Units.Count)]
    public int? BrokenPartCount { get; set; }

    /// <summary>
    /// How many not-yet-broken parts report <c>NeedsMaintenance</c>: the
    /// engineer's preventive work list. Kerbalism calls this state "needs
    /// service" and keeps it distinct from "needs repair" (broken, not critical),
    /// which is why this counts only parts that have NOT failed.
    /// </summary>
    [SitrepUnit(Units.Count)]
    public int? ServiceDuePartCount { get; set; }

    /// <summary>
    /// Save-wide: given a failure happens, the chance it is the more severe
    /// class. A difficulty setting (<c>PreferencesReliability.criticalChance</c>),
    /// never a per-part probability, and there is no per-part probability in
    /// Kerbalism to confuse it with.
    /// </summary>
    [SitrepUnit(Units.Ratio)]
    public double? CriticalChance { get; set; }

    /// <summary>
    /// Save-wide: given a failure falls due on an uncrewed vessel, the chance it
    /// is absorbed as a safe-mode reset instead of a break. This is why crossing a
    /// Kerbalism maintenance clock is a coin flip rather than a deadline.
    /// </summary>
    [SitrepUnit(Units.Ratio)]
    public double? SafeModeChance { get; set; }

    /// <summary>Whether a repair consumes EVA repair kits, which decides whether a failure is fixable with what is aboard.</summary>
    [SitrepUnit(Units.Flag)]
    public bool? RequireRepairKits { get; set; }

    /// <summary>Whether a part's redundancy siblings get their life extended when it breaks. Relevant because it moves the maintenance clock with no event the operator saw.</summary>
    [SitrepUnit(Units.Flag)]
    public bool? IncentiveRedundancy { get; set; }
}
