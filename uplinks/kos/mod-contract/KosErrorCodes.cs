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

    /// <summary>
    /// The file path is not one a file command accepts: it must be relative to
    /// the volume's root, made of letters, digits, <c>_</c>, <c>-</c> and
    /// <c>.</c>, with no <c>..</c>, no empty segment and no segment starting
    /// with <c>.</c>.
    /// </summary>
    public static readonly RefusalCode BadPath =
        CommandErrorCode.Range.Refine("kos.badPath", "that is not a file path this command accepts");

    /// <summary>Only <c>.ks</c>, <c>.ksm</c>, <c>.txt</c> and <c>.json</c> files can be reached by a file command.</summary>
    public static readonly RefusalCode FileType =
        CommandErrorCode.Range.Refine("kos.fileType", "the file is not a .ks, .ksm, .txt or .json file");

    /// <summary>
    /// The file is not UTF-8 text, so it cannot be read or written as text. A
    /// compiled <c>.ksm</c> file is always refused this way.
    /// </summary>
    public static readonly RefusalCode NotText =
        CommandErrorCode.WrongState.Refine("kos.notText", "the file is binary, not text");

    /// <summary>The file, or the text sent to be written, is larger than a file command carries.</summary>
    public static readonly RefusalCode FileTooLarge =
        CommandErrorCode.LimitReached.Refine("kos.fileTooLarge", "the file is larger than a file command carries");

    /// <summary>The CPU's own drive has no room for the file a write would save.</summary>
    public static readonly RefusalCode DriveFull =
        CommandErrorCode.LimitReached.Refine("kos.driveFull", "the CPU's drive has no room for the file");

    /// <summary>
    /// The file has changed since the hash the command named was read, or has
    /// gone. Nothing was written; read the file again before saving over it.
    /// </summary>
    public static readonly RefusalCode FileChanged =
        CommandErrorCode.WrongState.Refine("kos.fileChanged", "the file has changed since it was read");

    /// <summary>A file already has the name a new file or a rename would use.</summary>
    public static readonly RefusalCode FileExists =
        CommandErrorCode.WrongState.Refine("kos.fileExists", "a file already has that name");

    /// <summary>There is no file at the path a read, delete or rename named.</summary>
    public static readonly RefusalCode FileNotFound =
        CommandErrorCode.NotFound.Refine("kos.fileNotFound", "there is no file at that path");

    /// <summary>The path names a directory, and file commands act on files only.</summary>
    public static readonly RefusalCode NotAFile =
        CommandErrorCode.WrongState.Refine("kos.notAFile", "that path is a directory, not a file");

    /// <summary>A delete or rename names the hash the last read of the file answered with, and this one named none.</summary>
    public static readonly RefusalCode HashRequired =
        CommandErrorCode.Range.Refine("kos.hashRequired", "a delete or rename needs the hash the file was read with");
}
