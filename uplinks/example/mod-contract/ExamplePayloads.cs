#if SITREP_CODEGEN
using Reinforced.Typings.Attributes;
#endif
using Sitrep.Contract;

namespace GonogoExampleUplink;

/// <summary>
/// The <c>example.heartbeat</c> channel: the smallest wire payload that is still
/// a real one. Two fields, one of them carrying a unit, so the generated
/// TypeScript exercises the <c>Value&lt;&gt;</c> retype rather than emitting an
/// import it never uses.
///
/// <para>A wire type belongs in the Uplink's OWN contract slice, never in
/// <c>Sitrep.Contract</c>. That holds for a bundled Uplink exactly as it holds
/// for a third-party one: what changes when an Uplink ships separately is how it
/// is distributed, not what it may put in core.</para>
/// </summary>
[SitrepContract]
[SitrepTopic("example.heartbeat")]
#if SITREP_CODEGEN
[TsInterface]
#endif
public sealed class ExampleHeartbeat
{
    /// <summary>Universal time the sample was captured at. `UniversalTime`, not
    /// `Seconds`: an instant and an interval are different units and the client
    /// renders them differently, so a Countdown handed a UT refuses it.</summary>
    [SitrepUnit(Units.UniversalTime)]
    public double? Ut { get; set; }

    /// <summary>How many times this Uplink has published, since load.</summary>
    [SitrepUnit(Units.Count)]
    public double? Ticks { get; set; }
}
