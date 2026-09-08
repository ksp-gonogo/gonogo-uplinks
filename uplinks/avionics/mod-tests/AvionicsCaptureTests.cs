using GonogoAvionicsUplink;
using Xunit;

public class AvionicsCaptureTests
{
    [Fact]
    public void Build_flags_no_go_when_mass_exceeds_limit()
    {
        var s = AvionicsCapture.Build(new AvionicsRaw { ControllableMassTons = 4.0, AvionicsActive = true }, vesselMassTons: 5.2);
        Assert.Equal(false, s["controllable"]);
        Assert.Equal(4.0, (double)s["controllableMassTons"]!, 6);
        Assert.Equal(5.2, (double)s["vesselMassTons"]!, 6);
        Assert.Equal(true, s["avionicsActive"]);
    }

    [Fact]
    public void Build_flags_go_when_within_limit()
    {
        var s = AvionicsCapture.Build(new AvionicsRaw { ControllableMassTons = 10.0, AvionicsActive = true }, vesselMassTons: 6.5);
        Assert.Equal(true, s["controllable"]);
    }

    [Fact]
    public void Build_flags_go_when_mass_equals_limit()
    {
        // ShouldLock locks only when vesselMass > maxMass, so mass == limit is GO.
        var s = AvionicsCapture.Build(new AvionicsRaw { ControllableMassTons = 5.0, AvionicsActive = true }, vesselMassTons: 5.0);
        Assert.Equal(true, s["controllable"]);
    }

    // A vessel that HAS an avionics unit whose switch could not be read is a
    // different fact from one with no avionics at all, and the wire has to keep
    // them apart: the widget draws NO AVIONICS for a false and withholds its
    // verdict for a null. Coalesced (`systemEnabled ?? true`) this arrived as a
    // confident "on" and the widget drew a GO/NO-GO off a switch nobody read.
    [Fact]
    public void Build_carries_an_unread_switch_through_as_null()
    {
        var s = AvionicsCapture.Build(
            new AvionicsRaw { ControllableMassTons = 4.0, AvionicsActive = null },
            vesselMassTons: 5.2);

        Assert.Null(s["avionicsActive"]);
        // The mass limit WAS read, so it still goes out: only the switch is unknown.
        Assert.Equal(4.0, (double)s["controllableMassTons"]!, 6);
    }

    [Fact]
    public void Build_reports_no_avionics_when_raw_null()
    {
        var s = AvionicsCapture.Build(null, vesselMassTons: 6.5);
        Assert.Equal(false, s["avionicsActive"]);
        Assert.Null(s["controllableMassTons"]);
        Assert.Equal(false, s["controllable"]);
        Assert.Equal(6.5, (double)s["vesselMassTons"]!, 6);
    }
}
