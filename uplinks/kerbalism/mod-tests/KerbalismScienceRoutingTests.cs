using System;
using System.Collections.Generic;
using Gonogo.KerbalismUplink;
using Sitrep.Contract;
using Xunit;

/*
 * The sink alone decides what a recovered credit is worth (it reads no route for one), so what is
 * pinned here is which entry the hook calls. A recovery that reached the increment entry would
 * measure the landed craft's route home: out of range it would wait out the silence deadline, in
 * range it would pick up a light-time delay although the craft is already at the Space Center.
 */
public class KerbalismScienceRoutingTests : IDisposable
{
    private readonly RecordingSink _sink = new();

    public void Dispose() => KerbalismScienceRouting.EndRecovery();

    [Fact]
    public void A_recovered_craft_credits_through_the_recovery_entry_whatever_its_route_home()
    {
        KerbalismScienceRouting.BeginRecovery();

        KerbalismScienceRouting.Route(_sink, "splashed-out-of-range", 12.5, 9000.0, "Kerbalism");
        KerbalismScienceRouting.Route(_sink, "landed-in-range", 3.0, 9000.0, "Kerbalism");

        Assert.Equal(
            new[] { "recovered:splashed-out-of-range:12.5", "recovered:landed-in-range:3" },
            _sink.Calls);
    }

    [Fact]
    public void A_transmission_from_a_craft_in_flight_still_rides_its_delay()
    {
        KerbalismScienceRouting.Route(_sink, "in-flight", 0.5, 4200.0, "Kerbalism");

        Assert.Equal(new[] { "increment:in-flight:0.5" }, _sink.Calls);
    }

    [Fact]
    public void A_transmission_after_the_recovery_has_finished_rides_its_delay_again()
    {
        KerbalismScienceRouting.BeginRecovery();
        KerbalismScienceRouting.EndRecovery();

        KerbalismScienceRouting.Route(_sink, "in-flight", 0.5, 4200.0, "Kerbalism");

        Assert.Equal(new[] { "increment:in-flight:0.5" }, _sink.Calls);
    }

    private sealed class RecordingSink : IDelayedScienceSink
    {
        public List<string> Calls { get; } = new();

        public string ProviderId => "recording";

        public void RecordDelayedScienceIncrement(string vesselId, double amount, double ut, string originDescription) =>
            Calls.Add("increment:" + vesselId + ":" + amount);

        public void RecordRecoveredScience(string vesselId, double amount, double ut, string originDescription) =>
            Calls.Add("recovered:" + vesselId + ":" + amount);
    }
}
