using GonogoTestFlightUplink;
using Xunit;

/// <summary>
/// An RO engine carries one ITestFlightReliability module per failure mode, so
/// every rated time and every base failure rate on the wire is a fold over a
/// list. These assert that a term nobody could read poisons the fold rather than
/// dropping out of it: the old fold seeded a sum and took a max over whatever it
/// happened to read, so one unreadable module lowered the failure rate and
/// raised the survival odds built on it, with nothing in the payload saying so.
/// </summary>
public class TestFlightModuleFoldTests
{
    [Fact]
    public void A_total_over_a_module_nobody_could_read_is_unknown_not_the_rest_of_them()
    {
        Assert.Equal(0.03, TestFlightModuleFold.Total(new double?[] { 0.01, 0.02 }));
        Assert.Null(TestFlightModuleFold.Total(new double?[] { 0.01, null, 0.02 }));
    }

    [Fact]
    public void A_highest_over_a_module_nobody_could_read_is_unknown_not_the_tallest_seen()
    {
        Assert.Equal(36000.0, TestFlightModuleFold.Highest(new double?[] { 3600.0, 36000.0 }));
        Assert.Null(TestFlightModuleFold.Highest(new double?[] { 3600.0, null }));
    }

    /// <summary>
    /// A part with no reliability modules has no rate and no rating. Zero per
    /// second reads as an engine that never fails, and zero seconds rated would
    /// select a budget row.
    /// </summary>
    [Fact]
    public void A_part_with_no_modules_folds_to_nothing_rather_than_to_zero()
    {
        Assert.Null(TestFlightModuleFold.Total(new double?[0]));
        Assert.Null(TestFlightModuleFold.Highest(new double?[0]));
    }

    /// <summary>
    /// The number an operator would have been shown. TestFlight's own
    /// FailureRateToReliability is exp(-rate * seconds), so dropping one of two
    /// equal modules from the sum turns a coin flip into a 71% engine: the
    /// direction that matters, because it is the optimistic one.
    /// </summary>
    [Fact]
    public void The_dropped_term_is_what_moved_the_survival_odds()
    {
        var whole = TestFlightModuleFold.Total(new double?[] { 0.0001, 0.0001 });
        Assert.Equal(0.0002, whole!.Value, 12);

        var partial = 0.0001;
        Assert.Equal(0.5, System.Math.Exp(-whole.Value * 3465), 2);
        Assert.Equal(0.71, System.Math.Exp(-partial * 3465), 2);
    }
}
