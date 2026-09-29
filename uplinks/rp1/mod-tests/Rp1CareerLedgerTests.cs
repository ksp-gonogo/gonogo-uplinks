// RP-1's monthly ledger, read off the private period dictionary of its career log.
//
// The tests worth reading first are the two about what the reader must NOT do:
// ask for CurrentPeriod, whose getter closes periods, and publish the open
// period's closing figures, which RP-1 leaves at zero until it closes it.
using System;
using System.Collections.Generic;
using System.Linq;
using GonogoRp1Uplink;
using GonogoRp1Uplink.Tests;
using RP0;
using Xunit;

[Collection("rp0-static-graph")]
public class Rp1CareerLedgerTests : IDisposable
{
    private const double Month = 2_678_400d;

    public Rp1CareerLedgerTests() => CareerLog.Instance = null;

    public void Dispose() => CareerLog.Instance = null;

    private static Dictionary<string, object?>? Ledger(Rp1CareerLedgerReflection? reader = null) =>
        Rp1CareerLedgerCapture.Build((reader ?? new Rp1CareerLedgerReflection()).Read(ut: 100.0));

    private static List<Dictionary<string, object?>> Periods(Dictionary<string, object?>? ledger) =>
        ((List<object?>)ledger!["periods"]!).Cast<Dictionary<string, object?>>().ToList();

    private static LogPeriod Closed(double start) => new LogPeriod
    {
        StartUT = start,
        EndUT = start + Month,
        ProgramFunds = 120_000,
        SubsidyPaidOut = 40_000,
        OtherFundsEarned = 1_500,
        VesselRecovery = 2_000,
        SalaryEngineers = 30_000,
        SalaryResearchers = 20_000,
        SalaryCrew = 9_000,
        FacilityMaintenance = 15_000,
        LCMaintenance = 12_000,
        TrainingFees = 3_000,
        MaintenanceFees = 49_000,
        LaunchFees = 8_000,
        VesselPurchase = 60_000,
        ToolingFees = 25_000,
        EntryCosts = 11_000,
        ConstructionFees = 70_000,
        HiringEngineers = 4_000,
        HiringResearchers = 3_500,
        OtherFees = 250,
        SpentUnlockCredit = 6_000,
        RepFromPrograms = 12,
        CurrentFunds = 1_234_567,
        CurrentSci = 88,
        CurrentUnlockCredit = 45_000,
        ScienceEarned = 640,
        SubsidySize = 90_000,
        NumEngineers = 150,
        NumResearchers = 90,
        Confidence = 410,
        Reputation = 260,
    };

    /// <summary>Every figure goes out as RP-1 booked it, under its own name.</summary>
    [Fact]
    public void A_closed_month_carries_every_figure_RP1_booked()
    {
        // RP-1 always holds an open period; its start is all this test needs of it.
        CareerLog.Instance = new CareerLog { CurPeriodStart = Month }.AddPeriod(Closed(0));

        var month = Assert.Single(Periods(Ledger()));

        Assert.Equal(0d, month["startUt"]);
        Assert.Equal(Month, month["endUt"]);
        Assert.Equal(false, month["open"]);
        Assert.Equal(120_000d, month["programFunds"]);
        Assert.Equal(40_000d, month["subsidyPaidOut"]);
        Assert.Equal(1_500d, month["otherFundsEarned"]);
        Assert.Equal(2_000d, month["vesselRecovery"]);
        Assert.Equal(30_000d, month["salaryEngineers"]);
        Assert.Equal(20_000d, month["salaryResearchers"]);
        Assert.Equal(9_000d, month["salaryCrew"]);
        Assert.Equal(15_000d, month["facilityMaintenance"]);
        Assert.Equal(12_000d, month["lcMaintenance"]);
        Assert.Equal(3_000d, month["trainingFees"]);
        Assert.Equal(49_000d, month["maintenanceFees"]);
        Assert.Equal(8_000d, month["launchFees"]);
        Assert.Equal(60_000d, month["vesselPurchase"]);
        Assert.Equal(25_000d, month["toolingFees"]);
        Assert.Equal(11_000d, month["entryCosts"]);
        Assert.Equal(70_000d, month["constructionFees"]);
        Assert.Equal(4_000d, month["hiringEngineers"]);
        Assert.Equal(3_500d, month["hiringResearchers"]);
        Assert.Equal(250d, month["otherFees"]);
        Assert.Equal(6_000d, month["spentUnlockCredit"]);
        Assert.Equal(12d, month["repFromPrograms"]);
        Assert.Equal(1_234_567d, month["fundsAtClose"]);
        Assert.Equal(88d, month["scienceAtClose"]);
        Assert.Equal(45_000d, month["unlockCreditAtClose"]);
        Assert.Equal(640d, month["scienceEarnedAtClose"]);
        Assert.Equal(90_000d, month["subsidySize"]);
        Assert.Equal(150d, month["engineersAtClose"]);
        Assert.Equal(90d, month["researchersAtClose"]);
        Assert.Equal(410d, month["confidenceAtClose"]);
        Assert.Equal(260d, month["reputationAtClose"]);
    }

