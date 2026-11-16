using Gonogo.KerbalismUplink;
using Sitrep.Contract;
using Xunit;

namespace GonogoKerbalismUplink.Tests
{
    /// <summary>
    /// The Uplink is unavailable while Kerbalism's assembly is missing and starting
    /// while Kerbalism sets itself up for the loaded game, so a loaded Kerbalism that
    /// has not set up is neither reported as missing nor has its client refused. In
    /// a game that does not run Kerbalism it is unavailable and says so, since
    /// Kerbalism would otherwise be reported as still loading for as long as that
    /// game is open.
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
        public void IsUnavailableInAGameThatDoesNotRunKerbalism()
        {
            var health = KerbalismHealth.For(loaded: true, available: false, missingFromGame: true);

            Assert.Equal(UplinkHealthState.Unavailable, health.State);
            Assert.Equal(
                "Kerbalism doesn't run in this game. KSP's built-in scenarios and tutorials don't load it.",
                health.Detail);
        }

        [Fact]
        public void AMissingAssemblyIsSaidBeforeAGameThatDoesNotRunKerbalism()
        {
            var health = KerbalismHealth.For(loaded: false, available: false, missingFromGame: true);

            Assert.Equal("Kerbalism assembly not loaded", health.Detail);
        }

        [Theory]
        [InlineData(true, false, true)]
        [InlineData(true, false, false)]
        public void ASettingThatCannotBeReadGivesTheReasonTheHealthGives(bool loaded, bool available, bool missingFromGame)
        {
            Assert.Equal(
                KerbalismHealth.For(loaded, available, missingFromGame).Detail,
                KerbalismHealth.SettingsUnavailableReason(loaded, available, missingFromGame));
        }

        [Fact]
        public void ASettingSaysNotInstalledWhileTheAssemblyIsNotLoaded()
        {
            Assert.Equal(
                "Kerbalism is not installed",
                KerbalismHealth.SettingsUnavailableReason(loaded: false, available: false, missingFromGame: false));
        }

        [Fact]
        public void ASettingHasNoReasonOnceKerbalismCanBeAsked()
        {
            Assert.Null(KerbalismHealth.SettingsUnavailableReason(loaded: true, available: true, missingFromGame: false));
        }

        [Fact]
        public void IsHealthyOnceKerbalismIsLoadedAndSetUp()
        {
            Assert.Equal(UplinkHealthState.Healthy, KerbalismHealth.For(loaded: true, available: true).State);
        }

        [Fact]
        public void IsUnavailableWhenSetupOutlastsTheLimit()
        {
            var health = KerbalismHealth.For(loaded: true, available: false, stalled: true);

            Assert.Equal(UplinkHealthState.Unavailable, health.State);
            Assert.Equal("Kerbalism did not finish setting up. Check KSP.log for Kerbalism errors.", health.Detail);
        }

        [Fact]
        public void IsHealthyAgainWhenSetupCompletesAfterTheLimit()
        {
            Assert.Equal(
                UplinkHealthState.Healthy,
                KerbalismHealth.For(loaded: true, available: true, stalled: true).State);
        }

        [Fact]
        public void AGameThatDoesNotRunKerbalismIsSaidBeforeAStall()
        {
            Assert.Equal(
                KerbalismHealth.MissingFromGame,
                KerbalismHealth.For(loaded: true, available: false, missingFromGame: true, stalled: true).Detail);
        }

        [Fact]
        public void ASettingGivesTheStallReasonTheHealthGives()
        {
            Assert.Equal(
                KerbalismHealth.For(true, false, false, true).Detail,
                KerbalismHealth.SettingsUnavailableReason(true, false, false, true));
        }
    }
}
