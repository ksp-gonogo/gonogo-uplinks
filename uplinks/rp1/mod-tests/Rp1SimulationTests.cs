using System;
using System.Collections.Generic;
using System.Linq;
using GonogoRp1Uplink;
using RP0;
using Sitrep.Contract;
using Sitrep.Contract.TestSupport;
using Xunit;

/// <summary>
/// RP-1's simulation, end to end on this Uplink: the operator's
/// <c>delayInSimulation</c> setting, the zero delay modifier held on an ungated
/// main-thread source, and the <c>rp1.simulation</c> topic.
///
/// <para>The modifier is driven with NOTHING subscribed, because that is the
/// session it matters in: an operator flying a simulation from a board with no
/// RP-1 widget on it still gets the delay switched off.</para>
/// </summary>
[Collection("rp0-static-graph")]
public class Rp1SimulationTests : IDisposable
{
    public Rp1SimulationTests() => SpaceCenterManagement.Instance = null;

    public void Dispose() => SpaceCenterManagement.Instance = null;

    private static (Rp1ScUplink Uplink, StarvationProbeHost Host, RecordingUplinkSettings Settings) Registered(
        IReadOnlyDictionary<string, string>? stored = null)
    {
        var uplink = new Rp1ScUplink();
        var settings = new RecordingUplinkSettings(stored);
        uplink.DeclareSettings(settings);
        settings.Close();
        var kernel = new Kernel();
        kernel.RegisterCapability(new CapabilityDescriptor
        {
            Id = CrewStandingCapability.Id,
            Exclusive = true,
            SpineCritical = false,
            Vanilla = _ => null!,
        });
        var host = new StarvationProbeHost(kernel);
        uplink.Register(host);
        host.Resolve();
        return (uplink, host, settings);
    }

    private static SpaceCenterManagement Simulating(bool active, bool inOrbit = false)
    {
        var scm = new SpaceCenterManagement { IsSimulatedFlight = active };
        scm.SimulationParams.SimulateInOrbit = inOrbit;
        SpaceCenterManagement.Instance = scm;
        return scm;
    }

    private static Dictionary<string, object?>? LastSimulation(StarvationProbeHost host) =>
        (Dictionary<string, object?>?)host.PublishedTo(Rp1ScUplink.SimulationTopic).Last();

    [Fact]
    public void It_declares_delayInSimulation_as_an_off_by_default_bool()
    {
        var settings = new RecordingUplinkSettings();
        new Rp1ScUplink().DeclareSettings(settings);

        var row = Assert.Single(settings.Declared);
        Assert.Equal("delayInSimulation", row.Name);
        Assert.Equal(Rp1ScUplink.DelayInSimulationSetting, row.Name);
        Assert.Equal(SettingKind.Bool, row.Kind);
        Assert.Equal("False", row.DefaultText);
        Assert.Equal("Apply the delay during a simulation as well as a real flight", row.Label);
    }

    [Fact]
    public void Its_settings_declaration_meets_the_declarer_contract()
    {
        UplinkSettingsConformance.AssertDeclarerContract(new Rp1ScUplink());
        UplinkSettingsConformance.AssertDeclarerContract(
            new Rp1ScUplink(),
            new Dictionary<string, string> { [Rp1ScUplink.DelayInSimulationSetting] = "True" },
            "1.0.0");
    }

    [Fact]
    public void The_simulation_source_is_ungated()
    {
        Simulating(false);
        var (_, host, _) = Registered();

        var source = Assert.Single(
            host.SampledSources,
            s => s.CaptureName == nameof(Rp1ScUplink.CaptureSimulationOnMain));
        Assert.False(source.Gated);
    }

    [Fact]
    public void A_simulation_switches_delay_off_with_nothing_subscribed()
    {
        Simulating(true);
        var (_, host, _) = Registered();

        host.DriveTicks(3, new KspSnapshot());

        var held = Assert.Single(host.DelayModifiers.Held);
        Assert.Equal(0.0, held.Factor);
        Assert.Equal(Rp1SimulationDelay.Reason, held.Reason);
    }

