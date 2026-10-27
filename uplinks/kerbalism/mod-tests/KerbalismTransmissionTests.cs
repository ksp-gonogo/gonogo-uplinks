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
}
