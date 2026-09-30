using System;
using System.Linq;
using GonogoRp1Uplink;
using RP0;
using Xunit;

/// <summary>
/// RP-1's forecast for a figure, against the stand-in object graph: the
/// arguments RP-1's own estimate is asked with, the instant it is turned into,
/// the refresh it is keyed on, and the answers that are not a forecast.
/// </summary>
[Collection("rp0-static-graph")]
public class Rp1FundsReachedAtTests : IDisposable
{
    private const double Ut = 1_000_000d;

    public Rp1FundsReachedAtTests() => Clear();

    public void Dispose() => Clear();

    private static void Clear()
    {
        MaintenanceHandler.Instance = null;
        FundTargetProject.ResetEstimate();
    }

    private static MaintenanceHandler ACareer(double refreshedAt = 500d)
    {
        var maintenance = new MaintenanceHandler { lastUpdate = refreshedAt };
        MaintenanceHandler.Instance = maintenance;
        return maintenance;
    }

    [Fact]
    public void Asks_RP1s_own_estimate_from_the_balance_at_its_auto_warp_precision_and_answers_an_instant()
    {
        ACareer();
        FundTargetProject.EstimateAnswer = (_, _) => 86_400d;
        var reader = new Rp1FundsReachedAtReflection();

        var readings = reader.CaptureOnMain(Ut, 40_000d, new long[] { 250_000 });

        Assert.True(reader.IsAvailable);
        Assert.Equal((40_000d, 250_000d, 60d), Assert.Single(FundTargetProject.EstimateAsks));
        var reading = Assert.Single(readings);
        Assert.Equal(250_000, reading.Figure);
        Assert.True(reading.Readable);
        Assert.Equal(Ut + 86_400d, reading.ReachedAt);
    }

    [Fact]
    public void A_figure_RP1s_forecast_never_reaches_is_readable_with_no_instant()
    {
        ACareer();
        FundTargetProject.EstimateAnswer = (_, _) => double.PositiveInfinity;

        var reading = Assert.Single(new Rp1FundsReachedAtReflection().CaptureOnMain(Ut, 40_000d, new long[] { 9_000_000 }));

        Assert.True(reading.Readable);
        Assert.Null(reading.ReachedAt);
    }

    [Fact]
    public void A_figure_already_met_is_reached_now()
    {
        ACareer();

        var reading = Assert.Single(new Rp1FundsReachedAtReflection().CaptureOnMain(Ut, 40_000d, new long[] { 10_000 }));

        Assert.True(reading.Readable);
        Assert.Equal(Ut, reading.ReachedAt);
    }

    [Fact]
    public void An_unreadable_balance_or_a_throwing_estimate_is_not_a_forecast()
    {
        ACareer();
        var noBalance = Assert.Single(new Rp1FundsReachedAtReflection().CaptureOnMain(Ut, null, new long[] { 250_000 }));
        Assert.False(noBalance.Readable);
        Assert.Empty(FundTargetProject.EstimateAsks);

        FundTargetProject.EstimateAnswer = (_, _) => throw new InvalidOperationException("no budget");
        var threw = Assert.Single(new Rp1FundsReachedAtReflection().CaptureOnMain(Ut, 40_000d, new long[] { 250_000 }));
        Assert.False(threw.Readable);
    }

    [Fact]
    public void Each_figure_is_asked_once_per_RP1_upkeep_refresh()
    {
        var maintenance = ACareer(refreshedAt: 500d);
        FundTargetProject.EstimateAnswer = (_, _) => 100d;
        var reader = new Rp1FundsReachedAtReflection();

        reader.CaptureOnMain(Ut, 40_000d, new long[] { 250_000 });
        var held = Assert.Single(reader.CaptureOnMain(Ut + 10d, 41_000d, new long[] { 250_000 }));
        Assert.Single(FundTargetProject.EstimateAsks);
        Assert.Equal(Ut + 100d, held.ReachedAt);

        reader.CaptureOnMain(Ut + 20d, 41_000d, new long[] { 250_000, 300_000 });
        Assert.Equal(new[] { 250_000d, 300_000d }, FundTargetProject.EstimateAsks.Select(a => a.TargetFunds));

        maintenance.lastUpdate = 4_100d;
        var refreshed = Assert.Single(reader.CaptureOnMain(Ut + 3_600d, 42_000d, new long[] { 250_000 }));
        Assert.Equal(3, FundTargetProject.EstimateAsks.Count);
        Assert.Equal(Ut + 3_700d, refreshed.ReachedAt);
    }

    [Fact]
    public void Answers_nothing_while_RP1_has_no_career_loaded()
    {
        Assert.Empty(new Rp1FundsReachedAtReflection().CaptureOnMain(Ut, 40_000d, new long[] { 250_000 }));
        Assert.Empty(FundTargetProject.EstimateAsks);
    }

    [Theory]
    [InlineData("250000", 250000L)]
    [InlineData("0", null)]
    [InlineData("-5", null)]
    [InlineData("2.5", null)]
    [InlineData("1e6", null)]
    [InlineData("", null)]
    public void A_sub_topic_names_a_positive_whole_figure_or_nothing(string subTopic, long? figure)
    {
        Assert.Equal(figure, Rp1FundsReachedAtReflection.FigureOf(subTopic));
    }

    [Fact]
    public void A_figure_round_trips_through_its_sub_topic()
    {
        Assert.Equal(1_234_567L, Rp1FundsReachedAtReflection.FigureOf(Rp1FundsReachedAtReflection.SubTopicFor(1_234_567)));
    }
}
