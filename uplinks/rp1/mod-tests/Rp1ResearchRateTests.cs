using System;
using System.Collections.Generic;
using System.Linq;
using GonogoRp1Uplink;
using RP0;
using Sitrep.Contract;
using Xunit;

/// <summary>
/// The research queue's work rate, and the salary, Unlock Credit and finish date
/// at every rate, against the stand-in graph.
/// </summary>
[Collection("rp0-static-graph")]
public class Rp1ResearchRateTests : IDisposable
{
    private const double Ut = 1_000_000.0;

    public Rp1ResearchRateTests() => Clear();

    public void Dispose() => Clear();

    private static void Clear()
    {
        SpaceCenterManagement.Instance = null;
        MaintenanceHandler.Instance = null;
        UnlockCreditHandler.Instance = null;
        CurrencyUtils.Reset();
        Database.SettingsSC.salaryResearchers = 1000;
        Database.SettingsSC.ResearcherIdleSalaryMult = 0.5;
        Database.SettingsSC.researchersToUnlockCreditSalaryMultipliers.Clear();
    }

    [Fact]
    public void Setting_the_rate_writes_it_on_every_queued_node_and_reprices_the_upkeep()
    {
        var (first, second) = Queue();

        var result = new Rp1ResearchRateCommands().SetRate(new Rp1ResearchRateArgs { WorkRate = 0.35 });

        Assert.True(result.Success, result.Detail);
        Assert.Equal(7 * 0.05, first.workRate);
        Assert.Equal(7 * 0.05, second.workRate);
        Assert.Equal(1, MaintenanceHandler.Instance!.UpkeepUpdatesScheduled);
    }

    [Theory]
    [InlineData(1.05)]
    [InlineData(-0.05)]
    [InlineData(0.33)]
    [InlineData(double.NaN)]
    public void A_rate_off_the_slider_is_refused_and_nothing_is_written(double workRate)
    {
        var (first, _) = Queue();

        var result = new Rp1ResearchRateCommands().SetRate(new Rp1ResearchRateArgs { WorkRate = workRate });

        Assert.Equal(CommandErrorCode.Range, result.ErrorCode);
        Assert.Equal(1.0, first.workRate);
        Assert.Equal(0, MaintenanceHandler.Instance!.UpkeepUpdatesScheduled);
    }

    [Fact]
    public void Both_ends_of_the_slider_are_accepted()
    {
        var (first, _) = Queue();
        var commands = new Rp1ResearchRateCommands();

        Assert.True(commands.SetRate(new Rp1ResearchRateArgs { WorkRate = 0 }).Success);
        Assert.Equal(0.0, first.workRate);
        Assert.True(commands.SetRate(new Rp1ResearchRateArgs { WorkRate = 1 }).Success);
        Assert.Equal(1.0, first.workRate);
    }

    [Fact]
    public void An_empty_queue_has_no_rate_to_set_and_a_missing_centre_is_named()
    {
        var commands = new Rp1ResearchRateCommands();

        Assert.Equal(
            Rp1ErrorCodes.SpaceCentreNotLoaded,
            commands.SetRate(new Rp1ResearchRateArgs { WorkRate = 0.5 }).ErrorCode);

        SpaceCenterManagement.Instance = new SpaceCenterManagement();
        MaintenanceHandler.Instance = new MaintenanceHandler();
        var result = commands.SetRate(new Rp1ResearchRateArgs { WorkRate = 0.5 });

        Assert.Equal(CommandErrorCode.WrongState, result.ErrorCode);
        Assert.Equal(0, MaintenanceHandler.Instance.UpkeepUpdatesScheduled);
    }

    [Fact]
    public void Every_slider_step_is_priced_from_stopped_to_the_full_rate()
    {
        Queue();

        var raw = new Rp1ResearchRatesReflection().CaptureOnMain(Ut)!;

        Assert.Equal("basicRocketry", raw.TechId);
        Assert.Equal(Enumerable.Range(0, 21).Select(step => step * 0.05), raw.Steps.Select(s => s.WorkRate));
    }

    [Fact]
    public void The_salary_at_the_current_rate_is_what_RP1_pays_and_a_stopped_queue_pays_the_idle_share()
    {
        var (first, _) = Queue(researchers: 12);
        first.workRate = 0.6;
        CurrencyUtils.Multipliers[TransactionReasonsRP0.SalaryResearchers] = 0.9;

        var steps = new Rp1ResearchRatesReflection().CaptureOnMain(Ut)!.Steps;

        // MaintenanceHandler.UpdateUpkeep's own line at the rate the queue holds,
        // then the Budget tab's Research Teams query over it.
        var paid = 12 * 1000 / 365.25 * (0.5 + (1.0 - 0.5) * 0.6);
        var shipped = -CurrencyUtils.Funds(TransactionReasonsRP0.SalaryResearchers, -paid);
        Assert.Equal(shipped, steps[12].ResearcherSalaryPerDay!.Value, 9);
        Assert.Equal(12 * 1000 / 365.25 * 0.5 * 0.9, steps[0].ResearcherSalaryPerDay!.Value, 9);
        Assert.Equal(12 * 1000 / 365.25 * 0.9, steps[20].ResearcherSalaryPerDay!.Value, 9);
    }

