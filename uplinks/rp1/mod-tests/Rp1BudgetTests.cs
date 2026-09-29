using System;
using System.Collections.Generic;
using System.Linq;
using GonogoRp1Uplink;
using RP0;
using RP0.Programs;
using Xunit;

/// <summary>
/// RP-1's budget, against the stand-in object graph: every Budget tab row at
/// each of its three horizons, RP-1's own net, the reputation tooltip's
/// figures, the Unlock Credit accrual walk and the forecast.
///
/// <para>The stand-in carries distinct costs, distinct per-reason modifiers and
/// an affine offset on one reason, so a row priced against the wrong reason, or
/// scaled after the query rather than before it, lands on a different number.</para>
/// </summary>
[Collection("rp0-static-graph")]
public class Rp1BudgetTests : IDisposable
{
    private const double Day = 86400d;
    private const double Ut = 1_000_000d;

    public Rp1BudgetTests() => Clear();

    public void Dispose() => Clear();

    private static void Clear()
    {
        MaintenanceHandler.Instance = null;
        SpaceCenterManagement.Instance = null;
        ProgramHandler.Instance = null;
        UnlockCreditHandler.Instance = null;
        Reputation.Instance = null;
        CurrencyUtils.Reset();
        MaintenanceHandler.ResetBudget();
    }

    /// <summary>A career with every row non-zero and every line on a cost of its own.</summary>
    private static void ACareer()
    {
        MaintenanceHandler.Instance = new MaintenanceHandler
        {
            FacilityUpkeepValue = 100.0,
            LCsCostPerDay = 200.0,
            IntegrationSalaryValue = 300.0,
            ResearchSalaryPerDay = 400.0,
            NautBaseUpkeepPerDay = 50.0,
            NautInFlightUpkeepPerDay = 25.0,
            TrainingUpkeepPerDay = 10.0,
            lastUpdate = 3600.0,
        };
        MaintenanceHandler.Instance.UpdateUpkeep();
        SpaceCenterManagement.Instance = new SpaceCenterManagement
        {
            ConstructionCostPerDay = -70.0,
            RolloutCostPerDay = -30.0,
        };
        ProgramHandler.Instance = new ProgramHandler { FundingPerDay = 2000.0 };
        UnlockCreditHandler.Instance = new UnlockCreditHandler(12345.0) { CreditPerSecond = 0.01 };
        Reputation.Instance = new Reputation(50f);
        // Small enough that the upkeep outruns it, so Net is not clamped.
        MaintenanceHandler.AverageSubsidyPerYear = 365.25 * 500.0;
    }

    private static Rp1BudgetRaw Read() => new Rp1BudgetReflection().CaptureOnMain(Ut)!;

    [Fact]
    public void Nothing_is_said_while_RP1_is_not_running_a_career()
    {
        Assert.Null(new Rp1BudgetReflection().CaptureOnMain(Ut));
        Assert.Null(Rp1BudgetCapture.Build(null));
    }

    [Fact]
    public void Nothing_is_said_without_a_space_centre_even_with_a_maintenance_handler()
    {
        ACareer();
        SpaceCenterManagement.Instance = null;
        Assert.Null(new Rp1BudgetReflection().CaptureOnMain(Ut));
    }

    [Fact]
    public void Each_upkeep_row_is_priced_against_its_own_reason_as_the_Budget_tab_prices_it()
    {
        ACareer();
        CurrencyUtils.Multipliers[TransactionReasonsRP0.StructureRepair] = 0.5;
        CurrencyUtils.Multipliers[TransactionReasonsRP0.StructureRepairLC] = 0.25;
        CurrencyUtils.Multipliers[TransactionReasonsRP0.SalaryEngineers] = 2.0;
        CurrencyUtils.Multipliers[TransactionReasonsRP0.SalaryResearchers] = 0.75;
        CurrencyUtils.Multipliers[TransactionReasonsRP0.SalaryCrew] = 0.5;
        CurrencyUtils.Multipliers[TransactionReasonsRP0.CrewTraining] = 3.0;

        var day = Read().Day!;

        Assert.Equal(-(100.0 * 0.5 + 200.0 * 0.25), day.Facilities);
        Assert.Equal(-300.0 * 2.0, day.IntegrationTeams);
        Assert.Equal(-400.0 * 0.75, day.ResearchTeams);
        Assert.Equal(-((50.0 + 25.0) * 0.5 + 10.0 * 3.0), day.Astronauts);
    }

