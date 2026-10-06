using System.Collections.Generic;

// The members RP-1's budget screens call, on the stand-ins Rp0Fixture declares.
// Names, arities and overload sets are the shipped v4.6.0.0 ones; the bodies
// are RP-1's own where the arithmetic is the thing under test (GetBudgetDelta)
// and a settable figure where it is not, so a test can tell which argument
// reached which member.
namespace RP0
{
    public partial class MaintenanceHandler
    {
        /// <summary>When RP-1 last refreshed its upkeep, which is what the budget reading keys on.</summary>
        public double lastUpdate;

        /// <summary>The yearly subsidy averaged over no time at all.</summary>
        public static double AverageSubsidyPerYear = 7305.0;

        /// <summary>
        /// How much the average climbs per year of horizon, so a Year column
        /// averaged over its own horizon differs from 365.25 Day columns.
        /// </summary>
        public static double AverageSubsidyGrowthPerYear;

        /// <summary>The spans asked for, and the step count with each.</summary>
        public static readonly List<(double DeltaTime, int Steps)> AverageSubsidyAsks = new List<(double, int)>();

        public static double GetAverageSubsidyForPeriod(double deltaTime, int steps = 0)
        {
            AverageSubsidyAsks.Add((deltaTime, steps));
            return AverageSubsidyPerYear + AverageSubsidyGrowthPerYear * deltaTime / (86400d * 365.25d);
        }

        public static void ResetBudget()
        {
            AverageSubsidyPerYear = 7305.0;
            AverageSubsidyGrowthPerYear = 0.0;
            AverageSubsidyAsks.Clear();
        }
    }

    public partial class SpaceCenterManagement
    {
        /// <summary>Construction spending per day, negative as RP-1 signs it.</summary>
        public double ConstructionCostPerDay;

        /// <summary>Rollout and air-launch spending per day, negative as RP-1 signs it.</summary>
        public double RolloutCostPerDay;

        public bool ThrowOnBudgetDelta;

        /// <summary>The spans GetBudgetDelta was asked for, in order.</summary>
        public readonly List<double> BudgetDeltaAsks = new List<double>();

        /// <summary>The settable per-day figure, plus RP-1's own sum over every centre's constructions.</summary>
        public double GetConstructionCostOverTime(double time)
        {
            var total = ConstructionCostPerDay * time / 86400d;
            foreach (var ksc in KSCs)
            {
                total += GetConstructionCostOverTime(time, ksc);
            }
            return total;
        }

        /// <summary>RP-1's own body.</summary>
        public double GetConstructionCostOverTime(double time, LCSpaceCenter ksc)
        {
            var total = 0.0;
            foreach (var construction in ksc.Constructions)
            {
                total += construction.GetConstructionCostOverTime(time);
            }
            return total;
        }

        public double GetConstructionCostOverTime(double time, string kscName) => 0.0;

        /// <summary>The settable per-day figure, plus RP-1's own sum over every centre's operations.</summary>
        public double GetReconRolloutCostOverTime(double time)
        {
            var total = RolloutCostPerDay * time / 86400d;
            foreach (var ksc in KSCs)
            {
                total += GetReconRolloutCostOverTime(time, ksc);
            }
            return total;
        }

        /// <summary>RP-1's own body.</summary>
        public double GetReconRolloutCostOverTime(double time, LCSpaceCenter ksc)
        {
            var total = 0.0;
            foreach (var lc in ksc.LaunchComplexes)
            {
                total += GetReconRolloutCostOverTime(time, lc);
            }
            return total;
        }

        /// <summary>RP-1's own body: one currency query per operation that bills.</summary>
        public double GetReconRolloutCostOverTime(double time, LaunchComplex lc)
        {
            var total = 0.0;
            foreach (var op in lc.Recon_Rollout)
            {
                if (op.RRType == ReconRolloutProject.RolloutReconType.Rollout
                    || op.RRType == ReconRolloutProject.RolloutReconType.Reconditioning
                    || op.RRType == ReconRolloutProject.RolloutReconType.AirlaunchMount)
                {
                    var timeLeft = op.GetTimeLeft();
                    var share = 1.0;
                    if (timeLeft > time)
                    {
                        share = time / timeLeft;
                    }
                    total += CurrencyUtils.Funds(op.TransactionReason, -op.cost * (1.0 - op.progress / op.BP) * share);
                }
            }
            return total;
        }

        /// <summary>RP-1's own body, line for line.</summary>
        public double GetBudgetDelta(double deltaTime)
        {
            BudgetDeltaAsks.Add(deltaTime);
            if (ThrowOnBudgetDelta)
            {
                throw new System.InvalidOperationException("no budget");
            }
            if (MaintenanceHandler.Instance == null)
            {
                return 0;
            }
            var averageSubsidyPerDay = CurrencyUtils.Funds(
                TransactionReasonsRP0.Subsidy, MaintenanceHandler.GetAverageSubsidyForPeriod(deltaTime)) * (1d / 365.25d);
            return System.Math.Min(0d, MaintenanceHandler.Instance.UpkeepPerDayForDisplay + averageSubsidyPerDay) * deltaTime * (1d / 86400d)
                + GetConstructionCostOverTime(deltaTime) + GetReconRolloutCostOverTime(deltaTime)
                + Programs.ProgramHandler.Instance!.GetDisplayProgramFunding(deltaTime);
        }
    }

    public partial class UnlockCreditHandler
    {
        /// <summary>Credit earned per second of research, before the rate modifier.</summary>
        public double CreditPerSecond;

        /// <summary>The research times asked about, in order.</summary>
        public readonly List<double> CreditAsks = new List<double>();

        public double CreditForTime(double UT)
        {
            CreditAsks.Add(UT);
            return UT * CreditPerSecond;
        }
    }

    public partial class ResearchProject
    {
        public double BuildRate => _buildRate * workRate;

        public double TimeLeft => (scienceCost - progress) / BuildRate;

        /// <summary>What a node not yet being researched is estimated to take.</summary>
        public double EstimatedTimeLeft;

        /// <summary>The offsets an estimate was asked for, which is when the walk thinks this node starts.</summary>
        public readonly List<double> EstimateOffsets = new List<double>();

        public double GetTimeLeftEst(double offset)
        {
            if (BuildRate > 0.0)
            {
                return TimeLeft;
            }
            EstimateOffsets.Add(offset);
            return EstimatedTimeLeft;
        }
    }
}

namespace RP0.Programs
{
    public partial class ProgramHandler
    {
        /// <summary>What the running Programs pay per day, before the ProgramFunding modifier.</summary>
        public double FundingPerDay;

        public double GetDisplayProgramFunding(double utOffset) =>
            CurrencyUtils.Funds(TransactionReasonsRP0.ProgramFunding, FundingPerDay * utOffset / 86400d);
    }
}

// KSP's own, global-namespaced as KSP declares it: a public static Instance and
// a public float getter over a private field.
public class Reputation
{
    public static Reputation? Instance;

    private readonly float _rep;

    public Reputation(float rep)
    {
        _rep = rep;
    }

    public float reputation => _rep;
}
