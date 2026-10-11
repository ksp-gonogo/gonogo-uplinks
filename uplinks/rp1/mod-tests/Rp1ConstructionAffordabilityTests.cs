using System.Collections.Generic;
using GonogoRp1Uplink;
using Xunit;

public class Rp1ConstructionAffordabilityTests
{
    private static Rp1ConstructionRaw Upgrade(double workRate = 1.0) => new Rp1ConstructionRaw
    {
        Id = "FacilityUpgrade|Astronaut",
        Kind = "FacilityUpgrade",
        Progress = 25.0,
        TotalPoints = 100.0,
        WorkRate = workRate,
        Rate = 0.01 * workRate,
    };

    private static Rp1ConstructionRatesRaw Rates(double? costPerDay)
    {
        var table = new Rp1ConstructionRateTableRaw { Id = "FacilityUpgrade|Astronaut" };
        table.Steps.Add(new Rp1ConstructionRateStepRaw { WorkRate = 0.0, CostPerDay = 0.0 });
        table.Steps.Add(new Rp1ConstructionRateStepRaw { WorkRate = 1.0, CostPerDay = costPerDay });
        return new Rp1ConstructionRatesRaw { Constructions = new List<Rp1ConstructionRateTableRaw> { table } };
    }

    [Fact]
    public void A_career_with_no_funds_stalls_the_construction_with_no_finish_date()
    {
        var row = Upgrade();
        Rp1ConstructionAffordability.Apply(new[] { row }, Rates(653.94), 0.0);

        Assert.Equal(0.0, row.AffordableFraction);
        Assert.Equal(0.0, row.Rate);
        Assert.True(row.Stalled);
        Assert.Null(row.TimeLeftSeconds);
    }

    [Fact]
    public void A_shortfall_slows_the_construction_and_moves_the_finish_date_out()
    {
        var row = Upgrade();
        Rp1ConstructionAffordability.Apply(new[] { row }, Rates(1000.0), 250.0);

        Assert.Equal(0.25, row.AffordableFraction);
        Assert.Equal(0.0025, row.Rate!.Value, 12);
        Assert.False(row.Stalled);
        Assert.Equal(75.0 / 0.0025, row.TimeLeftSeconds!.Value, 6);
    }

    [Fact]
    public void Funds_that_meet_the_draw_leave_the_costed_rate_alone()
    {
        var row = Upgrade();
        Rp1ConstructionAffordability.Apply(new[] { row }, Rates(100.0), 5000.0);

        Assert.Equal(1.0, row.AffordableFraction);
        Assert.Equal(0.01, row.Rate);
        Assert.Equal(75.0 / 0.01, row.TimeLeftSeconds!.Value, 6);
    }

    [Fact]
    public void A_stopped_throttle_asks_for_nothing_and_is_stalled_for_its_own_reason()
    {
        var row = Upgrade(workRate: 0.0);
        Rp1ConstructionAffordability.Apply(new[] { row }, Rates(100.0), 0.0);

        Assert.Equal(1.0, row.AffordableFraction);
        Assert.True(row.Stalled);
    }

    [Fact]
    public void A_negative_balance_is_no_funds_rather_than_a_negative_rate()
    {
        var row = Upgrade();
        Rp1ConstructionAffordability.Apply(new[] { row }, Rates(100.0), -50.0);

        Assert.Equal(0.0, row.AffordableFraction);
        Assert.True(row.Stalled);
    }

    [Theory]
    [InlineData(false, true)]
    [InlineData(true, false)]
    public void What_could_not_be_read_leaves_RP1s_costed_rate_unqualified(bool noBalance, bool noDraw)
    {
        var row = Upgrade();
        Rp1ConstructionAffordability.Apply(
            new[] { row }, Rates(noDraw ? (double?)null : 100.0), noBalance ? (double?)null : 0.0);

        Assert.Null(row.AffordableFraction);
        Assert.Equal(0.01, row.Rate);
        Assert.False(row.Stalled);
    }
}
