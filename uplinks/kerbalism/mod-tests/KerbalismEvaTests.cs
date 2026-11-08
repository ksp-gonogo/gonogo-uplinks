using System;
using System.Collections.Generic;
using Gonogo.KerbalismUplink;
using Xunit;

/// <summary>
/// The suit payload for a kerbal outside: only the resources the suit has a tank
/// for, and a reading Kerbalism did not answer stays null rather than becoming zero.
/// </summary>
public class KerbalismEvaTests
{
    private static readonly Dictionary<string, RuleConstants> Constants = new()
    {
        ["radiation"] = new RuleConstants { DegenPerSec = 1e-7, FatalThreshold = 50 },
    };

    private static Dictionary<string, object?> Build(
        Func<string, double?> amount,
        Func<string, double?> capacity,
        Func<string, double?>? rate = null,
        double? radiation = 1e-7,
        KerbalRulesRaw? kerbal = null) =>
        KerbalismCapture.BuildEva(
            kerbal,
            Constants,
            new[] { "ElectricCharge", "Oxygen", "Food" },
            amount,
            capacity,
            rate ?? (_ => -0.1),
            radiation);

    [Fact]
    public void A_resource_the_suit_has_no_tank_for_has_no_key()
    {
        var eva = Build(
            name => name == "Food" ? null : 2.0,
            name => name == "Food" ? 0.0 : 5.0);
        var resources = (Dictionary<string, object?>)eva["resources"]!;
        Assert.Contains("Oxygen", resources.Keys);
        Assert.Contains("ElectricCharge", resources.Keys);
        Assert.DoesNotContain("Food", resources.Keys);
    }

    [Fact]
    public void An_unanswered_rate_and_radiation_reach_the_wire_as_null()
    {
        var eva = Build(_ => 2.0, _ => 5.0, rate: _ => null, radiation: null);
        var oxygen = (Dictionary<string, object?>)((Dictionary<string, object?>)eva["resources"]!)["Oxygen"]!;
        Assert.Null(oxygen["rate"]);
        Assert.Equal(2.0, oxygen["amount"]);
        Assert.Null(eva["radiationRadPerSecond"]);
    }

    [Fact]
    public void The_kerbals_name_and_rules_ride_with_the_suit()
    {
        var kerbal = new KerbalRulesRaw { Name = "Valentina Kerman" };
        kerbal.Rules["radiation"] = 0.25;
        var eva = Build(_ => 2.0, _ => 5.0, kerbal: kerbal);
        Assert.Equal("Valentina Kerman", eva["name"]);
        var rules = Assert.IsType<List<object>>(eva["rules"]);
        var rule = Assert.IsType<Dictionary<string, object?>>(Assert.Single(rules));
        Assert.Equal("radiation", rule["name"]);
        Assert.Equal(0.25, rule["problem"]);
    }

    [Fact]
    public void No_kerbal_reads_leaves_name_and_rules_null()
    {
        var eva = Build(_ => 2.0, _ => 5.0);
        Assert.Null(eva["name"]);
        Assert.Null(eva["rules"]);
    }
}
