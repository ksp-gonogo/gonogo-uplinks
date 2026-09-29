using System;
using System.Collections.Generic;
using System.Linq;
using GonogoRp1Uplink;
using RP0;
using Sitrep.Contract;
using Xunit;

/// <summary>
/// A construction's id, its work rate and its cancel, and the draw and finish
/// at every rate, against the stand-in graph.
/// </summary>
[Collection("rp0-static-graph")]
public class Rp1ConstructionRateTests : IDisposable
{
    public Rp1ConstructionRateTests() => Clear();

    public void Dispose() => Clear();

    private static void Clear()
    {
        SpaceCenterManagement.Instance = null;
        MaintenanceHandler.Instance = null;
        CurrencyUtils.Reset();
        HighLogic.Reset();
        Database.FacilityLevelCosts.Clear();
        Database.LockedFacilities.Clear();
        KCTUtilities.FacilityLevels.Clear();
        Database.SettingsSC.ConstructionRushCost = new LinearRushCurve();
        Formula.ConstructionBuildRate = 0.01;
        Formula.LastRateFacility = null;
    }

    [Fact]
    public void Each_kind_is_published_under_the_id_RP1_keeps_for_it()
    {
        var upgrade = Upgrade();
        var lcc = new LCConstructionProject { name = "LC-2", lcID = Guid.NewGuid() };
        var pad = new PadConstructionProject { name = "Pad B" };
        var lc = new LaunchComplex { Name = "LC-1", PadConstructions = { pad } };
        Install(ksc =>
        {
            ksc.FacilityUpgrades.Add(upgrade);
            ksc.LCConstructions.Add(lcc);
            ksc.LaunchComplexes.Add(lc);
        });

        var rows = new Rp1ScReflection().Read(1.0).Constructions;

        Assert.Equal(upgrade.uid.ToString(), rows.Single(r => r.Kind == "FacilityUpgrade").Id);
        Assert.Equal(lcc.lcID.ToString(), rows.Single(r => r.Kind == "LaunchComplex").Id);
        Assert.Equal(pad.id.ToString(), rows.Single(r => r.Kind == "Pad").Id);
        Assert.Equal(upgrade.uid.ToString(), Rp1ScCapture.BuildConstructions(new Rp1ScRaw { Constructions = { rows.Single(r => r.Kind == "FacilityUpgrade") } })
            .Cast<Dictionary<string, object?>>().Single()["id"]);
    }

    [Fact]
    public void An_empty_guid_is_no_id_so_the_row_is_readable_and_unaddressable()
    {
        // A save written before RP-1 gave facility upgrades an id loads every
        // one of them with the same empty Guid.
        var upgrade = Upgrade();
        upgrade.uid = Guid.Empty;
        Install(ksc => ksc.FacilityUpgrades.Add(upgrade));

        var row = Assert.Single(new Rp1ScReflection().Read(1.0).Constructions);

        Assert.Null(row.Id);
        Assert.Equal("VehicleAssemblyBuilding", row.FacilityType);
        Assert.Equal(CommandErrorCode.NotFound, new Rp1ConstructionCommands()
            .SetRate(new Rp1ConstructionRateArgs { Id = Guid.Empty.ToString(), WorkRate = 1 }).ErrorCode);
    }

    [Fact]
    public void Setting_a_rate_writes_the_value_RP1s_own_slider_stores_for_that_step()
    {
        var upgrade = Upgrade();
        var other = Upgrade();
        Install(ksc =>
        {
            ksc.FacilityUpgrades.Add(upgrade);
            ksc.FacilityUpgrades.Add(other);
        });

        var result = new Rp1ConstructionCommands()
            .SetRate(new Rp1ConstructionRateArgs { Id = upgrade.uid.ToString(), WorkRate = 1.35 });

        Assert.True(result.Success, result.Detail);
        // Through a float, as the slider writes it, so it is not the double 1.35.
        Assert.Equal((double)(27f * 0.05f), upgrade.workRate);
        Assert.NotEqual(1.35, upgrade.workRate);
        Assert.Equal(1.0, other.workRate);
    }

    [Theory]
    [InlineData(-0.05)]
    [InlineData(1.55)]
    [InlineData(0.52)]
    [InlineData(double.NaN)]
    public void A_rate_off_the_slider_is_refused_and_nothing_is_written(double workRate)
    {
        var upgrade = Upgrade();
        Install(ksc => ksc.FacilityUpgrades.Add(upgrade));

        var result = new Rp1ConstructionCommands()
            .SetRate(new Rp1ConstructionRateArgs { Id = upgrade.uid.ToString(), WorkRate = workRate });

        Assert.False(result.Success);
        Assert.Equal(CommandErrorCode.Range, result.ErrorCode);
        Assert.Equal(1.0, upgrade.workRate);
    }

