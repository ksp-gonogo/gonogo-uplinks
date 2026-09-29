// Stand-ins for the leader members Rp1LeadersReflection reads, in the namespaces
// RP-1 declares them in. What they cannot prove is stated in Rp0Fixture's
// header: a rename on RP-1's side is Rp1ReflectionTargets' job, against the
// shipped binary. These prove which rule refuses and in what words.
using System.Collections.Generic;

namespace RP0
{
    /// <summary>
    /// RP-1's leader config, carrying the three rules its Administration list
    /// applies outside <c>CanBeActivated</c>.
    /// </summary>
    public class StrategyConfigRP0 : Strategies.StrategyConfig
    {
        /// <summary>The fixture's clock, standing in for Planetarium.</summary>
        public static double Now { get; set; }

        public bool IsDisabled { get; set; }

        /// <summary>What the compiled REQUIREMENTS predicate answers.</summary>
        public bool Unlocked { get; set; } = true;

        public Dictionary<CurrencyRP0, double> SetupCosts { get; set; } = new Dictionary<CurrencyRP0, double>();

        public bool RemoveOnDeactivate { get; set; } = true;

        public string RemoveOnDeactivateTag { get; set; } = "";

        public double ReactivateCooldown { get; set; }

        public virtual bool IsUnlocked() => Unlocked;

        /// <summary>RP-1's own body, against the fixture's clock and activation stamps.</summary>
        public virtual bool IsAvailable(double dateDeactivated)
        {
            if (dateDeactivated < 0.0)
            {
                return false;
            }
            var stamps = Programs.ProgramHandler.Instance!.ActivatedStrategies;
            var own = RemoveOnDeactivate && stamps.TryGetValue(Name, out var a) ? a : 0.0;
            var tagged = !string.IsNullOrEmpty(RemoveOnDeactivateTag) && stamps.TryGetValue(RemoveOnDeactivateTag, out var b) ? b : 0.0;
            var last = System.Math.Max(own, tagged);
            if (last > 0.0 && (ReactivateCooldown == 0.0 || last + ReactivateCooldown > Now))
            {
                return false;
            }
            return IsUnlocked();
        }
    }

    public partial class StrategyRP0
    {
        public StrategyConfigRP0? ConfigRP0 => Config as StrategyConfigRP0;

        public double DateDeactivated { get; set; }

        public double RemovePenaltyDuration { get; set; }

        /// <summary>What <c>DeactivateCost()</c> answers now; set by a test.</summary>
        public double CostNow { get; set; }

        public virtual double DeactivateCost() => CostNow;
    }
}

namespace RP0.Programs
{
    public partial class ProgramHandler
    {
        /// <summary>RP-1's appointment and dismissal stamps: -1 while serving, the dismissal UT after.</summary>
        public Dictionary<string, double> ActivatedStrategies { get; set; } = new Dictionary<string, double>();
    }
}
