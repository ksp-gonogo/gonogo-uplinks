using GonogoTestFlightUplink;
using Sitrep.Contract;
using Xunit;

public class TestFlightReliabilityMapTests
{
    [Fact]
    public void Summary_carries_the_coverage_verbatim()
    {
        var s = TestFlightReliabilityMap.Summary(ReliabilityCoverage.Modeled);
        Assert.Equal(ReliabilityCoverage.Modeled, s.Coverage);
    }

    /// <summary>
    /// The case the previous suite could not reach, and the one the shipped
    /// binary was permanently in: the reflection layer read nothing at all.
    ///
    /// <para>The old tests exercised the pure mapper with hand-written raw values
    /// and stayed green for months while the layer underneath returned nothing,
    /// because the raw type's non-null defaults filled every gap. An all-null raw
    /// must now map to "unknown", never to a nominal part.</para>
    /// </summary>
    [Fact]
    public void Parts_report_a_wholly_unread_engine_as_unknown_not_nominal()
    {
        var parts = TestFlightReliabilityMap.Parts(new[] { new EngineReliabilityRaw { PartId = "42" } });

        var p = Assert.Single(parts);
        Assert.Equal("unknown", p.Condition);
        Assert.Null(p.ConditionDetail);
        Assert.Null(p.Survival);
        Assert.Null(p.SurvivalHorizonSeconds);
        Assert.Null(p.Budgets);
    }

    [Fact]
    public void Parts_read_the_condition_off_TestFlights_own_part_status()
    {
        var nominal = TestFlightReliabilityMap.Parts(
            new[] { new EngineReliabilityRaw { PartId = "1", PartStatus = 0 } })[0];
        var failed = TestFlightReliabilityMap.Parts(
            new[]
            {
                new EngineReliabilityRaw
                {
                    PartId = "1", PartStatus = 1, FailureTitles = "Turbopump Failure",
                },
            })[0];

        Assert.Equal("nominal", nominal.Condition);
        Assert.Equal("failed", failed.Condition);
        Assert.Equal("Turbopump Failure", failed.ConditionDetail);
        // TestFlight has no two-tier failure grade to read, so it never claims one.
        Assert.NotEqual("failed-critical", failed.Condition);
    }

    /// <summary>
    /// The two ratings are INDEPENDENT and diverge by an order of magnitude under
    /// RO, so each is its own budget and each names its scope in the label. A
    /// single "remaining rated burn" slot had to pick one and be wrong about the
    /// other.
    /// </summary>
    [Fact]
    public void Parts_emit_both_burn_budgets_when_the_two_ratings_differ()
    {
        var p = TestFlightReliabilityMap.Parts(
            new[]
            {
                new EngineReliabilityRaw
                {
                    PartId = "1", PartStatus = 0,
                    RatedCumulativeSeconds = 36_000, RunCumulativeSeconds = 3_600,
                    RatedContinuousSeconds = 3_600, RunContinuousSeconds = 3_240,
                },
            })[0];

        Assert.Equal(2, p.Budgets!.Count);
        Assert.Equal("burn.continuous", p.Budgets[0].Id);
        Assert.Equal("continuous rated burn", p.Budgets[0].Label);
        Assert.Equal(0.9, p.Budgets[0].Consumed!.Value, 6);
        Assert.Equal("burn.cumulative", p.Budgets[1].Id);
        Assert.Equal("cumulative rated burn", p.Budgets[1].Label);
        Assert.Equal(0.1, p.Budgets[1].Consumed!.Value, 6);
        Assert.All(p.Budgets, b => Assert.Equal("risk-ramp", b.Kind));
    }

    /// <summary>Equal ratings collapse to one row, which is what TestFlight's own GUI does.</summary>
    [Fact]
    public void Parts_collapse_to_one_budget_when_the_two_ratings_are_equal()
    {
        var p = TestFlightReliabilityMap.Parts(
            new[]
            {
                new EngineReliabilityRaw
                {
                    PartId = "1", PartStatus = 0,
                    RatedCumulativeSeconds = 255, RunCumulativeSeconds = 26,
                    RatedContinuousSeconds = 255, RunContinuousSeconds = 26,
                },
            })[0];

        var budget = Assert.Single(p.Budgets!);
        Assert.Equal("burn.cumulative", budget.Id);
        Assert.Equal("rated burn", budget.Label);
    }

