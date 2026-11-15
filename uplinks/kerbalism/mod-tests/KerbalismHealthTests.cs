using Gonogo.KerbalismUplink;
using Sitrep.Contract;
using Xunit;

namespace GonogoKerbalismUplink.Tests
{
    /// <summary>
    /// The Uplink is unavailable until Kerbalism is both loaded and set up for the
    /// loaded game, and says which of the two it is waiting on, so a loaded
    /// Kerbalism that has not set up is not reported as missing.
    /// </summary>
    public class KerbalismHealthTests
    {
        [Fact]
        public void SaysTheAssemblyIsNotLoadedWhenItIsNot()
        {
            var health = KerbalismHealth.For(loaded: false, available: false);

            Assert.Equal(UplinkHealthState.Unavailable, health.State);
            Assert.Equal("Kerbalism assembly not loaded", health.Detail);
        }

        [Fact]
        public void SaysKerbalismHasNotSetUpWhenItIsLoadedButNotReady()
        {
            var health = KerbalismHealth.For(loaded: true, available: false);

            Assert.Equal(UplinkHealthState.Unavailable, health.State);
            Assert.Equal("Kerbalism hasn't finished loading.", health.Detail);
        }

        [Fact]
        public void IsHealthyOnceKerbalismIsLoadedAndSetUp()
        {
            Assert.Equal(UplinkHealthState.Healthy, KerbalismHealth.For(loaded: true, available: true).State);
        }
    }
}
