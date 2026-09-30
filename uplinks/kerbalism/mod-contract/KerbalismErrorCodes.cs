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

    /// <summary>Nobody aboard the craft answers to the name the repair was given.</summary>
    public static readonly RefusalCode NoSuchCrew =
        CommandErrorCode.NotFound.Refine("kerbalism.noSuchCrew", "no crew member aboard has that name");

    /// <summary>
    /// The kerbal lacks the trait or experience level Kerbalism's repair specs ask
    /// for, which it raises by one level for a critical failure.
    /// </summary>
    public static readonly RefusalCode CrewNotQualified =
        CommandErrorCode.CapabilityMismatch.Refine("kerbalism.crewNotQualified", "that kerbal does not meet Kerbalism's repair specs");

    /// <summary>The kerbal cannot get out to the part: the hatch is inside a fairing, which clears once it is jettisoned.</summary>
    public static readonly RefusalCode EvaImpossible =
        CommandErrorCode.NotClearToProceed.Refine("kerbalism.evaImpossible", "the crew cannot get out to it yet");

    /// <summary>The save requires repair kits and the kerbal and the craft's stores hold fewer than the repair takes.</summary>
    public static readonly RefusalCode NoKits =
        CommandErrorCode.InsufficientResource.Refine("kerbalism.noKits", "there are not enough repair kits aboard");

    /// <summary>Kerbalism's reliability feature or its MTBF failures are switched off in this save, so no part is breaking.</summary>
    public static readonly RefusalCode ReliabilityNotModelled =
        CommandErrorCode.ModeUnavailable.Refine("kerbalism.reliabilityNotModelled", "Kerbalism is not modelling part failures in this save");

    /// <summary>No reliability module aboard has that id and is broken or due a service.</summary>
    public static readonly RefusalCode NothingToRepair =
        CommandErrorCode.NotFound.Refine("kerbalism.nothingToRepair", "no part aboard with that id is broken or due a service");
}