    /// <summary>
    /// RP-1 writes the closing snapshot only when it moves on, so the open month's
    /// is still zero. Published, that zero reads as a career that ended the month
    /// broke; the month so far is carried and the close is absent.
    /// </summary>
    [Fact]
    public void The_open_month_carries_the_month_so_far_and_no_close()
    {
        var open = new LogPeriod { StartUT = Month, EndUT = 2 * Month, ProgramFunds = 50_000, SalaryCrew = 4_000 };
        CareerLog.Instance = new CareerLog().AddPeriod(Closed(0)).AddPeriod(open, open: true);

        var months = Periods(Ledger());

        Assert.Equal(2, months.Count);
        var now = months[1];
        Assert.Equal(true, now["open"]);
        Assert.Equal(50_000d, now["programFunds"]);
        Assert.Equal(4_000d, now["salaryCrew"]);
        foreach (var field in Rp1CareerLedgerReflection.ClosingFields)
        {
            Assert.True(now.ContainsKey(field.Key), field.Key);
            Assert.Null(now[field.Key]);
        }
        Assert.Equal(1_234_567d, months[0]["fundsAtClose"]);
    }

    /// <summary>
    /// The getter is a write: past the period's end it closes periods and moves
    /// the open marker. A reading has no business doing either.
    /// </summary>
    [Fact]
    public void Never_asks_for_the_current_period()
    {
        var log = new CareerLog().AddPeriod(Closed(0)).AddPeriod(Closed(Month), open: true);
        CareerLog.Instance = log;

        Ledger();

        Assert.Equal(0, log.CurrentPeriodReads);
    }

    /// <summary>Oldest first whatever order the dictionary holds them in.</summary>
    [Fact]
    public void Months_run_oldest_first()
    {
        CareerLog.Instance = new CareerLog()
            .AddPeriod(Closed(2 * Month), open: true)
            .AddPeriod(Closed(Month))
            .AddPeriod(Closed(0));

        var starts = Periods(Ledger()).Select(m => m["startUt"]).ToList();

        Assert.Equal(new object?[] { 0d, Month, 2 * Month }, starts);
    }

    /// <summary>
    /// A closed month is read once, but the open month is read every tick, and a
    /// month closing invalidates what was kept.
    /// </summary>
    [Fact]
    public void The_open_month_is_read_fresh_and_a_close_is_seen()
    {
        var first = Closed(0);
        var second = new LogPeriod { StartUT = Month, EndUT = 2 * Month, ProgramFunds = 10 };
        var log = new CareerLog().AddPeriod(first, open: true).AddPeriod(second);
        CareerLog.Instance = log;
        var reader = new Rp1CareerLedgerReflection();

        Ledger(reader);
        first.ProgramFunds = 999;
        Assert.Equal(999d, Periods(Ledger(reader))[0]["programFunds"]);

        log.CurPeriodStart = Month;
        var months = Periods(Ledger(reader));
        Assert.Equal(false, months[0]["open"]);
        Assert.Equal(1_234_567d, months[0]["fundsAtClose"]);
        Assert.Equal(true, months[1]["open"]);
    }

    /// <summary>
    /// False is a career keeping no log, and it must not arrive looking like one
    /// that has booked nothing yet.
    /// </summary>
    [Fact]
    public void A_log_that_is_switched_off_is_not_an_empty_ledger()
    {
        CareerLog.Instance = new CareerLog { IsEnabled = false };
        var off = Ledger();
        Assert.Equal(false, off!["enabled"]);
        Assert.Empty(Periods(off));

        CareerLog.Instance = new CareerLog { IsEnabled = true };
        var quiet = Ledger();
        Assert.Equal(true, quiet!["enabled"]);
        Assert.Empty(Periods(quiet));
    }

    [Fact]
    public void Says_nothing_when_RP1s_log_handler_is_not_live()
    {
        Assert.Null(Ledger());
    }

    /// <summary>
    /// The reader walks its field table by variable, so the manifest sweep cannot
    /// see those names in a reflection call. Every one is held to the manifest here.
    /// </summary>
    [Fact]
    public void Every_ledger_field_is_a_manifest_target()
    {
        var pinned = Rp1ReflectionTargets.Members
            .Where(m => m.Type == "RP0.LogPeriod")
            .Select(m => m.Member)
            .ToHashSet(StringComparer.Ordinal);

        var missing = Rp1CareerLedgerReflection.FlowFields
            .Concat(Rp1CareerLedgerReflection.ClosingFields)
            .Select(f => f.Value)
            .Where(name => !pinned.Contains(name))
            .ToList();

        Assert.Empty(missing);
    }
}