    [Fact]
    public void A_column_is_RP1s_own_computation_at_that_horizon_rather_than_a_scaled_day()
    {
        // An affine modifier is where the two differ: RP-1 scales the cost first
        // and queries once, so the offset lands once per column. A Month built as
        // thirty Days would carry it thirty times.
        ACareer();
        CurrencyUtils.PostDeltas[TransactionReasonsRP0.SalaryEngineers] = -10.0;

        var raw = Read();

        Assert.Equal(1 * Day, raw.Day!.Span);
        Assert.Equal(30 * Day, raw.Month!.Span);
        Assert.Equal(365.25 * Day, raw.Year!.Span);
        Assert.Equal(-300.0 - 10.0, raw.Day.IntegrationTeams);
        Assert.Equal(-300.0 * 30 - 10.0, raw.Month.IntegrationTeams);
        Assert.Equal(-300.0 * 365.25 - 10.0, raw.Year.IntegrationTeams);
    }

    [Fact]
    public void The_subsidy_is_averaged_over_each_horizon_and_then_scaled_from_a_year()
    {
        ACareer();
        MaintenanceHandler.AverageSubsidyGrowthPerYear = 365.25 * 100.0;
        CurrencyUtils.Multipliers[TransactionReasonsRP0.Subsidy] = 2.0;

        var raw = Read();

        // Asked once per column over that column's own span, with RP-1's default
        // step count.
        Assert.Contains((1 * Day, 0), MaintenanceHandler.AverageSubsidyAsks);
        Assert.Contains((30 * Day, 0), MaintenanceHandler.AverageSubsidyAsks);
        Assert.Contains((365.25 * Day, 0), MaintenanceHandler.AverageSubsidyAsks);

        double Expected(double days) =>
            (365.25 * 500.0 + 365.25 * 100.0 * days / 365.25) * 2.0 * (days / 365.25);
        Assert.Equal(Expected(1), raw.Day!.Subsidy!.Value, 6);
        Assert.Equal(Expected(365.25), raw.Year!.Subsidy!.Value, 6);
        Assert.NotEqual(raw.Day.Subsidy!.Value * 365.25, raw.Year.Subsidy!.Value, 6);
    }

    [Fact]
    public void Net_is_the_upkeep_plus_the_subsidy_and_the_balance_adds_what_falls_inside_the_horizon()
    {
        ACareer();
        var day = Read().Day!;

        var upkeep = -(100.0 + 200.0) - 300.0 - 400.0 - (50.0 + 25.0 + 10.0);
        Assert.Equal(upkeep + 500.0, day.Net!.Value, 9);
        Assert.Equal(-30.0, day.Rollout);
        Assert.Equal(-70.0, day.Constructions);
        Assert.Equal(2000.0, day.ProgramBudget);
        Assert.Equal(day.Net.Value - 30.0 - 70.0 + 2000.0, day.Balance!.Value, 9);
    }

    [Fact]
    public void The_upkeep_total_is_the_four_rows_the_tab_adds_the_subsidy_to()
    {
        ACareer();
        CurrencyUtils.Multipliers[TransactionReasonsRP0.StructureRepair] = 0.5;
        CurrencyUtils.Multipliers[TransactionReasonsRP0.CrewTraining] = 3.0;

        var raw = Read();

        foreach (var period in new[] { raw.Day!, raw.Month!, raw.Year! })
        {
            var rows = period.Facilities!.Value + period.IntegrationTeams!.Value
                + period.ResearchTeams!.Value + period.Astronauts!.Value;
            Assert.Equal(rows, period.Upkeep!.Value, 6);
        }
    }

    [Fact]
    public void Upkeep_before_modifiers_is_the_raw_costs_and_the_modifiers_are_what_the_query_changed()
    {
        ACareer();
        CurrencyUtils.Multipliers[TransactionReasonsRP0.SalaryResearchers] = 0.5;
        CurrencyUtils.Multipliers[TransactionReasonsRP0.CrewTraining] = 3.0;

        var raw = Read();

        var perDay = 100.0 + 200.0 + 300.0 + 400.0 + 50.0 + 25.0 + 10.0;
        Assert.Equal(-perDay, raw.Day!.UpkeepBeforeModifiers!.Value, 9);
        Assert.Equal(-perDay * 30, raw.Month!.UpkeepBeforeModifiers!.Value, 6);
        Assert.Equal(-perDay * 365.25, raw.Year!.UpkeepBeforeModifiers!.Value, 6);

        // Researchers at half pay save 200 a day; training at triple costs 20 more.
        Assert.Equal(200.0 - 20.0, raw.Day.UpkeepModifiers!.Value, 9);
        Assert.Equal((200.0 - 20.0) * 30, raw.Month.UpkeepModifiers!.Value, 6);
    }

    [Fact]
    public void With_no_modifier_the_modifiers_are_zero_rather_than_absent()
    {
        ACareer();
        var day = Read().Day!;
        Assert.Equal(0.0, day.UpkeepModifiers!.Value, 9);
        Assert.Equal(day.Upkeep!.Value, day.UpkeepBeforeModifiers!.Value, 9);
    }