    /// <summary>
    /// An unread run time is never substituted with 0: zero used reads as a
    /// brand-new part. The rating is still carried, with no Consumed, so it can
    /// never select a row.
    /// </summary>
    [Fact]
    public void Parts_carry_a_rating_with_no_run_time_but_claim_no_consumption()
    {
        var p = TestFlightReliabilityMap.Parts(
            new[]
            {
                new EngineReliabilityRaw
                {
                    PartId = "1", PartStatus = 0, RatedCumulativeSeconds = 255,
                },
            })[0];

        var budget = Assert.Single(p.Budgets!);
        Assert.Equal(255, budget.LimitSeconds);
        Assert.Null(budget.UsedSeconds);
        Assert.Null(budget.Consumed);
    }

    /// <summary>A survival fraction without its horizon is uninterpretable, so the two travel together or not at all.</summary>
    [Fact]
    public void Parts_never_carry_a_survival_fraction_without_its_horizon()
    {
        var withHorizon = TestFlightReliabilityMap.Parts(
            new[]
            {
                new EngineReliabilityRaw
                {
                    PartId = "1", PartStatus = 0, Survival = 0.82, SurvivalHorizonSeconds = 255,
                },
            })[0];
        var withoutSurvival = TestFlightReliabilityMap.Parts(
            new[]
            {
                new EngineReliabilityRaw { PartId = "1", PartStatus = 0, SurvivalHorizonSeconds = 255 },
            })[0];

        Assert.Equal(0.82, withHorizon.Survival);
        Assert.Equal(255, withHorizon.SurvivalHorizonSeconds);
        Assert.Null(withoutSurvival.Survival);
        Assert.Null(withoutSurvival.SurvivalHorizonSeconds);
    }

    /// <summary>A part can carry more than one active core, and a bare flightID would merge the rows.</summary>
    [Fact]
    public void Parts_disambiguate_a_repeated_flight_id()
    {
        var parts = TestFlightReliabilityMap.Parts(
            new[]
            {
                new EngineReliabilityRaw { PartId = "42", PartStatus = 0 },
                new EngineReliabilityRaw { PartId = "42", PartStatus = 0 },
                new EngineReliabilityRaw { PartId = "43", PartStatus = 0 },
            });

        Assert.Equal(new[] { "42:0", "42:1", "43:0" }, parts.ConvertAll(p => p.PartId).ToArray());
    }

    /// <summary>
    /// The provenance record. An install that regresses the binder is visible in a
    /// debug surface without another decompile, which is what was missing when
    /// three non-existent method names shipped and nothing said so. It is a fact
    /// about the install, so it rides the summary once rather than every part.
    /// </summary>
    [Fact]
    public void The_summary_carries_what_the_binder_resolved()
    {
        var s = TestFlightReliabilityMap.Summary(
            ReliabilityCoverage.Modeled,
            new TestFlightBindingReport
            {
                Bound = new[] { "ITestFlightCore.GetPartStatus" },
                Unbound = new[] { "ITestFlightReliability.GetRatedTime(RatingScope)" },
            });

        Assert.Equal(new[] { "ITestFlightCore.GetPartStatus" }, s.BoundMembers);
        Assert.Equal(
            new[] { "ITestFlightReliability.GetRatedTime(RatingScope)" }, s.UnboundMembers);
    }

    /// <summary>The flying config and its flight data are plain fields of the part, not a sub-tree keyed by a provider id.</summary>
    [Fact]
    public void Parts_carry_the_flying_config_and_its_flight_data()
    {
        var p = TestFlightReliabilityMap.Parts(
            new[] { new EngineReliabilityRaw { PartId = "1", PartStatus = 0, Configuration = "RD-180", FlightData = 6200 } })[0];

        Assert.Equal("RD-180", p.Configuration);
        Assert.Equal(6200, p.FlightData);
    }

    /// <summary>
    /// TestFlight's repair consumes nothing, so the part shape has no cost field
    /// for a client to mistake for "needs 0" or to fill with another mod's rule.
    /// </summary>
    [Fact]
    public void A_part_states_no_repair_cost_because_testflight_charges_none()
    {
        Assert.Null(typeof(TestFlightReliabilityPart).GetProperty("RepairCost"));
    }
}
