// Stand-ins for the strategy types Rp1StrategyCommands reaches by name, in the
// namespaces RP-1 declares them in, so the production walk resolves these
// exactly as it resolves the real assembly.
//
// What they can and cannot prove is stated in Rp0Fixture's header and holds
// here: a rename on RP-1's side stops production resolving while these go on
// carrying the old name, which is what Rp1ReflectionTargets exists to catch
// against the shipped binary. These prove ORDER and BRANCHING, which the
// manifest cannot see at all.
//
// The recorder is the point. Both defects this command was written around are
// defects of SEQUENCE rather than of value: performing the program half second
// mints an alarm against a deadline that has not been assigned, and performing
// it at all when the screen is open performs it twice. Neither is visible in a
// return value, so the fixture writes down what was called and in what order.
using System.Collections.Generic;

namespace Strategies
{
    /// <summary>
    /// Stock's config, which is where a strategy's ID actually lives.
    /// </summary>
    /// <remarks>
    /// It is here because the fixture used to give <c>Strategy</c> a
    /// <c>Name</c> of its own, and the real type has none: it exposes
    /// <c>Config</c>, <c>DepartmentName</c>, <c>Department</c>, <c>Title</c>,
    /// <c>Description</c> and <c>GroupTags</c>, and the id every read side
    /// publishes is <c>StrategyConfig.Name</c>. A stand-in carrying a member the
    /// game does not have passed a lookup that could never match a real strategy,
    /// which is the shipped defect 9737b91e5 fixed on the rig rather than here.
    /// </remarks>
    public class StrategyConfig
    {
        public string Name { get; set; } = "";

        public string Title { get; set; } = "";
    }

    /// <summary>Stock's strategy, carrying only what the command reads.</summary>
    public class Strategy
    {
        public StrategyConfig Config { get; set; } = new StrategyConfig();

        /// <summary>
        /// The display string, which delegates to the config the way the real
        /// property does. The command's fallback arm reads it for anyone holding a
        /// title rather than an id.
        /// </summary>
        public string Title => Config.Title;

        public bool IsActive { get; set; }

        public double Factor { get; set; }

        public List<string> GroupTags { get; set; } = new List<string>();

        /// <summary>
        /// Arm 8. Virtual on RP-1's side, and where its program slot cap lives.
        /// </summary>
        public virtual bool CanActivate(ref string reason)
        {
            reason = RefuseWith ?? "";
            return RefuseWith == null;
        }

        /// <summary>Set by a test to make arm 8 refuse, with the game's own words.</summary>
        public string? RefuseWith { get; set; }

        /// <summary>
        /// Stock's deactivation gate, which carries the strategy's own
        /// <see cref="CanDeactivate"/> words out through its out parameter.
        /// </summary>
        public bool CanBeDeactivated(out string reason)
        {
            reason = "generic stock refusal";
            return CanDeactivate(ref reason);
        }

        /// <summary>The strategy's own deactivation rule, which RP-1 overrides for a Program.</summary>
        public virtual bool CanDeactivate(ref string reason) => true;

        /// <summary>
        /// Arm 9's population. Virtual on the game's side, so a mod's effect can
        /// refuse for a reason nothing here can enumerate.
        /// </summary>
        public List<StrategyEffect> Effects { get; } = new List<StrategyEffect>();
    }

    /// <summary>One effect, which may refuse the whole commitment.</summary>
    public class StrategyEffect
    {
        public string? RefuseWith { get; set; }

        public virtual bool CanActivate(ref string reason)
        {
            reason = RefuseWith ?? "";
            return RefuseWith == null;
        }
    }

    public class StrategySystem
    {
        public static StrategySystem? Instance { get; set; }

        public List<Strategy> Strategies { get; set; } = new List<Strategy>();

        /// <summary>Arm 2, and the only arm that reads the system rather than the strategy.</summary>
        public bool HasConflictingActiveStrategies(List<string> groupTags) => Conflicts;

        public bool Conflicts { get; set; }
    }
}

