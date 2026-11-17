#if SITREP_CODEGEN
using Reinforced.Typings.Attributes;
#endif
using System.Collections.Generic;
using Sitrep.Contract;

namespace Gonogo.KosUplink;

/// <summary>
/// Args for the <c>kos.run</c> command: runs the script at <see cref="Path"/>
/// on one CPU with <see cref="Args"/> as its parameters, the way
/// <c>RUNPATH(path, args...)</c> typed at that CPU's terminal would. The mod
/// starts the program itself; nothing in these args is ever compiled as
/// kerboscript, so a path or argument cannot inject code.
///
/// <para>Delivered delayed, single-in-flight-per-CPU: reachability and the
/// idle-prompt guard are re-checked at delivery on the KSP main thread, and a
/// second <c>kos.run</c> for a CPU that already has one in flight is refused
/// with <c>kos.cpuBusy</c>. A path with no script behind it is refused with
/// <c>kos.scriptNotFound</c>, before anything runs.</para>
/// </summary>
[SitrepContract]
#if SITREP_CODEGEN
[TsInterface]
#endif
[SitrepCommand("kos.run")]
public class KosRunArgs
{
    /// <summary>Target CPU, identified by its <see cref="KosProcessorInfo.CoreId"/>.</summary>
    [SitrepUnit(Units.Id)]
    public int CoreId { get; set; }

    /// <summary>
    /// Caller-generated, per-call opaque correlation token. Echoed back
    /// verbatim on the matching <see cref="KosRunResult"/> so a client with
    /// several in-flight (different-CPU) calls can tell results apart,
    /// same role as <see cref="KosTerminalOpenArgs.LeaseToken"/>, but scoped
    /// to a single request/response instead of a session.
    /// </summary>
    [SitrepUnit(Units.Id)]
    public string RequestId { get; set; } = "";

    /// <summary>
    /// The script to run, as kOS reads a path: <c>0:/launch.ks</c> on the
    /// Archive, <c>1:/launch.ks</c> on the CPU's own drive, or a path relative
    /// to the CPU's current volume.
    /// </summary>
    [SitrepUnit(Units.Text)]
    public string Path { get; set; } = "";

    /// <summary>
    /// The script's parameters, in order: each a number, a string or a
    /// boolean, reaching the script as the matching kOS value. At most 32.
    /// </summary>
    public List<object?> Args { get; set; } = new List<object?>();

    /// <summary>
    /// Copy the script onto the CPU's own drive (<c>1:</c>) under its file
    /// name first, then run that copy. Refused with <c>kos.noRoom</c> when the
    /// drive cannot hold it, and with <c>noConnection</c> when the script is on
    /// the Archive and the craft has no link home.
    /// </summary>
    [SitrepUnit(Units.Flag)]
    public bool CopyToLocal { get; set; }
}

/// <summary>
/// Result of one <c>kos.run</c> dispatch, delivered on the
/// <c>kos.run.&lt;coreId&gt;</c> dynamic channel
/// (<c>Delivery.ReliableOrdered</c>, <c>DelayRole.Delayed</c>: same posture
/// as <see cref="KosTerminalFrame"/>: this is vessel telemetry riding
/// gonogo's reveal clock). Published exactly once per armed request: when the
/// script hands a value back with <c>ADDONS:GONOGO:RETURN(value)</c>,
/// when kOS stops the script on an error, or when the program ends having
/// handed nothing back (<see cref="Ended"/>).
///
/// <para>Exactly one of <see cref="Fields"/> / <see cref="Error"/> is
/// non-null, or neither with <see cref="Ended"/> true. See <see cref="Fields"/>
/// for what a field value is.</para>
/// </summary>
[SitrepContract]
#if SITREP_CODEGEN
[TsInterface]
#endif
public class KosRunResult
{
    /// <summary>The emitting CPU's <see cref="KosProcessorInfo.CoreId"/>.</summary>
    [SitrepUnit(Units.Id)]
    public int CoreId { get; set; }

    /// <summary>Echoes the triggering <see cref="KosRunArgs.RequestId"/>.</summary>
    [SitrepUnit(Units.Id)]
    public string RequestId { get; set; } = "";