    [Fact]
    public void A_real_flight_keeps_its_delay()
    {
        Simulating(false);
        var (_, host, _) = Registered();

        host.DriveTicks(3, new KspSnapshot());

        Assert.Empty(host.DelayModifiers.Held);
    }

    [Fact]
    public void The_setting_keeps_delay_on_through_a_simulation()
    {
        Simulating(true);
        var (_, host, _) = Registered(
            new Dictionary<string, string> { [Rp1ScUplink.DelayInSimulationSetting] = "True" });

        host.DriveTicks(3, new KspSnapshot());

        Assert.Empty(host.DelayModifiers.Held);
    }

    [Fact]
    public void Turning_the_setting_on_mid_simulation_gives_the_delay_back_on_the_next_tick()
    {
        Simulating(true);
        var (_, host, settings) = Registered();
        host.DriveTick(new KspSnapshot());
        Assert.Single(host.DelayModifiers.Held);

        settings.Change(Rp1ScUplink.DelayInSimulationSetting, "True");
        host.DriveTick(new KspSnapshot());

        Assert.Empty(host.DelayModifiers.Held);
    }

    [Fact]
    public void The_end_of_a_simulation_gives_the_delay_back_on_the_next_tick()
    {
        var scm = Simulating(true);
        var (_, host, _) = Registered();
        host.DriveTick(new KspSnapshot());
        Assert.Single(host.DelayModifiers.Held);

        scm.IsSimulatedFlight = false;
        host.DriveTick(new KspSnapshot());

        Assert.Empty(host.DelayModifiers.Held);
    }

    [Fact]
    public void The_topic_says_a_simulation_is_running_and_where_it_started()
    {
        Simulating(true, inOrbit: true);
        var (_, host, _) = Registered();

        host.DriveTick(new KspSnapshot());

        var payload = LastSimulation(host);
        Assert.NotNull(payload);
        Assert.Equal(true, payload!["active"]);
        Assert.Equal(Rp1SimulationCapture.OrbitKind, payload["kind"]);
    }

    [Fact]
    public void The_topic_publishes_even_when_the_setting_keeps_the_delay()
    {
        Simulating(true);
        var (_, host, _) = Registered(
            new Dictionary<string, string> { [Rp1ScUplink.DelayInSimulationSetting] = "True" });

        host.DriveTick(new KspSnapshot());

        Assert.Equal(true, LastSimulation(host)!["active"]);
        Assert.Equal(Rp1SimulationCapture.LaunchKind, LastSimulation(host)!["kind"]);
    }

    [Fact]
    public void A_real_flight_is_inactive_with_no_kind()
    {
        Simulating(false, inOrbit: true);
        var (_, host, _) = Registered();

        host.DriveTick(new KspSnapshot());

        var payload = LastSimulation(host);
        Assert.Equal(false, payload!["active"]);
        Assert.Null(payload["kind"]);
    }

    [Fact]
    public void A_save_RP1_does_not_manage_publishes_nothing()
    {
        SpaceCenterManagement.Instance = new SpaceCenterManagement { enabledForSave = false, IsSimulatedFlight = true };
        var (_, host, _) = Registered();

        host.DriveTick(new KspSnapshot());

        Assert.Null(LastSimulation(host));
        Assert.Empty(host.DelayModifiers.Held);
    }

    [Fact]
    public void The_channel_is_true_now_and_treats_absence_as_data()
    {
        var channel = new Rp1ScUplink().Manifest.Channels.Single(c => c.Topic == Rp1ScUplink.SimulationTopic);

        Assert.Equal(DelayRole.TrueNow, channel.Delay);
        Assert.False(channel.HeldAtHome);
        Assert.True(channel.AbsenceIsData);
    }

    [Fact]
    public void The_capture_mapper_states_no_kind_for_an_unknown_orbit_choice()
    {
        var payload = Rp1SimulationCapture.Build(true, null);

        Assert.Equal(true, payload!["active"]);
        Assert.Null(payload["kind"]);
        Assert.Null(Rp1SimulationCapture.Build(null, true));
    }
}
