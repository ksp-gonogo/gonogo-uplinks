// Setting the research queue's work rate: the one slider RP-1 draws under its
// research list (KCT_GUI's tech list, the "Work rate:" row).
//
// IT IS THE WHOLE OF WHAT RP-1 DOES, read on the shipped RP-1 v4.6.0.0 and
// v4.7.0.0 RP0.dll, which agree on every member below:
//
//   num3 = (double)Mathf.RoundToInt(slider * 20f) * 0.05
//   if (num3 != techList[0].workRate)
//       foreach (ResearchProject item in techList) item.workRate = num3;
//       MaintenanceHandler.Instance?.ScheduleMaintenanceUpdate();
//
// over 0 to 1, drawn only while the queue holds a node. The rate is written onto
// every node, but only the first one's is ever read for money:
// MaintenanceHandler.UpdateUpkeep pays researchers at TechList[0].workRate and
// UnlockCreditHandler.CreditForTime earns at it. ResearchProject.BuildRate
// multiplies each node's own rate in, and only the first node progresses.
//
// The upkeep update is scheduled as RP-1 schedules it, because the researcher
// salary is a figure UpdateUpkeep computes and caches: without it RP-1's budget
// would quote the old payroll until its own hourly timer.
//
// NOTHING HERE IS REFUSED ON AFFORDABILITY. Researchers are paid every day at
// any rate, the idle share of their salary when stopped. A higher rate is a
// bigger daily draw that buys speed and Unlock Credit, never a refused one.
using System;
using Sitrep.Contract;

namespace GonogoRp1Uplink
{
    /// <summary><c>rp1.research.setRate</c>.</summary>
    public sealed class Rp1ResearchRateCommands
    {
        public const string SetRateCommand = "rp1.research.setRate";

        /// <summary>RP-1's slider steps: twenty to the full rate, which is also its top.</summary>
        public const int Steps = 20;

        private const string ScmTypeName = "RP0.SpaceCenterManagement";
        private const string MaintenanceTypeName = "RP0.MaintenanceHandler";

        private readonly Type? _scm;
        private readonly Type? _maintenance;

        public Rp1ResearchRateCommands()
        {
            _scm = Rp1Types.Find(ScmTypeName);
            _maintenance = Rp1Types.Find(MaintenanceTypeName);
        }

        /// <summary>RP-1's space centre type resolved, so the command can be offered at all.</summary>
        public bool IsAvailable => _scm != null;

        /// <summary>
        /// The slider step a rate names, or null when it is off RP-1's range or
        /// between two steps. Refused rather than rounded, so what lands is what
        /// the operator was shown.
        /// </summary>
        public static int? StepOf(double workRate)
        {
            if (double.IsNaN(workRate) || workRate < 0 || workRate > 1 + 1e-9)
            {
                return null;
            }
            var step = Math.Round(workRate * Steps);
            return Math.Abs(step - workRate * Steps) > 1e-6 ? (int?)null : (int)step;
        }

        /// <summary>A slider step as the value RP-1's slider stores for it.</summary>
        public static double RateAt(int step) => step * 0.05;

        /// <summary>Set the work rate on every queued node, as RP-1's slider does.</summary>
        public CommandResult SetRate(Rp1ResearchRateArgs? args)
        {
            try
            {
                if (args?.WorkRate == null)
                {
                    return CommandResult.Fail(CommandErrorCode.Range, "A work rate is required.");
                }
                var step = StepOf(args.WorkRate.Value);
                if (step == null)
                {
                    return CommandResult.Fail(
                        CommandErrorCode.Range,
                        "The work rate must be from 0% to 100% in steps of 5%, as RP-1's slider sets it.");
                }

                var instance = _scm == null ? null : Rp1Types.StaticValue(_scm, "Instance");
                if (instance == null)
                {
                    return CommandResult.Fail(Rp1ErrorCodes.SpaceCentreNotLoaded);
                }

                var rate = RateAt(step.Value);
                var written = 0;
                foreach (var project in Rp1Types.Enumerate(Rp1Types.Member(instance, "TechList")))
                {
                    if (!Rp1Types.WriteDouble(project, "workRate", rate))
                    {
                        return CommandResult.Fail(CommandErrorCode.ModeUnavailable, "RP-1's research work rate could not be written.");
                    }
                    written++;
                }
                if (written == 0)
                {
                    return CommandResult.Fail(
                        CommandErrorCode.WrongState,
                        "The research queue is empty, so there is no work rate to set.");
                }

                var maintenance = _maintenance == null ? null : Rp1Types.StaticValue(_maintenance, "Instance");
                if (maintenance != null)
                {
                    Rp1Types.InstanceMethod(maintenance, "ScheduleMaintenanceUpdate", 0)?.Invoke(maintenance, null);
                }
                return CommandResult.Ok();
            }
            catch (Exception e)
            {
                return CommandResult.Fail(
                    CommandErrorCode.WrongState,
                    "Setting the research work rate failed: " + Rp1Types.ExceptionReason(e));
            }
        }
    }
}
