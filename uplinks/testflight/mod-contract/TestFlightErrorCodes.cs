using Sitrep.Contract;

namespace GonogoTestFlightUplink;

/// <summary>
/// Why TestFlight refused a repair, each refining the root a client classifies
/// it by. TestFlight's repair checks no crew, consumable or situation, so these
/// are the only answers it can give.
/// </summary>
public static class TestFlightErrorCodes
{
    /// <summary>TestFlight is installed and the reader could not reach its repair or failure-list members.</summary>
    public static readonly RefusalCode NotModelled =
        CommandErrorCode.ModeUnavailable.Refine("testflight.notModelled", "TestFlight is not reporting failures for that engine");

    /// <summary>No live TestFlight core aboard has that id.</summary>
    public static readonly RefusalCode NoSuchPart =
        CommandErrorCode.NotFound.Refine("testflight.noSuchPart", "no engine TestFlight is tracking has that id");

    /// <summary>The engine is tracked and carries no active failure.</summary>
    public static readonly RefusalCode NothingFailed =
        CommandErrorCode.NotFound.Refine("testflight.nothingFailed", "that engine has no active TestFlight failure");

    /// <summary>
    /// Every active failure on the engine is a class TestFlight says no repair can
    /// fix: an explosion, a fired docking clamp, a snapped solar mechanism.
    /// </summary>
    public static readonly RefusalCode Unrepairable =
        CommandErrorCode.CapabilityMismatch.Refine("testflight.unrepairable", "TestFlight marks that failure as beyond repair");

    /// <summary>TestFlight was asked to repair and left the failure standing without saying why.</summary>
    public static readonly RefusalCode RepairDeclined =
        CommandErrorCode.ModeUnavailable.Refine("testflight.repairDeclined", "TestFlight left the failure standing");
}
