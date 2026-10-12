using System.Collections.Generic;
using GonogoRealFuelsUplink;
using Xunit;

/// <summary>
/// The ignition budget's three readings and the boiloff unit conversion, which
/// are the two places this Uplink can be wrong in a way an operator would act
/// on. Both are pure functions of the reflected reading, so both are asserted
/// here rather than on a rig.
/// </summary>
public class RealFuelsCaptureTests
{
    private static Dictionary<string, object?> FirstEngine(Dictionary<string, object?> payload)
    {
        var rows = Assert.IsType<List<Dictionary<string, object?>>>(payload["engines"]);
        return Assert.Single(rows);
    }

    private static Dictionary<string, object?> BuildOne(int? ignitions, bool? limited, bool? literalZero = null) =>
        FirstEngine(RealFuelsCapture.BuildEngines(new RealFuelsVesselRaw
        {
            IgnitionsLimited = limited,
            UllageSimulated = true,
            Engines = { new RealFuelsEngineRaw { Ignitions = ignitions, LiteralZeroIgnitions = literalZero } },
        }));

    [Fact]
    public void A_positive_budget_is_neither_unlimited_nor_ground_only()
    {
        var e = BuildOne(ignitions: 3, limited: true);
        Assert.Equal(3, e["ignitionsRemaining"]);
        Assert.Equal(false, e["ignitionsUnlimited"]);
        Assert.Equal(false, e["groundIgnitionOnly"]);
    }

    [Fact]
    public void The_negative_sentinel_reads_as_unlimited()
    {
        var e = BuildOne(ignitions: -1, limited: true);
        Assert.Equal(true, e["ignitionsUnlimited"]);
        Assert.Equal(false, e["groundIgnitionOnly"]);
    }

    [Fact]
    public void Zero_reads_as_ground_ignition_only_not_as_a_spent_budget()
    {
        var e = BuildOne(ignitions: 0, limited: true, literalZero: true);
        Assert.Equal(true, e["groundIgnitionOnly"]);
        Assert.Equal(false, e["ignitionsUnlimited"]);
        Assert.Equal(true, e["literalZeroIgnitions"]);
    }

    /// <summary>
    /// The game-wide switch is asked FIRST, mirroring
    /// <c>ModuleEnginesRF.GetUllageIgnition</c>: with ignition limits off, a
    /// budget of two is a limit nothing is enforcing, and reporting "2 left"
    /// would be a restriction the operator does not actually have.
    /// </summary>
    [Fact]
    public void Ignition_limits_switched_off_makes_every_budget_unlimited()
    {
        var e = BuildOne(ignitions: 2, limited: false);
        Assert.Equal(true, e["ignitionsUnlimited"]);
        Assert.Equal(false, e["groundIgnitionOnly"]);
    }

    /// <summary>
    /// An engine whose counter could not be read is not an engine with no
    /// ignitions left. Nothing may substitute a zero here.
    /// </summary>
    [Fact]
    public void An_unreadable_budget_yields_absence_and_never_a_zero()
    {
        var e = BuildOne(ignitions: null, limited: true);
        Assert.Null(e["ignitionsRemaining"]);
        Assert.Null(e["ignitionsUnlimited"]);
        Assert.Null(e["groundIgnitionOnly"]);
    }

    /// <summary>
    /// The switch is half the rule, so without it neither reading can be made.
    /// The raw count still travels, because it is a fact that was read.
    /// </summary>
    [Fact]
    public void An_unreadable_settings_switch_withholds_both_derived_readings()
    {
        var e = BuildOne(ignitions: 0, limited: null);
        Assert.Equal(0, e["ignitionsRemaining"]);
        Assert.Null(e["ignitionsUnlimited"]);
        Assert.Null(e["groundIgnitionOnly"]);
    }

