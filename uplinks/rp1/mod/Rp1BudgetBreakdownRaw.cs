using System.Collections.Generic;

namespace GonogoRp1Uplink
{
    /// <summary>
    /// The lines under RP-1's Budget tab as the main thread read them: plain data
    /// with no live RP-1 object in it, so it can cross to the Courier. Every
    /// figure is nullable and null means RP-1 would not give it, never zero.
    /// </summary>
    public sealed class Rp1BudgetBreakdownRaw
    {
        /// <summary>RP-1's <c>MaintenanceHandler.lastUpdate</c>: when it last refreshed its upkeep.</summary>
        public double? RefreshedAt;

        public List<Rp1BuildingUpkeepRaw>? Buildings;
        public List<Rp1ComplexUpkeepRaw>? Complexes;
        public List<Rp1CrewCostRaw>? Crew;
        public Rp1HorizonsRaw? AstronautBase;
        public Rp1HorizonsRaw? NautBaseSalary;
        public Rp1HorizonsRaw? AstronautOperational;
        public Rp1HorizonsRaw? AstronautTraining;
        public List<Rp1CourseCostRaw>? Courses;
        public List<Rp1TrainingFeeRaw>? TrainingFees;
        public List<Rp1ProgramFundingRaw>? Programs;
        public List<Rp1IntegrationTeamCostRaw>? IntegrationTeams;
        public List<Rp1RolloutCostRaw>? Rollouts;
        public List<Rp1ConstructionCostRaw>? Constructions;
    }

    /// <summary>One line at the Budget tab's three horizons, signed as RP-1 signs it: negative is money going out.</summary>
    public sealed class Rp1HorizonsRaw
    {
        public double? Day;
        public double? Month;
        public double? Year;
    }

    public sealed class Rp1BuildingUpkeepRaw
    {
        public string? Facility;
        public Rp1HorizonsRaw? Upkeep;
    }

    public sealed class Rp1ComplexUpkeepRaw
    {
        public string? LcId;
        public string? Name;
        public string? KscName;
        public string? KscDisplayName;
        public bool? Operational;
        public Rp1HorizonsRaw? Upkeep;
    }

    public sealed class Rp1CrewCostRaw
    {
        public string? Name;
        public bool? InFlight;
        public Rp1HorizonsRaw? Cost;
    }

    public sealed class Rp1CourseCostRaw
    {
        public string? Id;
        public int? Students;
        public Rp1HorizonsRaw? Cost;
    }

    public sealed class Rp1TrainingFeeRaw
    {
        public string? TemplateId;
        public Rp1HorizonsRaw? PerStudent;
    }

    public sealed class Rp1ProgramFundingRaw
    {
        public string? Name;
        public string? Title;
        public double? DeadlineUt;
        public Rp1HorizonsRaw? Funding;
    }

    public sealed class Rp1IntegrationTeamCostRaw
    {
        public string? KscName;
        public string? KscDisplayName;
        public bool? Unassigned;
        public string? LcId;
        public string? Name;
        public int? Engineers;
        public Rp1HorizonsRaw? Cost;
    }

    public sealed class Rp1RolloutCostRaw
    {
        public string? KscName;
        public string? KscDisplayName;
        public string? LcId;
        public string? LcName;
        public string? LaunchPadId;
        public string? Type;
        public string? AssociatedVesselId;
        public string? VesselName;
        public Rp1HorizonsRaw? Cost;
    }

    public sealed class Rp1ConstructionCostRaw
    {
        public string? Id;
        public string? KscName;
        public string? KscDisplayName;
        public string? Kind;
        public string? Name;
        public Rp1HorizonsRaw? Cost;
    }
}
