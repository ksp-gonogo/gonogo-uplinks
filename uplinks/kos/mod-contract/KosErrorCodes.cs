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

    /// <summary>The CPU has no terminal window a script could be typed into.</summary>
    public static readonly RefusalCode NoTerminal =
        CommandErrorCode.CapabilityMismatch.Refine("kos.noTerminal", "that CPU has no terminal window to type into");
}