    [Fact]
    public void Both_ends_of_the_slider_are_accepted()
    {
        var pad = new PadConstructionProject { name = "Pad B" };
        Install(ksc => ksc.LaunchComplexes.Add(new LaunchComplex { Name = "LC-1", PadConstructions = { pad } }));
        var commands = new Rp1ConstructionCommands();

        Assert.True(commands.SetRate(new Rp1ConstructionRateArgs { Id = pad.id.ToString(), WorkRate = 0 }).Success);
        Assert.Equal(0.0, pad.workRate);
        Assert.True(commands.SetRate(new Rp1ConstructionRateArgs { Id = pad.id.ToString(), WorkRate = 1.5 }).Success);
        Assert.Equal((double)(30f * 0.05f), pad.workRate);
    }

    [Fact]
    public void A_construction_nobody_holds_is_not_found_and_a_missing_centre_is_named()
    {
        var commands = new Rp1ConstructionCommands();

        Assert.Equal(
            Rp1ErrorCodes.SpaceCentreNotLoaded,
            commands.Cancel(new Rp1ConstructionCancelArgs { Id = Guid.NewGuid().ToString() }).ErrorCode);

        Install(ksc => ksc.FacilityUpgrades.Add(Upgrade()));
        Assert.Equal(
            CommandErrorCode.NotFound,
            commands.Cancel(new Rp1ConstructionCancelArgs { Id = Guid.NewGuid().ToString() }).ErrorCode);
        Assert.Equal(CommandErrorCode.Range, commands.Cancel(new Rp1ConstructionCancelArgs()).ErrorCode);
    }

    [Fact]
    public void Two_constructions_under_one_id_are_refused_rather_than_guessed_between()
    {
        var first = Upgrade();
        var second = Upgrade();
        second.uid = first.uid;
        Install(ksc =>
        {
            ksc.FacilityUpgrades.Add(first);
            ksc.FacilityUpgrades.Add(second);
        });

        var result = new Rp1ConstructionCommands().Cancel(new Rp1ConstructionCancelArgs { Id = first.uid.ToString() });

        Assert.Equal(CommandErrorCode.WrongState, result.ErrorCode);
        Assert.Equal(0, first.CancelCalls + second.CancelCalls);
    }

    [Fact]
    public void Cancel_calls_RP1s_own_cancel_on_that_construction_at_whichever_centre_holds_it()
    {
        var here = Upgrade();
        var pad = new PadConstructionProject { name = "Pad B" };
        var there = new LCSpaceCenter { KSCName = "Kourou" };
        there.LaunchComplexes.Add(new LaunchComplex { Name = "ELA", PadConstructions = { pad } });
        Install(ksc => ksc.FacilityUpgrades.Add(here));
        SpaceCenterManagement.Instance!.KSCs.Add(there);

        var result = new Rp1ConstructionCommands().Cancel(new Rp1ConstructionCancelArgs { Id = pad.id.ToString() });

        Assert.True(result.Success, result.Detail);
        Assert.Equal(1, pad.CancelCalls);
        Assert.Equal(0, here.CancelCalls);
        Assert.Empty(there.LaunchComplexes[0].PadConstructions);
        Assert.Single(SpaceCenterManagement.Instance.KSCs[0].FacilityUpgrades);
    }

    [Fact]
    public void Every_slider_step_is_priced_with_RP1s_own_cost_per_day()
    {
        var upgrade = Upgrade();
        upgrade.SetBuildRate(0.002);
        Install(ksc => ksc.FacilityUpgrades.Add(upgrade));
        CurrencyUtils.Multipliers[TransactionReasonsRP0.StructureConstruction] = 0.8;

        var table = Assert.Single(new Rp1ConstructionRatesReflection().CaptureOnMain(1_000.0)!.Constructions!);

        Assert.Equal(upgrade.uid.ToString(), table.Id);
        Assert.Equal(31, table.Steps.Count);

        var stopped = table.Steps[0];
        Assert.Equal(0.0, stopped.WorkRate);
        Assert.Equal(0.0, stopped.CostPerDay);
        Assert.Null(stopped.FinishesAt);

        // rate * 86400 / BP * the modified price, at the full rate.
        var full = table.Steps[20];
        Assert.Equal(1.0, full.WorkRate, 6);
        Assert.Equal(1.0, full.CostMultiplier);
        Assert.Equal(0.002 * 86400 / 1_000.0 * 40_000.0 * 0.8, full.CostPerDay!.Value, 6);
        Assert.Equal(1_000.0 + (1_000.0 - 250.0) / 0.002, full.FinishesAt!.Value, 3);

        // Half the rate draws half as much per day and takes twice as long.
        var half = table.Steps[10];
        Assert.Equal(full.CostPerDay.Value / 2, half.CostPerDay!.Value, 6);
        Assert.Equal(1_000.0 + (1_000.0 - 250.0) / 0.001, half.FinishesAt!.Value, 3);
    }