    /// <summary>
    /// What the script passed to <c>ADDONS:GONOGO:RETURN</c>: null on an error or
    /// ended result. A lexicon becomes one field per key, keyed by the key's
    /// text; any other value is the single field <c>value</c>.
    ///
    /// <para>A field value is a number, a boolean or a string as itself, or an
    /// object whose <c>kind</c> names its shape. <c>list</c> (<c>type</c>,
    /// <c>items</c>, <c>omitted</c>) covers LIST, UNIQUESET, QUEUE and STACK, with
    /// <c>omitted</c> counting items cut off after the first 500. <c>lexicon</c>
    /// (<c>entries</c> of <c>key</c> and <c>value</c>, <c>omitted</c>) keeps the
    /// order and the key text. <c>vector</c> carries <c>x</c>, <c>y</c>, <c>z</c>
    /// and <c>magnitude</c>; <c>direction</c> the <c>pitch</c>, <c>yaw</c> and
    /// <c>roll</c> in degrees; <c>timespan</c> and <c>timestamp</c> the
    /// <c>seconds</c>; <c>geo</c> the <c>latitude</c> and <c>longitude</c> in
    /// degrees; <c>part</c> and <c>vessel</c> the <c>name</c> and <c>id</c>.
    /// Every other kOS value is <c>other</c>, with its kOS <c>type</c> name and
    /// the <c>text</c> kOS prints for it. Values nested more than eight deep
    /// arrive as <c>other</c>.</para>
    /// </summary>
    public Dictionary<string, object?>? Fields { get; set; }

    /// <summary>
    /// Why the run failed: the message of the error kOS stopped the script on,
    /// followed by the script and line when kOS can say. Null on a data or
    /// ended result.
    /// </summary>
    [SitrepUnit(Units.Text)]
    public string? Error { get; set; }

    /// <summary>
    /// True when the program finished without handing anything back, so the
    /// run has nothing to report: <see cref="Fields"/> and <see cref="Error"/>
    /// are both null. False on every result that carries one of them, so the
    /// final result of a run that returned a value or failed reads false.
    /// </summary>
    [SitrepUnit(Units.Flag)]
    public bool Ended { get; set; }

    /// <summary>
    /// How many <see cref="KosLogEntry"/> the run sent before it ended. A log
    /// entry rides its own channel, so it is not ordered against this result:
    /// a reader that has seen fewer entries than this knows more are still
    /// crossing the delay.
    /// </summary>
    [SitrepUnit(Units.NotApplicable)]
    public int Logged { get; set; }

    /// <summary>How many <c>ADDONS:GONOGO:LOG</c> calls the run made that the rate limit dropped.</summary>
    [SitrepUnit(Units.NotApplicable)]
    public int Dropped { get; set; }
}

/// <summary>
/// One value a running script handed to <c>ADDONS:GONOGO:LOG</c>, delivered on
/// the <c>kos.log.&lt;coreId&gt;</c> dynamic channel
/// (<c>Delivery.ReliableOrdered</c>, <c>DelayRole.Delayed</c>). The run goes on
/// after it; the run's own result still arrives once on <c>kos.run.&lt;coreId&gt;</c>.
/// </summary>
[SitrepContract]
#if SITREP_CODEGEN
[TsInterface]
#endif
public class KosLogEntry
{
    /// <summary>The emitting CPU's <see cref="KosProcessorInfo.CoreId"/>.</summary>
    [SitrepUnit(Units.Id)]
    public int CoreId { get; set; }

    /// <summary>The <see cref="KosRunArgs.RequestId"/> of the run that logged it.</summary>
    [SitrepUnit(Units.Id)]
    public string RequestId { get; set; } = "";

    /// <summary>This entry's place in its run, counting from zero.</summary>
    [SitrepUnit(Units.NotApplicable)]
    public int Seq { get; set; }

    /// <summary>The logged value, in the shape described on <see cref="KosRunResult.Fields"/> for one field.</summary>
    public object? Value { get; set; }
}

/// <summary>
/// Args for the <c>kos.cancel</c> command: abandons the <c>kos.run</c> a caller
/// stopped waiting for. The CPU is released for the next run, and the program
/// still running on it is stopped, but only while <see cref="RequestId"/> is
/// still the run the CPU is armed for, so a late cancel never disturbs a newer
/// run. Sent by a script runner when its run times out.
/// </summary>
[SitrepContract]
#if SITREP_CODEGEN
[TsInterface]
#endif
[SitrepCommand("kos.cancel")]
public class KosCancelArgs
{
    /// <summary>Target CPU, identified by its <see cref="KosProcessorInfo.CoreId"/>.</summary>
    [SitrepUnit(Units.Id)]
    public int CoreId { get; set; }

    /// <summary>The <see cref="KosRunArgs.RequestId"/> of the run to abandon.</summary>
    [SitrepUnit(Units.Id)]
    public string RequestId { get; set; } = "";
}