    [Fact]
    public void Net_never_rises_above_zero_because_the_subsidy_only_pays_down_upkeep()
    {
        ACareer();
        MaintenanceHandler.AverageSubsidyPerYear = 365.25 * 1_000_000.0;

        var day = Read().Day!;

        Assert.Equal(0.0, day.Net);
        Assert.Equal(-30.0 - 70.0 + 2000.0, day.Balance!.Value, 9);
    }

    [Fact]
    public void RP1s_own_net_agrees_with_the_balance_until_a_crew_modifier_carries_an_offset()
    {
        ACareer();
        var raw = Read();
        Assert.Equal(raw.Day!.Balance!.Value, raw.Day.FundsDelta!.Value, 6);
        Assert.Equal(raw.Year!.Balance!.Value, raw.Year.FundsDelta!.Value, 3);

        // The tab queries base and in-flight crew apart and RP-1's own total
        // queries them together, so an offset on SalaryCrew lands twice in one
        // and once in the other. Both are RP-1's; neither is corrected.
        CurrencyUtils.PostDeltas[TransactionReasonsRP0.SalaryCrew] = -10.0;
        MaintenanceHandler.Instance!.UpdateUpkeep();
        MaintenanceHandler.Instance.lastUpdate = 7200.0;
        raw = Read();
        Assert.Equal(raw.Day!.FundsDelta!.Value - 10.0, raw.Day.Balance!.Value, 6);
    }

    [Fact]
    public void The_forecast_is_RP1s_net_at_twenty_quarter_years_out_to_five()
    {
        ACareer();
        var forecast = Read().Forecast!;

        Assert.Equal(20, forecast.Count);
        Assert.Equal(365.25 / 4 * Day, forecast[0].Horizon, 6);
        Assert.Equal(5 * 365.25 * Day, forecast[19].Horizon, 6);
        var year = forecast[3];
        Assert.Equal(365.25 * Day, year.Horizon, 6);
        Assert.Equal(Read().Year!.FundsDelta!.Value, year.FundsDelta, 6);
    }

    [Fact]
    public void An_unanswered_net_takes_the_forecast_and_the_net_and_leaves_the_rows()
    {
        ACareer();
        SpaceCenterManagement.Instance!.ThrowOnBudgetDelta = true;

        var raw = Read();

        Assert.Null(raw.Forecast);
        Assert.Null(raw.Day!.FundsDelta);
        Assert.NotNull(raw.Day.Balance);
    }

    [Fact]
    public void Without_Programs_the_Program_row_and_the_balance_are_absent_and_nothing_else_is()
    {
        ACareer();
        ProgramHandler.Instance = null;

        var day = Read().Day!;

        Assert.Null(day.ProgramBudget);
        Assert.Null(day.Balance);
        Assert.NotNull(day.Net);
        Assert.NotNull(day.Constructions);
    }

    [Fact]
    public void Unlock_credit_accrues_only_for_the_time_a_node_is_being_researched()
    {
        ACareer();
        var researching = new ResearchProject { scienceCost = 100, progress = 0 };
        researching.SetBuildRate(100.0 / (10 * Day));
        var waiting = new ResearchProject { EstimatedTimeLeft = 100 * Day };
        SpaceCenterManagement.Instance!.TechList.Add(researching);
        SpaceCenterManagement.Instance.TechList.Add(waiting);
        CurrencyUtils.Multipliers[TransactionReasonsRP0.RateUnlockCreditIncrease] = 0.5;

        var raw = Read();

        // A day: the first node alone, for the day.
        Assert.Equal(1 * Day * 0.01 * 0.5, raw.Day!.UnlockCredit!.Value, 6);
        // A month: ten days of the first, then twenty of the second, estimated as
        // of the moment it would start.
        Assert.Equal(30 * Day * 0.01 * 0.5, raw.Month!.UnlockCredit!.Value, 6);
        Assert.Contains(10 * Day, waiting.EstimateOffsets.Select(o => Math.Round(o, 6)));
        // A year: both nodes to completion, 110 days, and nothing after.
        Assert.Equal(110 * Day * 0.01 * 0.5, raw.Year!.UnlockCredit!.Value, 6);
        Assert.Equal(12345.0, raw.UnlockCreditBalance);
    }

    [Fact]
    public void An_idle_research_queue_accrues_zero_credit_which_is_an_answer()
    {
        ACareer();
        var raw = Read();
        Assert.Equal(0.0, raw.Day!.UnlockCredit);
    }

