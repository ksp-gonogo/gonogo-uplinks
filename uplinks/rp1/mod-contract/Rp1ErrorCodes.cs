using Sitrep.Contract;

namespace GonogoRp1Uplink;

/// <summary>
/// The refusals RP-1's commands answer with that say more than a core code can:
/// each refines the root a client classifies it by.
/// </summary>
public static class Rp1ErrorCodes
{
    /// <summary>
    /// RP-1 is installed but is not managing this save, so none of its career
    /// commands apply to it. A property of the save rather than of the moment.
    /// </summary>
    public static readonly RefusalCode NotManaging =
        CommandErrorCode.CareerModeRequired.Refine("rp1.notManaging", "RP-1 is not managing this save");

    /// <summary>
    /// RP-1's space centre, which holds every queue and complex these commands
    /// act on, is not loaded in the current scene.
    /// </summary>
    public static readonly RefusalCode SpaceCentreNotLoaded =
        CommandErrorCode.ModeUnavailable.Refine("rp1.spaceCentreNotLoaded", "RP-1's space centre is not loaded");

    /// <summary>
    /// The vehicle or the complex it needs has RP-1 work outstanding: never
    /// integrated, still integrating, not rolled out, or on a pad still being
    /// reconditioned. Nothing is over a limit and nothing is broken, the work
    /// simply has not been done. The detail says which.
    /// </summary>
    public static readonly RefusalCode NotReady =
        CommandErrorCode.WrongState.Refine("rp1.notReady", "the vehicle is not ready to fly yet");

    /// <summary>
    /// The installed RP-1 build lacks a member this Uplink reads or calls, so the
    /// command could not be carried out. The detail names which one.
    /// </summary>
    public static readonly RefusalCode BuildUnrecognised =
        CommandErrorCode.Unreadable.Refine("rp1.buildUnrecognised", "this RP-1 build is not one this Uplink recognises");
}
