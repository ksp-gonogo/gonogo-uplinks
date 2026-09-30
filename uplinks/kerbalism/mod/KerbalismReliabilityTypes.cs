using System.Collections.Generic;
using Sitrep.Contract;

namespace Gonogo.KerbalismUplink
{
    /*
     * The reliability shapes this Uplink's reliability reader fills. Core
     * carries no reliability model, so these are Kerbalism's own and nothing
     * publishes them: the reader, the maps and the repair path stay buildable
     * and tested until Kerbalism declares reliability Topics of its own.
     */

    /// <summary>Which of five states a reliability reading is in, as a lower-case id.</summary>
    public static class ReliabilityCoverage
    {
        /// <summary>No reliability model is installed.</summary>
        public const string None = "none";

        /// <summary>A model is installed and could not be reached.</summary>
        public const string Unavailable = "unavailable";

        /// <summary>A model is installed and switched off in this save.</summary>
        public const string Disabled = "disabled";

        /// <summary>A model is installed and could not say whether it is switched on.</summary>
        public const string Indeterminate = "indeterminate";

        /// <summary>A model is installed, switched on and reporting.</summary>
        public const string Modeled = "modeled";
    }

    /// <summary>Which model is speaking for the craft and how much it can say.</summary>
    public class ReliabilitySummary
    {
        /// <summary>The reliability model's id.</summary>
        public string? Source { get; set; }

        /// <summary>One of <see cref="ReliabilityCoverage"/>.</summary>
        public string? Coverage { get; set; }

        /// <summary>The model's own sub-tree, keyed by its id, or null when it has nothing to add.</summary>
        public Dictionary<string, object?>? Extensions { get; set; }
    }

    /// <summary>One consumed dimension of a part's life, named by the model.</summary>
    public class ReliabilityBudget
    {
        /// <summary>The budget's id.</summary>
        public string? Id { get; set; }

        /// <summary>What an operator reads for it.</summary>
        public string? Label { get; set; }

        /// <summary>Whether it is spent in seconds or in counts.</summary>
        public string? Kind { get; set; }

        /// <summary>How much of it is spent, from zero to one.</summary>
        public double? Consumed { get; set; }

        /// <summary>Seconds spent.</summary>
        public double? UsedSeconds { get; set; }

        /// <summary>Seconds allowed.</summary>
        public double? LimitSeconds { get; set; }

        /// <summary>Counts spent.</summary>
        public double? UsedCount { get; set; }

        /// <summary>Counts allowed.</summary>
        public double? LimitCount { get; set; }
    }

    /// <summary>One modelled part aboard the craft.</summary>
    public class ReliabilityPartEntry
    {
        /// <summary>The id a repair addresses the part by.</summary>
        public string? PartId { get; set; }

        /// <summary>The crew trait a repair needs, or null when anyone may.</summary>
        public string? RepairTrait { get; set; }

        /// <summary>The trait level a repair needs.</summary>
        public int? RepairLevel { get; set; }

        /// <summary>The part's title.</summary>
        public string? Title { get; set; }

        /// <summary>The part's condition id.</summary>
        public string? Condition { get; set; }

        /// <summary>What the condition means for this part, in the model's words.</summary>
        public string? ConditionDetail { get; set; }

        /// <summary>The chance the part survives its horizon, from zero to one.</summary>
        public double? Survival { get; set; }

        /// <summary>The span <see cref="Survival"/> is over, in seconds.</summary>
        public double? SurvivalHorizonSeconds { get; set; }

        /// <summary>Each consumed dimension of the part's life.</summary>
        public IReadOnlyList<ReliabilityBudget>? Budgets { get; set; }

        /// <summary>What a repair consumes.</summary>
        public IReadOnlyList<RepairCostItem>? RepairCost { get; set; }

        /// <summary>The model's own sub-tree, keyed by its id, or null when it has nothing to add.</summary>
        public Dictionary<string, object?>? Extensions { get; set; }
    }

    /// <summary>One resource a repair consumes.</summary>
    public class RepairCostItem
    {
        /// <summary>The resource's name.</summary>
        public string Name { get; set; } = "";

        /// <summary>How many a repair takes.</summary>
        public int Quantity { get; set; }
    }

    /// <summary>What one repair did.</summary>
    public class RepairOutcome
    {
        /// <summary>Whether the part is repaired.</summary>
        public bool Repaired { get; set; }

        /// <summary>Repair kits consumed.</summary>
        public int KitsUsed { get; set; }

        /// <summary>The part the kits came from, or null when none were used.</summary>
        public string? KitsFrom { get; set; }
    }

    /// <summary>Why a repair was refused, each refining the root a client classifies it by.</summary>
    public static class RepairRefusal
    {
        /// <summary>No crew member aboard has that name.</summary>
        public static readonly RefusalCode NoSuchCrew =
            CommandErrorCode.NotFound.Refine("kerbalism.noSuchCrew", "no crew member aboard has that name");

        /// <summary>That crew member lacks the trait or level the repair needs.</summary>
        public static readonly RefusalCode CrewNotQualified =
            CommandErrorCode.CapabilityMismatch.Refine("kerbalism.crewNotQualified", "that crew member is not qualified to repair it");

        /// <summary>The crew cannot get out to the part yet.</summary>
        public static readonly RefusalCode EvaImpossible =
            CommandErrorCode.NotClearToProceed.Refine("kerbalism.evaImpossible", "the crew cannot get out to it yet");

        /// <summary>The repair needs more kits than the craft carries.</summary>
        public static readonly RefusalCode NoKits =
            CommandErrorCode.InsufficientResource.Refine("kerbalism.noKits", "there are not enough repair kits aboard");

        /// <summary>Kerbalism is not modelling part failures in this save.</summary>
        public static readonly RefusalCode NotModelled =
            CommandErrorCode.ModeUnavailable.Refine("kerbalism.notModelled", "Kerbalism is not modelling part failures here");

        /// <summary>No part aboard needs that repair.</summary>
        public static readonly RefusalCode NoSuchPart =
            CommandErrorCode.NotFound.Refine("kerbalism.noSuchPart", "no part aboard needs that repair");
    }
}