namespace RP0
{
    /// <summary>
    /// RP-1's strategy, carrying the procedure the command calls instead of
    /// <c>ActivateOverride</c>.
    /// </summary>
    public partial class StrategyRP0 : Strategies.Strategy
    {
        /// <summary>
        /// The whole fresh-activation procedure. Records the call rather than
        /// performing one, and records the deadline it WOULD have minted an alarm
        /// against, which is what the ordering defect corrupts.
        /// </summary>
        public void PerformActivate(bool useCurrency)
        {
            Programs.StrategyCallLog.Calls.Add("PerformActivate");
            IsActive = true;
            if (this is Programs.ProgramStrategy ps)
            {
                Programs.StrategyCallLog.AlarmDeadline = ps.Program?.deadlineUT;
            }
        }
    }

    public partial class StrategyRP0
    {
        /// <summary>
        /// The body RP-1's Harmony prefix substitutes for stock's
        /// <c>Deactivate()</c>: gate, unstamp, <c>Unregister()</c>.
        /// </summary>
        public virtual bool DeactivateOverride()
        {
            if (!CanBeDeactivated(out _))
            {
                return false;
            }
            Programs.StrategyCallLog.Calls.Add("DeactivateOverride");
            IsActive = false;
            OnUnregister();
            return true;
        }

        public virtual void OnUnregister()
        {
        }
    }

    /// <summary>
    /// A strategy that will not say what level it is committed at. The
    /// Administration Building caps that level, so the one comparison the
    /// off-screen path makes has a ceiling and no figure to hold against it.
    /// </summary>
    public class StrategyRP0WithUnreadableFactor : StrategyRP0
    {
        public new double Factor => throw new System.InvalidOperationException("Factor unreadable");
    }
}

namespace RP0.Programs
{
    /// <summary>
    /// The subclass whose activation RP-1 splits across
    /// <c>PerformActivate</c> and <c>OnRegister</c>.
    /// </summary>
    public class ProgramStrategy : StrategyRP0
    {
        public Program? Program { get; set; }

        /// <summary>RP-1's rule, in RP-1's words.</summary>
        public override bool CanDeactivate(ref string reason)
        {
            if (Program == null || !Program.CanComplete)
            {
                reason = "This Program has unmet objectives.";
                return false;
            }
            return true;
        }

        /// <summary>
        /// Where RP-1 completes a Program, and only while the Administration
        /// Building is open.
        /// </summary>
        public override void OnUnregister()
        {
            if (ProgramHandler.Instance != null && ProgramHandler.Instance.IsInAdmin && Program != null
                && Program.CanComplete)
            {
                ProgramHandler.Instance.CompleteProgram(Program);
            }
        }
    }

    public partial class ProgramHandler
    {
        /// <summary>
        /// Records the call and performs the moves the command relies on: the
        /// Program leaves the active list for the completed one and stops
        /// answering <c>CanComplete</c>.
        /// </summary>
        public void CompleteProgram(Program p)
        {
            StrategyCallLog.Calls.Add("CompleteProgram");
            ActivePrograms.Remove(p);
            CompletedPrograms.Add(p);
            p.completedUT = 99999.0;
            p.CanComplete = false;
        }

        /// <summary>The same-named overload beside it, which the command must not pick.</summary>
        public Program? CompleteProgram(string programName)
        {
            StrategyCallLog.Calls.Add("CompleteProgram(string)");
            return null;
        }
    }
}

namespace RP0.ModIntegrations
{
    public static class AlarmHelper
    {
        public static bool DeleteAllAlarmsWithTitle(string title, bool useStartsWith = false)
        {
            Programs.StrategyCallLog.Calls.Add("DeleteAlarms:" + title);
            return true;
        }
    }
}

namespace RP0.Programs
{
    /// <summary>What the command called, in order, and what it would have used.</summary>
    public static class StrategyCallLog
    {
        public static List<string> Calls { get; } = new List<string>();

        /// <summary>
        /// The deadline <c>PerformActivate</c>'s alarm block saw. Zero means the
        /// template was still in place, which is the silent UT 0 alarm.
        /// </summary>
        public static double? AlarmDeadline { get; set; }

        public static void Reset()
        {
            Calls.Clear();
            AlarmDeadline = null;
        }
    }
}