    [Fact]
    public void An_engine_carries_its_ullage_and_rated_figures_through()
    {
        var e = FirstEngine(RealFuelsCapture.BuildEngines(new RealFuelsVesselRaw
        {
            IgnitionsLimited = true,
            UllageSimulated = true,
            Engines =
            {
                new RealFuelsEngineRaw
                {
                    PartId = 4242,
                    PartName = "AJ10-137",
                    Ignitions = 1,
                    UllageModelled = true,
                    UllageStability = 0.42,
                    IgnitionProbability = 0.974,
                    PressureFed = true,
                    FeedPressureOk = false,
                    RatedBurnTimeSeconds = 750.0,
                    PredictedMaximumResiduals = 0.0225,
                },
            },
        }));
        Assert.Equal(4242L, e["partId"]);
        Assert.Equal("AJ10-137", e["partName"]);
        Assert.Equal(0.42, e["ullageStability"]);
        Assert.Equal(0.974, e["ignitionProbability"]);
        Assert.Equal(false, e["feedPressureOk"]);
        Assert.Equal(750.0, e["ratedBurnTimeSeconds"]);
        Assert.Equal(0.0225, e["predictedMaximumResiduals"]);
        Assert.Null(e["ratedContinuousBurnTimeSeconds"]);
    }

    /// <summary>
    /// A vessel with no RealFuels engines and a vessel the Uplink could not read
    /// are different claims, and the payload keeps them different: an empty list
    /// against a null one.
    /// </summary>
    [Fact]
    public void No_engines_is_an_empty_list_and_no_reading_is_a_null_one()
    {
        var empty = RealFuelsCapture.BuildEngines(new RealFuelsVesselRaw { IgnitionsLimited = true });
        Assert.Empty(Assert.IsType<List<Dictionary<string, object?>>>(empty["engines"]));

        var unread = RealFuelsCapture.BuildEngines(null);
        Assert.Null(unread["engines"]);
        Assert.Null(unread["ignitionsLimited"]);
        Assert.Null(unread["ullageSimulated"]);
    }

    /// <summary>
    /// RealFuels' BoiloffMassRate is an accumulated MASS over the physics
    /// interval, not a rate: 0.5 kg lost over 20 ms is 25 kg/s.
    /// </summary>
    [Fact]
    public void Boiloff_mass_over_its_interval_becomes_a_true_rate()
    {
        var payload = RealFuelsCapture.BuildBoiloff(new RealFuelsBoiloffRaw
        {
            BoiloffMassTons = 0.0005,
            IntervalSeconds = 0.02,
            CryogenicTankCount = 3,
        });
        Assert.Equal(25.0, (double)payload["boiloffRate"]!, 9);
        Assert.Equal(3, payload["cryogenicTankCount"]);
    }

    [Fact]
    public void Boiloff_without_an_interval_is_absent_rather_than_zero()
    {
        foreach (var interval in new double?[] { null, 0.0, -1.0 })
        {
            var payload = RealFuelsCapture.BuildBoiloff(new RealFuelsBoiloffRaw
            {
                BoiloffMassTons = 0.0005,
                IntervalSeconds = interval,
                CryogenicTankCount = 3,
            });
            Assert.Null(payload["boiloffRate"]);
            Assert.Equal(3, payload["cryogenicTankCount"]);
        }
    }

    /// <summary>
    /// Zero cryogenic tanks is a real answer (a hypergolic stack never boils
    /// off) and is what makes the absent rate beside it readable.
    /// </summary>
    [Fact]
    public void A_vessel_with_no_cryogenic_tanks_reports_none_rather_than_failing()
    {
        var payload = RealFuelsCapture.BuildBoiloff(new RealFuelsBoiloffRaw
        {
            BoiloffMassTons = null,
            IntervalSeconds = 0.02,
            CryogenicTankCount = 0,
        });
        Assert.Null(payload["boiloffRate"]);
        Assert.Equal(0, payload["cryogenicTankCount"]);
    }

    [Fact]
    public void RealFuels_absent_yields_a_null_count_not_a_zero_one()
    {
        var payload = RealFuelsCapture.BuildBoiloff(null);
        Assert.Null(payload["boiloffRate"]);
        Assert.Null(payload["cryogenicTankCount"]);
    }

    private static TankBoiloffReading Tank(bool? supports, double? mass = null) =>
        new TankBoiloffReading { SupportsBoiloff = supports, MassTons = mass };

    [Fact]
    public void The_vessel_fold_sums_the_tanks_that_boil_off_and_counts_them()
    {
        var raw = RealFuelsCapture.VesselBoiloff(
            new[] { Tank(true, 0.0003), Tank(false), Tank(true, 0.0002) },
            intervalSeconds: 0.02);

        Assert.Equal(0.0005, raw.BoiloffMassTons!.Value, 9);
        Assert.Equal(2, raw.CryogenicTankCount);
    }

