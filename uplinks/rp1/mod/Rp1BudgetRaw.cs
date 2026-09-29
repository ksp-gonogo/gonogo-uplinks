using System.Collections.Generic;

namespace GonogoRp1Uplink
{
    /// <summary>
    /// RP-1's budget as the main thread read it: plain data with no live RP-1
    /// object in it, so it can cross to the Courier. Every figure is nullable
    /// and null means RP-1 would not give it, never zero.
    /// </summary>
    public sealed class Rp1BudgetRaw
    {
        /// <summary>RP-1's <c>MaintenanceHandler.lastUpdate</c>: when it last refreshed its upkeep.</summary>
        public double? RefreshedAt;

        public Rp1BudgetPeriodRaw? Day;
        public Rp1BudgetPeriodRaw? Month;
        public Rp1BudgetPeriodRaw? Year;

        public double? Reputation;
        public double? SubsidyPerDay;
        public double? SubsidyMinPerDay;
        public double? SubsidyMaxPerDay;
        public double? SubsidyMaxRep;
        public double? ReputationDecayPerDay;
        public double? ReputationDecayPerYear;
        public double? UnlockCreditBalance;

        /// <summary>Null as a whole when any one horizon went unanswered: a forecast with a hole in it would draw a line through the hole.</summary>
        public List<Rp1BudgetForecastRaw>? Forecast;
    }

    /// <summary>One column of RP-1's Budget tab, signed as RP-1 signs it: negative is money going out.</summary>
    public sealed class Rp1BudgetPeriodRaw
    {
        public double Span;
        public double? FundsDelta;
        public double? Facilities;
        public double? IntegrationTeams;
        public double? ResearchTeams;
        public double? Astronauts;
        public double? Upkeep;
        public double? UpkeepBeforeModifiers;
        public double? UpkeepModifiers;
        public double? Subsidy;
        public double? Net;
        public double? Rollout;
        public double? Constructions;
        public double? ProgramBudget;
        public double? Balance;
        public double? UnlockCredit;
    }

    /// <summary>RP-1's net funds change from now to <see cref="Horizon"/> seconds ahead.</summary>
    public sealed class Rp1BudgetForecastRaw
    {
        public double Horizon;
        public double FundsDelta;
    }
}
