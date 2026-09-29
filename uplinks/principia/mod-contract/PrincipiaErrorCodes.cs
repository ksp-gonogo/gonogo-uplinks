using Sitrep.Contract;

namespace GonogoPrincipiaUplink;

/// <summary>
/// The guards that refuse a Principia plan write before the plugin is called:
/// each refines the root a client classifies it by.
/// </summary>
public static class PrincipiaErrorCodes
{
    /// <summary>
    /// No plugin, no session, or a producer build whose write entry points were
    /// never analysed. Writes fail closed to read-only.
    /// </summary>
    public static readonly RefusalCode SurfaceUnavailable =
        CommandErrorCode.ModeUnavailable.Refine("principia.surfaceUnavailable", "Principia's plan surface is not available");

    /// <summary>
    /// The surface was not armed. Every plan write changes the player's saved game
    /// and re-integrates on the game's own thread, so it takes a deliberate arm
    /// first.
    /// </summary>
    public static readonly RefusalCode NotArmed =
        CommandErrorCode.NotClearToProceed.Refine("principia.notArmed", "plan writes are not armed");

    /// <summary>
    /// The struct this write passes to the plugin failed its round-trip probe, or
    /// the probe has not run. A stale shape does not fail to resolve: it writes a
    /// plausible wrong burn into the save.
    /// </summary>
    public static readonly RefusalCode LayoutUnverified =
        CommandErrorCode.ModeUnavailable.Refine("principia.layoutUnverified", "this Principia build's plan layout is not verified");

    /// <summary>The plugin no longer knows this vessel.</summary>
    public static readonly RefusalCode VesselUnknown =
        CommandErrorCode.NoVessel.Refine("principia.vesselUnknown", "Principia does not know this vessel");

    /// <summary>The vessel holds no flight plan to edit.</summary>
    public static readonly RefusalCode NoFlightPlan =
        CommandErrorCode.WrongState.Refine("principia.noFlightPlan", "the vessel has no flight plan");

    /// <summary>A plan already exists and this write would have created a second without being asked to.</summary>
    public static readonly RefusalCode PlanAlreadyExists =
        CommandErrorCode.WrongState.Refine("principia.planAlreadyExists", "the vessel already has a flight plan");

    /// <summary>
    /// The vessel already holds the producer's maximum of ten plans. An eleventh
    /// makes the producer's own planner window throw on every layout pass,
    /// permanently, with the button that would delete it inside the part that
    /// stopped rendering.
    /// </summary>
    public static readonly RefusalCode PlanSlotsFull =
        CommandErrorCode.LimitReached.Refine("principia.planSlotsFull", "the vessel already holds ten flight plans");

    /// <summary>The burn index was outside the count read in the same frame.</summary>
    public static readonly RefusalCode BurnIndexOutOfRange =
        CommandErrorCode.NotFound.Refine("principia.burnIndexOutOfRange", "the plan has no burn at that position");

    /// <summary>The burn is running right now. The plugin permits this and only the rebase entry point checks, so the guard is ours.</summary>
    public static readonly RefusalCode BurnExecuting =
        CommandErrorCode.NotClearToProceed.Refine("principia.burnExecuting", "that burn is executing");

    /// <summary>The burn's manœuvring frame is one the producer's frame factory does not handle, so sending the burn back would abort the game.</summary>
    public static readonly RefusalCode BurnFrameUnsupported =
        CommandErrorCode.CapabilityMismatch.Refine("principia.burnFrameUnsupported", "Principia cannot take that burn's frame back");

    /// <summary>An optimisation is running on this plan and would revert the edit without reporting it.</summary>
    public static readonly RefusalCode OptimisationRunning =
        CommandErrorCode.NotClearToProceed.Refine("principia.optimisationRunning", "an optimisation is running on the plan");

