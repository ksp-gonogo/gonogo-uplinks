using System.Linq;
using Gonogo.RealAntennasUplink;
using Sitrep.Contract;
using Xunit;

namespace GonogoRealAntennasUplink.Tests
{
    /// <summary>
    /// Every reading of a craft's link waits for the light. Declared TrueNow,
    /// the link's margin, quality, rate and per-hop rates reached a command
    /// centre the instant they changed, from a craft minutes away: the far
    /// end's link state, sooner than light could carry it.
    /// </summary>
    public class RaChannelDelayRoleTests
    {
        [Theory]
        [InlineData(RealAntennasManifest.LinkMarginTopic)]
        [InlineData(RealAntennasManifest.LinkQualityTopic)]
        [InlineData(RealAntennasManifest.DataRateTopic)]
        [InlineData(RealAntennasManifest.HopRatesTopic)]
        [InlineData(RealAntennasManifest.AntennasTopic)]
        [InlineData(RealAntennasManifest.ChainsTopic)]
        public void AReadingOfTheCraftOrItsLinkIsDelayed(string topic)
        {
            var channel = RealAntennasManifest.Build().Channels.Single(c => c.Topic == topic);

            Assert.Equal(DelayRole.Delayed, channel.Delay);
        }

        [Fact]
        public void OnlyThePresenceGateIsKnownAtOnce()
        {
            var trueNow = RealAntennasManifest.Build().Channels.Where(c => c.Delay == DelayRole.TrueNow).Select(c => c.Topic);

            Assert.Equal(new[] { RealAntennasManifest.AvailableTopic }, trueNow.ToArray());
        }

        [Fact]
        public void EveryChannelStatesWhatItRequires()
        {
            Assert.All(RealAntennasManifest.Build().Channels, c => Assert.NotNull(c.Requires));
        }
    }
}