    [Fact]
    public void Rushing_draws_the_rush_multiplier_on_top_of_the_faster_rate()
    {
        var upgrade = Upgrade();
        upgrade.SetBuildRate(0.002);
        Install(ksc => ksc.FacilityUpgrades.Add(upgrade));

        var steps = Assert.Single(new Rp1ConstructionRatesReflection().CaptureOnMain(0)!.Constructions!).Steps;
        var full = steps[20];
        var rush = steps[30];

        Assert.Equal(2.0, rush.CostMultiplier!.Value, 5);
        Assert.Equal(full.CostPerDay!.Value * 1.5 * 2.0, rush.CostPerDay!.Value, 2);
    }

    [Fact]
    public void A_complex_or_pad_is_priced_under_the_complex_reason_and_a_building_is_not()
    {
        var lcc = new LCConstructionProject { name = "LC-2", lcID = Guid.NewGuid(), BP = 100, cost = 1_000 };
        lcc.SetBuildRate(0.001);
        Install(ksc => ksc.LCConstructions.Add(lcc));
        CurrencyUtils.Multipliers[TransactionReasonsRP0.StructureConstructionLC] = 0.5;
        CurrencyUtils.Multipliers[TransactionReasonsRP0.StructureConstruction] = 3.0;

        var full = Assert.Single(new Rp1ConstructionRatesReflection().CaptureOnMain(0)!.Constructions!).Steps[20];

        Assert.Equal(0.001 * 86400 / 100 * 1_000 * 0.5, full.CostPerDay!.Value, 6);
    }

    [Fact]
    public void An_uncosted_construction_has_no_draw_and_no_finish_except_at_a_stop()
    {
        Install(ksc => ksc.FacilityUpgrades.Add(Upgrade()));

        var steps = Assert.Single(new Rp1ConstructionRatesReflection().CaptureOnMain(0)!.Constructions!).Steps;

        Assert.Equal(0.0, steps[0].CostPerDay);
        Assert.All(steps.Skip(1), s => Assert.Null(s.CostPerDay));
        Assert.All(steps, s => Assert.Null(s.FinishesAt));
    }

    [Fact]
    public void An_unreadable_rush_curve_costs_only_the_rushing_steps()
    {
        var upgrade = Upgrade();
        upgrade.SetBuildRate(0.002);
        Install(ksc => ksc.FacilityUpgrades.Add(upgrade));
        Database.SettingsSC.ConstructionRushCost = null;

        var steps = Assert.Single(new Rp1ConstructionRatesReflection().CaptureOnMain(0)!.Constructions!).Steps;

        Assert.NotNull(steps[20].CostPerDay);
        Assert.Null(steps[21].CostMultiplier);
        Assert.Null(steps[21].CostPerDay);
        Assert.NotNull(steps[21].FinishesAt);
    }

    [Fact]
    public void The_tables_are_recomputed_when_a_rate_changes_and_not_otherwise()
    {
        var upgrade = Upgrade();
        upgrade.SetBuildRate(0.002);
        Install(ksc => ksc.FacilityUpgrades.Add(upgrade));
        MaintenanceHandler.Instance = new MaintenanceHandler { lastUpdate = 3600.0 };
        var reader = new Rp1ConstructionRatesReflection();

        var first = reader.CaptureOnMain(0);
        var queries = CurrencyUtils.Queries;
        upgrade.progress = 500.0;
        Assert.Same(first, reader.CaptureOnMain(10));
        Assert.Equal(queries, CurrencyUtils.Queries);

        upgrade.workRate = 0.5;
        Assert.NotSame(first, reader.CaptureOnMain(20));
        Assert.True(CurrencyUtils.Queries > queries);

        var second = reader.CaptureOnMain(30);
        MaintenanceHandler.Instance.lastUpdate = 7200.0;
        Assert.NotSame(second, reader.CaptureOnMain(40));
    }

