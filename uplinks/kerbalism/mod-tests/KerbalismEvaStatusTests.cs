using System;
using System.Collections.Generic;
using Gonogo.KerbalismUplink;
using Xunit;

public class KerbalismEvaStatusTests
{
    private static Dictionary<string, object?> Habitat(Func<bool?>? evaSafe)
    {
        var snapshot = KerbalismCapture.BuildSnapshot(
            _ => 1.0, _ => true, _ => 2.0, _ => 3.0, new[] { "Food" }, _ => -0.5, evaSafe);
        var wire = KerbalismCapture.BuildLifeSupport(snapshot, new List<ProcessRaw>());
        return (Dictionary<string, object?>)wire["habitat"]!;
    }

    [Theory]
    [InlineData(true)]
    [InlineData(false)]
    public void A_read_status_reaches_the_habitat_as_a_flag(bool safe)
    {
        Assert.Equal(safe, Habitat(() => safe)["evaSafe"]);
    }

    [Fact]
    public void A_craft_whose_eva_status_is_not_modelled_rides_as_null_and_not_as_risky()
    {
        var habitat = Habitat(() => null);
        Assert.True(habitat.ContainsKey("evaSafe"));
        Assert.Null(habitat["evaSafe"]);
    }

    [Fact]
    public void A_reader_that_was_never_supplied_leaves_the_status_null()
    {
        Assert.Null(Habitat(null)["evaSafe"]);
    }
}