    /// <summary>A requested value was not finite, or a Δv triple would have been.</summary>
    public static readonly RefusalCode ValueNotFinite =
        CommandErrorCode.Range.Refine("principia.valueNotFinite", "a value was not a finite number");

    /// <summary>
    /// Thrust is not positive. A zero-thrust burn has infinite duration, which the
    /// producer's own singularity test does not catch: it pushes the plan's end
    /// instant to infinity, spawns a thread that never terminates, and serialises
    /// the infinity into the save.
    /// </summary>
    public static readonly RefusalCode ThrustNotPositive =
        CommandErrorCode.Range.Refine("principia.thrustNotPositive", "the thrust is not positive");

    /// <summary>
    /// The integrator kinds read back from the plugin were not the pair this build
    /// expects, so writing them back could abort with no message. The read
    /// succeeded, so this is neither unreadable nor a craft's capability.
    /// </summary>
    public static readonly RefusalCode IntegratorKindUnexpected =
        CommandErrorCode.ModeUnavailable.Refine("principia.integratorKindUnexpected", "the plan's integrators are not a pair this Uplink expects");

    /// <summary>A requested integrator bound was outside the range the producer's own controls offer.</summary>
    public static readonly RefusalCode IntegratorBoundsExceeded =
        CommandErrorCode.Range.Refine("principia.integratorBoundsExceeded", "an integrator bound is outside what Principia offers");

    /// <summary>A plan cannot be created ending before it starts.</summary>
    public static readonly RefusalCode FinalTimeInPast =
        CommandErrorCode.Range.Refine("principia.finalTimeInPast", "the plan would end before it starts");

    /// <summary>
    /// A field this write must set was not found on the producer's own struct, so
    /// its shape is not the shape that was analysed. Nothing about the vessel was
    /// established, so this is not a craft's capability.
    /// </summary>
    public static readonly RefusalCode PluginShapeChanged =
        CommandErrorCode.Unreadable.Refine("principia.pluginShapeChanged", "this Principia build's plan is not shaped as this Uplink expects");

    /// <summary>
    /// The ignition instant this write asked for had already passed by the time the
    /// write arrived, which signal delay can cause with nothing done wrong at either
    /// end. Distinct from <see cref="FinalTimeInPast"/>, which is about a plan's end
    /// and only reachable while creating one.
    /// </summary>
    public static readonly RefusalCode IgnitionInPast =
        CommandErrorCode.Range.Refine("principia.ignitionInPast", "the ignition time had already passed");

    /// <summary>
    /// A composed plan that cannot be read as one: no burn list where a list was
    /// required, a burn missing from the middle, more burns than a single command
    /// may install, ignitions out of time order, or an end that falls before the
    /// last burn. It refuses the whole plan, because a plan half-installed is a
    /// trajectory nobody composed.
    /// </summary>
    public static readonly RefusalCode PlanMalformed =
        CommandErrorCode.Range.Refine("principia.planMalformed", "the composed plan cannot be read as one plan");

    /// <summary>
    /// A burn with no manœuvre ahead of it was asked for without the instant it
    /// lights. An absent instant elsewhere means "leave it where it is", and a burn
    /// with nothing ahead of it has no instant to be left at.
    /// </summary>
    public static readonly RefusalCode ComposedBurnIncomplete =
        CommandErrorCode.Range.Refine("principia.composedBurnIncomplete", "a first burn needs the time it lights");

    /// <summary>
    /// A read a guard depends on could not be decoded from the loaded build, so the
    /// guard cannot answer: whether a burn is under thrust, whether an optimisation
    /// would revert the edit, or what the producer's clock reads. Refused rather
    /// than permitted. Distinct from <see cref="PluginShapeChanged"/>, which is a
    /// field this write must set; this is a value this build could not read.
    /// </summary>
    public static readonly RefusalCode GuardReadUnreadable =
        CommandErrorCode.Unreadable.Refine("principia.guardReadUnreadable", "a value a write guard needs would not read");
}