    [Fact]
    public void A_facility_with_a_tier_left_is_priced_as_the_upgrade_command_would_queue_it()
    {
        Install(_ => { });
        Database.FacilityLevelCosts[SpaceCenterFacility.VehicleAssemblyBuilding] = new List<int> { 10_000, 30_000, 90_000 };
        Database.FacilityLevelCosts[SpaceCenterFacility.Administration] = new List<int> { 25_000, 40_000 };
        Database.FacilityLevelCosts[SpaceCenterFacility.Runway] = new List<int> { 1, 1 };
        Database.LockedFacilities.Add(SpaceCenterFacility.Runway);
        KCTUtilities.FacilityLevels[SpaceCenterFacility.VehicleAssemblyBuilding] = 1;
        KCTUtilities.FacilityLevels[SpaceCenterFacility.Administration] = 1;
        HighLogic.CurrentGame.Parameters.Career.FundsLossMultiplier = 2f;
        CurrencyUtils.Multipliers[TransactionReasonsRP0.StructureConstruction] = 0.5;

        var rows = new Rp1ConstructionRatesReflection().CaptureOnMain(0)!.FacilityUpgrades!;

        // Administration is at its top tier and the Runway is RP-1's to drive.
        var vab = Assert.Single(rows);
        Assert.Equal("VehicleAssemblyBuilding", vab.Facility);
        var cost = 90_000.0 * 2;
        var bp = Math.Sqrt(cost + 40_000.0 * 2) - Math.Sqrt(40_000.0 * 2);
        Assert.Equal(bp / 0.01, vab.BuildSeconds!.Value, 6);
        Assert.Equal(0.01 * 86400 / bp * cost * 0.5, vab.CostPerDay!.Value, 6);
        Assert.Equal(SpaceCenterFacility.VehicleAssemblyBuilding, Formula.LastRateFacility);
    }

    [Fact]
    public void The_payload_carries_every_step_under_its_construction()
    {
        var raw = new Rp1ConstructionRatesRaw
        {
            RefreshedAt = 12.0,
            Constructions = new List<Rp1ConstructionRateTableRaw>
            {
                new Rp1ConstructionRateTableRaw
                {
                    Id = "abc",
                    Steps = { new Rp1ConstructionRateStepRaw { WorkRate = 1.0, CostMultiplier = 1.0, CostPerDay = 5.0, FinishesAt = 99.0 } },
                },
            },
            FacilityUpgrades = new List<Rp1FacilityUpgradeRateRaw>
            {
                new Rp1FacilityUpgradeRateRaw { Facility = "VehicleAssemblyBuilding", CostPerDay = 3.0, BuildSeconds = 60.0 },
            },
        };

        var payload = Rp1ConstructionRatesCapture.Build(raw)!;

        Assert.Equal(12.0, payload["refreshedAt"]);
        var table = (Dictionary<string, object?>)((List<object?>)payload["constructions"]!).Single()!;
        Assert.Equal("abc", table["id"]);
        var step = (Dictionary<string, object?>)((List<object?>)table["steps"]!).Single()!;
        Assert.Equal(new object?[] { 1.0, 1.0, 5.0, 99.0 }, new[] { step["workRate"], step["costMultiplier"], step["costPerDay"], step["finishesAt"] });
        var facility = (Dictionary<string, object?>)((List<object?>)payload["facilityUpgrades"]!).Single()!;
        Assert.Equal(new object?[] { "VehicleAssemblyBuilding", 3.0, 60.0 }, new[] { facility["facility"], facility["costPerDay"], facility["buildSeconds"] });
        Assert.Null(Rp1ConstructionRatesCapture.Build(null));
    }

    private static FacilityUpgradeProject Upgrade()
    {
        var upgrade = new FacilityUpgradeProject(
            SpaceCenterFacility.VehicleAssemblyBuilding, "SpaceCenter/VehicleAssemblyBuilding", 2, 1, "VehicleAssemblyBuilding")
        {
            BP = 1_000.0,
            progress = 250.0,
            cost = 40_000.0,
        };
        return upgrade;
    }

    private static void Install(Action<LCSpaceCenter> shape)
    {
        var ksc = new LCSpaceCenter { KSCName = "Cape", Engineers = 20 };
        shape(ksc);
        SpaceCenterManagement.Instance = new SpaceCenterManagement { KSCs = { ksc }, ActiveSC = ksc };
    }
}