    [Fact]
    public void The_credit_at_the_current_rate_is_what_CreditForTime_earns_and_stopped_earns_none()
    {
        var (first, _) = Queue(researchers: 12);
        first.workRate = 0.45;
        var tiers = Database.SettingsSC.researchersToUnlockCreditSalaryMultipliers;
        tiers[5] = 1.0;
        tiers[10] = 0.5;
        tiers[1000] = 0.25;
        UnlockCreditHandler.Instance!.SetUnlockCredRate(0.4);
        CurrencyUtils.Multipliers[TransactionReasonsRP0.RateUnlockCreditIncrease] = 1.2;

        var steps = new Rp1ResearchRatesReflection().CaptureOnMain(Ut)!.Steps;

        // IncrementCredit applies the rate modifier to what CreditForTime returns.
        var shipped = UnlockCreditHandler.Instance.ShippedCreditForTime(86400)
            * CurrencyUtils.Rate(TransactionReasonsRP0.RateUnlockCreditIncrease);
        Assert.True(shipped > 0);
        Assert.Equal(shipped, steps[9].UnlockCreditPerDay!.Value, 9);
        Assert.Equal(0.0, steps[0].UnlockCreditPerDay);
        Assert.Equal(shipped / 0.45, steps[20].UnlockCreditPerDay!.Value, 9);
    }

    [Fact]
    public void The_node_finishes_later_at_a_lower_rate_and_never_when_stopped()
    {
        var (first, _) = Queue();
        first.SetBuildRate(0.0001);

        var steps = new Rp1ResearchRatesReflection().CaptureOnMain(Ut)!.Steps;

        Assert.Null(steps[0].FinishesAt);
        Assert.Equal(Ut + 75 / 0.0001, steps[20].FinishesAt!.Value, 6);
        Assert.Equal(Ut + 75 / (0.0001 * 0.5), steps[10].FinishesAt!.Value, 6);
    }

    [Fact]
    public void A_node_RP1_has_not_costed_has_no_finish_date_rather_than_an_invented_one()
    {
        var (first, _) = Queue();
        first.SetBuildRate(-1.0);

        var steps = new Rp1ResearchRatesReflection().CaptureOnMain(Ut)!.Steps;

        Assert.All(steps, s => Assert.Null(s.FinishesAt));
        Assert.All(steps, s => Assert.NotNull(s.ResearcherSalaryPerDay));
    }

    [Fact]
    public void An_empty_queue_publishes_no_steps_and_no_node()
    {
        SpaceCenterManagement.Instance = new SpaceCenterManagement { Researchers = 4 };

        var raw = new Rp1ResearchRatesReflection().CaptureOnMain(Ut)!;

        Assert.Null(raw.TechId);
        Assert.Empty(raw.Steps);
    }

    [Fact]
    public void Credit_that_will_not_read_is_absent_rather_than_zero()
    {
        Queue();
        UnlockCreditHandler.Instance = null;

        var steps = new Rp1ResearchRatesReflection().CaptureOnMain(Ut)!.Steps;

        Assert.Equal(0.0, steps[0].UnlockCreditPerDay);
        Assert.All(steps.Skip(1), s => Assert.Null(s.UnlockCreditPerDay));
    }

    [Fact]
    public void The_table_is_repriced_when_the_rate_moves_and_not_on_every_tick()
    {
        var (first, _) = Queue();
        var reader = new Rp1ResearchRatesReflection();

        var before = reader.CaptureOnMain(Ut)!;
        var queries = CurrencyUtils.Queries;
        Assert.Same(before, reader.CaptureOnMain(Ut + 1));
        Assert.Equal(queries, CurrencyUtils.Queries);

        first.workRate = 0.5;
        Assert.NotSame(before, reader.CaptureOnMain(Ut + 2));
    }

    [Fact]
    public void The_wire_shape_carries_every_step()
    {
        Queue();

        var wire = Rp1ResearchRatesCapture.Build(new Rp1ResearchRatesReflection().CaptureOnMain(Ut))!;

        Assert.Equal("basicRocketry", wire["techId"]);
        Assert.Equal(Ut, wire["refreshedAt"]);
        var step = (Dictionary<string, object?>)((List<object?>)wire["steps"]!)[20]!;
        Assert.Equal(
            new[] { "workRate", "researcherSalaryPerDay", "unlockCreditPerDay", "finishesAt" },
            step.Keys.ToArray());
        Assert.Null(Rp1ResearchRatesCapture.Build(null));
    }

    private static (ResearchProject First, ResearchProject Second) Queue(int researchers = 10)
    {
        var first = new ResearchProject { techID = "basicRocketry", scienceCost = 100, progress = 25 };
        first.SetBuildRate(0.001);
        var second = new ResearchProject { techID = "orbitalRocketry", scienceCost = 200 };
        var scm = new SpaceCenterManagement { Researchers = researchers };
        scm.TechList.Add(first);
        scm.TechList.Add(second);
        SpaceCenterManagement.Instance = scm;
        MaintenanceHandler.Instance = new MaintenanceHandler { lastUpdate = 3600.0 };
        UnlockCreditHandler.Instance = new UnlockCreditHandler(0);
        UnlockCreditHandler.Instance.SetUnlockCredRate(0.5);
        Database.SettingsSC.researchersToUnlockCreditSalaryMultipliers[1000] = 1.0;
        return (first, second);
    }
}
