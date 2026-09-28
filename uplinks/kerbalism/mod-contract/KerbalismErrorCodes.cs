using Sitrep.Contract;

namespace GonogoKerbalismUplink;

/// <summary>
/// The refusals Kerbalism's commands answer with that say more than a core code
/// can: each refines the root a client classifies it by.
/// </summary>
public static class KerbalismErrorCodes
{
    /// <summary>
    /// Kerbalism runs and transmits experiments continuously on its own, so a
    /// one-shot deploy or transmit has nothing to act on.
    /// </summary>
    public static readonly RefusalCode ContinuousScience =
        CommandErrorCode.ModeUnavailable.Refine("kerbalism.continuousScience", "Kerbalism runs and transmits experiments on its own");

    /// <summary>Kerbalism is not modelling science on this vessel, so there is no file or sample to act on.</summary>
    public static readonly RefusalCode ScienceNotModelled =
        CommandErrorCode.ModeUnavailable.Refine("kerbalism.scienceNotModelled", "Kerbalism is not modelling science here");

    /// <summary>No drive beside a lab, other than the one holding it, has room for the whole sample.</summary>
    public static readonly RefusalCode NoDriveSpace =
        CommandErrorCode.LimitReached.Refine("kerbalism.noDriveSpace", "no drive beside a lab has room for the whole sample");

    /// <summary>A Kerbalism drive was asked to change a file or sample and reported that it had not.</summary>
    public static readonly RefusalCode DriveRefused =
        CommandErrorCode.ModeUnavailable.Refine("kerbalism.driveRefused", "the Kerbalism drive did not make the change");
}
