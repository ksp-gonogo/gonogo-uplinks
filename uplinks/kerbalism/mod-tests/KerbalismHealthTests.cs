using Gonogo.KerbalismUplink;
using Sitrep.Contract;
using Xunit;

namespace GonogoKerbalismUplink.Tests
{
    /// <summary>
    /// The Uplink is unavailable while Kerbalism's assembly is missing and starting
    /// while Kerbalism sets itself up for the loaded game, so a loaded Kerbalism that
    /// has not set up is neither reported as missing nor has its client refused.
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
        public void IsStartingWhileKerbalismIsLoadedButNotReady()
        {
            var health = KerbalismHealth.For(loaded: true, available: false);

            Assert.Equal(UplinkHealthState.Starting, health.State);
            Assert.Equal("Kerbalism hasn't finished loading.", health.Detail);
        }

        [Fact]
        public void IsHealthyOnceKerbalismIsLoadedAndSetUp()
        {
            Assert.Equal(UplinkHealthState.Healthy, KerbalismHealth.For(loaded: true, available: true).State);
        }
    }
}
