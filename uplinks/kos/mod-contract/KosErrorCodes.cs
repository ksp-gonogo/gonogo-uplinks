using Sitrep.Contract;

namespace Gonogo.KosUplink;

/// <summary>
/// The refusals kOS's commands answer with that say more than a core code can:
/// each refines the root a client classifies it by.
/// </summary>
public static class KosErrorCodes
{
    /// <summary>
    /// Another screen holds this CPU's terminal. A terminal is leased to one
    /// screen at a time and never taken from it; it frees when that screen
    /// closes it.
    /// </summary>
    public static readonly RefusalCode TerminalHeld =
        CommandErrorCode.NotClearToProceed.Refine("kos.terminalHeld", "another screen is using this CPU's terminal");

    /// <summary>
    /// The CPU is booting, running a program, or already running a script for
    /// another request, so it is not at a prompt that can take one.
    /// </summary>
    public static readonly RefusalCode CpuBusy =
        CommandErrorCode.NotClearToProceed.Refine("kos.cpuBusy", "the CPU is busy and not at its prompt");

    /// <summary>There is no script at the path a run named, on the volume the path names.</summary>
    public static readonly RefusalCode ScriptNotFound =
        CommandErrorCode.NotFound.Refine("kos.scriptNotFound", "there is no script at that path");

    /// <summary>The CPU's own drive has no room for the copy of the script a run asked for.</summary>
    public static readonly RefusalCode NoRoom =
        CommandErrorCode.LimitReached.Refine("kos.noRoom", "the CPU's drive has no room for the script");

    /// <summary>The installed kOS does not let a script be started from outside its terminal.</summary>
    public static readonly RefusalCode RunUnsupported =
        CommandErrorCode.CapabilityMismatch.Refine("kos.runUnsupported", "this kOS version cannot start a script from here");
}
