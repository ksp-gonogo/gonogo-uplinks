using System.Collections.Generic;
using Gonogo.KerbalismUplink;
using Xunit;

/// <summary>
/// Which Kerbalism channels keep a reading per craft, and the order the
/// background read takes the craft in. A read that skipped a craft or took one
/// every tick looks the same on a widget as one that is right, so this is the
/// place the difference shows.
/// </summary>
public class KerbalismLaneScopeTests
{
    [Fact]
    public void TheChannelsThatReadOneCraftsOwnSystemsFollowTheActiveCraft()
    {
        Assert.True(KerbalismLaneScope.Follows("kerbalism.lifesupport"));
        Assert.True(KerbalismLaneScope.Follows("kerbalism.crew"));
        Assert.True(KerbalismLaneScope.Follows("kerbalism.transmission"));
        Assert.True(KerbalismLaneScope.Follows("kerbalism.reliability"));
    }

    [Fact]
    public void TheSunTheGameWideLogAndTheKerbalOutsideDoNot()
    {
        Assert.False(KerbalismLaneScope.Follows("kerbalism.spaceweather"));
        Assert.False(KerbalismLaneScope.Follows("kerbalism.diagnostics"));
        Assert.False(KerbalismLaneScope.Follows("kerbalism.eva"));
        Assert.False(KerbalismLaneScope.Follows("kerbalism.available"));
    }

    [Fact]
    public void EachCraftIsReadInTurnOnePerCall()
    {
        var craft = new[] { "a", "b", "c" };
        var lastRead = new Dictionary<string, double>();
        var cursor = -1;

        var order = new List<string?>();
        for (var ut = 0.0; ut < 3.0; ut += 1.0)
        {
            order.Add(KerbalismLaneScope.NextDue(craft, lastRead, ref cursor, ut));
        }

        Assert.Equal(new[] { "a", "b", "c" }, order);
    }

    [Fact]
    public void NoCraftIsReadAgainInsideTheInterval()
    {
        var craft = new[] { "a", "b" };
        var lastRead = new Dictionary<string, double>();
        var cursor = -1;
        KerbalismLaneScope.NextDue(craft, lastRead, ref cursor, 0.0);
        KerbalismLaneScope.NextDue(craft, lastRead, ref cursor, 1.0);

        Assert.Null(KerbalismLaneScope.NextDue(craft, lastRead, ref cursor, 2.0));
        Assert.Equal("a", KerbalismLaneScope.NextDue(craft, lastRead, ref cursor, KerbalismLaneScope.IntervalUt));
    }

    [Fact]
    public void ACraftReadOnATimelineALoadAbandonedIsDueAgain()
    {
        var craft = new[] { "a" };
        var lastRead = new Dictionary<string, double> { ["a"] = 500.0 };
        var cursor = -1;

        Assert.Equal("a", KerbalismLaneScope.NextDue(craft, lastRead, ref cursor, 100.0));
    }

    [Fact]
    public void AnEmptyFleetReadsNothing()
    {
        var cursor = -1;
        Assert.Null(KerbalismLaneScope.NextDue(new string[0], new Dictionary<string, double>(), ref cursor, 0.0));
    }
}