    [Fact]
    public void Without_the_credit_handler_credit_is_absent_rather_than_zero()
    {
        ACareer();
        UnlockCreditHandler.Instance = null;

        var raw = Read();

        Assert.Null(raw.UnlockCreditBalance);
        Assert.Null(raw.Day!.UnlockCredit);
    }

    [Fact]
    public void The_reputation_figures_are_the_tooltips_after_the_career_modifiers()
    {
        ACareer();
        CurrencyUtils.Multipliers[TransactionReasonsRP0.Subsidy] = 2.0;
        CurrencyUtils.Multipliers[TransactionReasonsRP0.DailyRepDecline] = 0.5;

        var raw = Read();

        // The stand-in's FillSubsidyDetails: 3652.5 to 7305 a year over 0 to 100
        // reputation, so 50 reputation buys the midpoint.
        Assert.Equal(50.0, raw.Reputation);
        Assert.Equal((3652.5 + 7305.0) / 2 * 2.0 / 365.25, raw.SubsidyPerDay!.Value, 9);
        Assert.Equal(3652.5 * 2.0 / 365.25, raw.SubsidyMinPerDay!.Value, 9);
        Assert.Equal(7305.0 * 2.0 / 365.25, raw.SubsidyMaxPerDay!.Value, 9);
        Assert.Equal(100.0, raw.SubsidyMaxRep);

        var portion = Database.SettingsSC!.repPortionLostPerDay;
        var perDay = 50.0 * portion * 0.5;
        Assert.Equal(perDay, raw.ReputationDecayPerDay!.Value, 9);

        var year = perDay * 5.25;
        var running = 50.0 - year;
        for (var i = 0; i < 12; i++)
        {
            var loss = running * portion * 0.5 * 30;
            running -= loss;
            year += loss;
        }
        Assert.Equal(year, raw.ReputationDecayPerYear!.Value, 9);
    }

    [Fact]
    public void Without_a_reputation_nothing_derived_from_one_is_said()
    {
        ACareer();
        Reputation.Instance = null;

        var raw = Read();

        Assert.Null(raw.Reputation);
        Assert.Null(raw.SubsidyPerDay);
        Assert.Null(raw.ReputationDecayPerDay);
        Assert.NotNull(raw.Day!.Net);
    }

    [Fact]
    public void Between_upkeep_refreshes_a_capture_asks_RP1_nothing()
    {
        ACareer();
        var reader = new Rp1BudgetReflection();
        var first = reader.CaptureOnMain(Ut);
        var asked = CurrencyUtils.Queries;

        Assert.Same(first, reader.CaptureOnMain(Ut + 60));
        Assert.Equal(asked, CurrencyUtils.Queries);

        MaintenanceHandler.Instance!.lastUpdate += 3600.0;
        Assert.NotSame(first, reader.CaptureOnMain(Ut + 3600));
        Assert.True(CurrencyUtils.Queries > asked);
    }

    [Fact]
    public void A_newly_loaded_career_is_read_afresh_even_with_the_same_refresh_stamp()
    {
        ACareer();
        var reader = new Rp1BudgetReflection();
        var first = reader.CaptureOnMain(Ut);

        var stamp = MaintenanceHandler.Instance!.lastUpdate;
        MaintenanceHandler.Instance = new MaintenanceHandler { lastUpdate = stamp };

        Assert.NotSame(first, reader.CaptureOnMain(Ut));
    }

    [Fact]
    public void Leaving_the_career_clears_the_reading()
    {
        ACareer();
        var reader = new Rp1BudgetReflection();
        Assert.NotNull(reader.CaptureOnMain(Ut));

        MaintenanceHandler.Instance = null;
        Assert.Null(reader.CaptureOnMain(Ut));
    }

    [Fact]
    public void The_payload_carries_every_row_under_its_contract_name()
    {
        ACareer();
        var payload = Rp1BudgetCapture.Build(Read())!;

        var contract = typeof(Rp1Budget).GetProperties().Select(p => Camel(p.Name)).OrderBy(n => n);
        Assert.Equal(contract, payload.Keys.OrderBy(n => n));

        var period = (Dictionary<string, object?>)payload["month"]!;
        var periodContract = typeof(Rp1BudgetPeriod).GetProperties().Select(p => Camel(p.Name)).OrderBy(n => n);
        Assert.Equal(periodContract, period.Keys.OrderBy(n => n));

        var sample = (Dictionary<string, object?>)((List<object?>)payload["forecast"]!)[0]!;
        var sampleContract = typeof(Rp1BudgetForecastSample).GetProperties().Select(p => Camel(p.Name)).OrderBy(n => n);
        Assert.Equal(sampleContract, sample.Keys.OrderBy(n => n));
    }

    private static string Camel(string name) => char.ToLowerInvariant(name[0]) + name.Substring(1);
}
