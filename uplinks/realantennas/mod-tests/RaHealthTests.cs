using Gonogo.RealAntennasUplink;
using Sitrep.Contract;
using Xunit;

namespace GonogoRealAntennasUplink.Tests
{
    public class RaHealthTests
    {
        [Fact]
        public void NoRealAntennas_IsUnavailable()
        {
            Assert.Equal(UplinkHealthState.Unavailable, RaHealth.Of(false, false).State);
        }

        [Fact]
        public void MissingReceivedPower_IsDegradedAndSaysSo()
        {
            var health = RaHealth.Of(true, false);

            Assert.Equal(UplinkHealthState.Degraded, health.State);
            Assert.Contains("ReceivedPower", health.Detail);
        }

        [Fact]
        public void ReceivedPowerFound_IsHealthy()
        {
            Assert.Equal(UplinkHealthState.Healthy, RaHealth.Of(true, true).State);
        }
    }
}