    /// <summary>
    /// A tank whose <c>SupportsBoiloff</c> could not be read is not a tank that
    /// said no. Skipped, it left a count that the contract states means the
    /// vessel has no cryogenic tanks and will never boil off, which on an
    /// install where the member had moved was every tank aboard.
    /// </summary>
    [Fact]
    public void A_tank_nobody_could_classify_makes_the_count_unknown_not_zero()
    {
        var allUnreadable = RealFuelsCapture.VesselBoiloff(
            new[] { Tank(null), Tank(null) },
            intervalSeconds: 0.02);
        Assert.Null(allUnreadable.CryogenicTankCount);
        Assert.Null(allUnreadable.BoiloffMassTons);

        var oneUnreadable = RealFuelsCapture.VesselBoiloff(
            new[] { Tank(true, 0.0005), Tank(null) },
            intervalSeconds: 0.02);
        Assert.Null(oneUnreadable.CryogenicTankCount);
        Assert.Null(oneUnreadable.BoiloffMassTons);
    }

    /// <summary>
    /// And a supporting tank whose mass could not be read poisons the sum rather
    /// than dropping out of it: a total over the tanks that answered is lower
    /// than the truth, and nothing in the payload says a term is missing.
    /// </summary>
    [Fact]
    public void A_tank_whose_mass_could_not_be_read_is_not_a_tank_losing_nothing()
    {
        var raw = RealFuelsCapture.VesselBoiloff(
            new[] { Tank(true, 0.0005), Tank(true, null) },
            intervalSeconds: 0.02);

        Assert.Null(raw.BoiloffMassTons);
        Assert.Null(RealFuelsCapture.BuildBoiloff(raw)["boiloffRate"]);
    }

    /// <summary>
    /// RealFuels divides by tank volumes and temperature deltas a part config
    /// supplies, so a non-finite mass is a real return. One NaN tank used to
    /// take the whole vessel's rate with it while every reading still looked
    /// present, and a NaN on the wire is worse than an absent one: every
    /// comparison against it answers false, so downstream bands read nominal.
    /// </summary>
    [Fact]
    public void A_non_finite_tank_reading_is_not_a_measurement()
    {
        foreach (var poison in new[] { double.NaN, double.PositiveInfinity })
        {
            var raw = RealFuelsCapture.VesselBoiloff(
                new[] { Tank(true, 0.0005), Tank(true, poison) },
                intervalSeconds: 0.02);
            Assert.Null(raw.BoiloffMassTons);
            Assert.Null(RealFuelsCapture.BuildBoiloff(raw)["boiloffRate"]);
        }
    }

    /// <summary>
    /// A NaN interval satisfies <c>&lt;= 0.0</c> no more than it satisfies
    /// <c>&gt; 0.0</c>, so the guard on its own let one through and the rate came
    /// out NaN.
    /// </summary>
    [Fact]
    public void A_non_finite_interval_yields_no_rate()
    {
        Assert.Null(RealFuelsCapture.BoiloffRateKgPerSecond(0.0005, double.NaN));
        Assert.Null(RealFuelsCapture.BoiloffRateKgPerSecond(0.0005, double.PositiveInfinity));
        Assert.Null(RealFuelsCapture.BoiloffRateKgPerSecond(double.NaN, 0.02));
    }

    /// <summary>
    /// The finiteness policy covers every double the mapper publishes, not just
    /// the boiloff rate: a NaN stability would clear no band and draw
    /// VERY UNSTABLE, and a NaN residual would render as a quantity.
    /// </summary>
    [Fact]
    public void A_non_finite_engine_reading_never_reaches_the_wire()
    {
        var e = FirstEngine(RealFuelsCapture.BuildEngines(new RealFuelsVesselRaw
        {
            IgnitionsLimited = true,
            UllageSimulated = true,
            Engines =
            {
                new RealFuelsEngineRaw
                {
                    UllageModelled = true,
                    UllageStability = double.NaN,
                    IgnitionProbability = double.NaN,
                    RatedBurnTimeSeconds = double.PositiveInfinity,
                    RatedContinuousBurnTimeSeconds = double.NaN,
                    PredictedMaximumResiduals = double.NaN,
                },
            },
        }));

        Assert.Null(e["ullageStability"]);
        Assert.Null(e["ignitionProbability"]);
        Assert.Null(e["ratedBurnTimeSeconds"]);
        Assert.Null(e["ratedContinuousBurnTimeSeconds"]);
        Assert.Null(e["predictedMaximumResiduals"]);
    }
}
