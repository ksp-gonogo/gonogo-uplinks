using System.Linq;
using Gonogo.KerbcastUplink;
using Sitrep.Contract;
using Xunit;

namespace GonogoKerbcastUplink.Tests;

public class KerbcastReachTests
{
    private static string? Value(UplinkHealth health, string label) =>
        health.Facts.Where(f => f.Label == label).Select(f => f.Value).SingleOrDefault();

    [Fact]
    public void ReadsLoopbackAsThisComputerOnly_WithTheLineToChange()
    {
        var reach = new KerbcastReach("127.0.0.1", 8088, true);

        var facts = reach.Facts();

        Assert.Equal("this computer only", facts.Single(f => f.Label == "camera feeds reachable from").Value);
        var change = facts.Single(f => f.Label == "to allow other computers").Value!;
        Assert.Contains("BindAddress", change);
        Assert.Contains("GameData/Kerbcast/PluginData/settings.cfg", change);
        Assert.Contains("next KSP start", change);
    }

    [Fact]
    public void ReadsAnOpenBindAsItsAddressAndPort_WithNoLineToChange()
    {
        var facts = new KerbcastReach("0.0.0.0", 8088, false).Facts();

        Assert.Equal("0.0.0.0:8088", facts.Single().Value);
        Assert.Equal("camera feeds reachable from", facts.Single().Label);
    }

    [Fact]
    public void QuotesTheConfiguredPort()
    {
        Assert.Equal("192.168.1.20:9000", new KerbcastReach("192.168.1.20", 9000, false).Facts().Single().Value);
    }

    [Fact]
    public void ReportsNothing_WhenKerbcastCouldNotBeAsked()
    {
        Assert.Empty(KerbcastReach.Unknown.Facts());
    }

    [Fact]
    public void HealthCarriesTheReachFacts()
    {
        var health = KerbcastHealth.Evaluate(null, true, true, false, true, 2, new KerbcastReach("127.0.0.1", 8088, true));

        Assert.Equal("this computer only", Value(health, "camera feeds reachable from"));
    }

    [Fact]
    public void HealthWithoutAReachCarriesNoFacts()
    {
        Assert.Empty(KerbcastHealth.Evaluate(null, true, true, false, true, 2).Facts);
    }

    [Fact]
    public void HealthKeepsTheReachWhileDegraded()
    {
        var health = KerbcastHealth.Evaluate(null, true, true, false, false, 2, new KerbcastReach("0.0.0.0", 8088, false));

        Assert.Equal(UplinkHealthState.Degraded, health.State);
        Assert.Equal("0.0.0.0:8088", Value(health, "camera feeds reachable from"));
    }
}
