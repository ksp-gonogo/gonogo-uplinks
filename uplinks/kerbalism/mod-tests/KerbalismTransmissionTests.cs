using Gonogo.KerbalismUplink;
using Xunit;

public class KerbalismTransmissionTests
{
    [Fact]
    public void A_reported_total_reaches_the_wire_under_its_camel_cased_key()
    {
        var wire = KerbalismCapture.BuildTransmission(new TransmissionRaw { ScienceTransmitted = 12.5 });
        Assert.Equal(12.5, wire["scienceTransmitted"]);
    }

    [Fact]
    public void A_total_that_was_not_read_rides_as_null_and_not_as_zero()
    {
        var wire = KerbalismCapture.BuildTransmission(new TransmissionRaw());
        Assert.True(wire.ContainsKey("scienceTransmitted"));
        Assert.Null(wire["scienceTransmitted"]);
    }

    [Fact]
    public void A_total_that_is_really_zero_stays_zero()
    {
        var wire = KerbalismCapture.BuildTransmission(new TransmissionRaw { ScienceTransmitted = 0 });
        Assert.Equal(0.0, wire["scienceTransmitted"]);
    }

    [Fact]
    public void A_rate_and_target_reach_the_wire_under_their_camel_cased_keys()
    {
        var wire = KerbalismCapture.BuildTransmission(
            new TransmissionRaw { DataRateBitsPerSecond = 144_000, Target = "DSN: KSC" });
        Assert.Equal(144_000.0, wire["dataRate"]);
        Assert.Equal("DSN: KSC", wire["target"]);
    }

    [Fact]
    public void Kerbalisms_megabytes_per_second_become_bits_per_second()
    {
        // 18 kB/s, the figure Kerbalism's own telemetry page prints, is 144 kbit/s.
        var (bits, _) = KerbalismCapture.LinkFigures(true, 0.018, "DSN: KSC");
        Assert.Equal(144_000.0, bits!.Value, 6);
    }

    [Fact]
    public void A_craft_with_no_link_has_neither_a_rate_nor_a_target_and_never_a_zero()
    {
        Assert.Equal((null, null), KerbalismCapture.LinkFigures(false, 0.018, "DSN: KSC"));
        Assert.Equal((null, null), KerbalismCapture.LinkFigures(null, 0.018, "DSN: KSC"));
    }

    [Theory]
    [InlineData(0.0)]
    [InlineData(-1.0)]
    [InlineData(null)]
    public void A_linked_craft_with_no_readable_rate_keeps_its_target_and_has_no_rate(double? rate)
    {
        var (bits, target) = KerbalismCapture.LinkFigures(true, rate, "Relay 1");
        Assert.Null(bits);
        Assert.Equal("Relay 1", target);
    }

    [Fact]
    public void An_empty_target_name_is_no_target()
    {
        Assert.Null(KerbalismCapture.LinkFigures(true, 0.018, "").Target);
        Assert.Null(KerbalismCapture.LinkFigures(true, 0.018, null).Target);
    }
}
