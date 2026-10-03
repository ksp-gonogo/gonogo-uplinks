using Gonogo.ScansatUplink;
using Xunit;

namespace GonogoScansatUplink.Tests
{
    /// <summary>
    /// The sub-topic strings a client actually subscribes to are the load-
    /// bearing contract here: an earlier pass published <c>.AltimetryLoRes</c>
    /// (the enum name) while the client subscribes to <c>.1</c> (the numeric
    /// bit), so nothing ever reached it. These lock the numeric convention.
    /// </summary>
    public class ScanChannelsTests
    {
        [Fact]
        public void BodyTypeSubTopicUsesNumericBitNotName()
        {
            Assert.Equal("Kerbin.1", ScanChannels.BodyTypeSubTopic("Kerbin", 1));
            Assert.Equal("Mun.256", ScanChannels.BodyTypeSubTopic("Mun", 256));
        }

        [Fact]
        public void FullConcreteTopicMatchesClientKey()
        {
            // packages/components/src/Scanning/index.tsx subscribes to
            // `scansat.coverage.${bodyName}.${scanType}`: e.g. Kerbin.1.
            Assert.Equal(
                "scansat.coverage.Kerbin.1",
                ScanChannels.CoveragePrefix + ScanChannels.BodyTypeSubTopic("Kerbin", 1));
            Assert.Equal(
                "scansat.mask.Kerbin.256",
                ScanChannels.MaskPrefix + ScanChannels.BodyTypeSubTopic("Kerbin", 256));
        }

        [Fact]
        public void HeightBiomeSubTopicIsBodyOnly()
        {
            Assert.Equal("scansat.height.Mun", ScanChannels.HeightPrefix + ScanChannels.BodySubTopic("Mun"));
            Assert.Equal("scansat.biome.Mun", ScanChannels.BiomePrefix + ScanChannels.BodySubTopic("Mun"));
        }

        [Fact]
        public void ClientScanTypesMatchTheClientSCANTYPEMap()
        {
            // client/src/schema.ts SCAN_TYPE:
            // AltimetryLoRes 1, AltimetryHiRes 2, Biome 8, Anomaly 16,
            // ResourceLoRes 128, ResourceHiRes 256.
            Assert.Equal(new short[] { 1, 2, 8, 16, 128, 256 }, ScanChannels.ClientScanTypes);
        }

        /// <summary>
        /// A body is captured when any of its grids is watched, whichever
        /// vessel is active, and only then: coverage is captured on demand.
        /// </summary>
        [Theory]
        [InlineData("scansat.coverage.Mun.8")]
        [InlineData("scansat.mask.Mun.1")]
        [InlineData("scansat.height.Mun")]
        [InlineData("scansat.biome.Mun")]
        [InlineData("scansat.anomalies.Mun")]
        public void ABodyIsWatchedWhenAnyOfItsGridsIsSubscribed(string subscribed)
        {
            bool isAnyTopicSubscribed(string prefix) => subscribed.StartsWith(prefix, System.StringComparison.Ordinal);

            Assert.True(ScanChannels.BodyWatched("Mun", isAnyTopicSubscribed));
            Assert.False(ScanChannels.BodyWatched("Kerbin", isAnyTopicSubscribed));
        }

        /// <summary>
        /// The predicate the engine answers IsAnyTopicSubscribed with: a prefix
        /// test over every topic any session holds, whoever subscribed it.
        /// </summary>
        private static System.Func<string, bool> Engine(params string[] subscribed) =>
            prefix => System.Array.Exists(subscribed, topic => topic.StartsWith(prefix, System.StringComparison.Ordinal));

        [Fact]
        public void APlainSubscriptionToOneBodysCoverage_IsWhatMakesThatBodyCaptured()
        {
            var bodies = new[] { "Sun", "Kerbin", "Mun", "Minmus" };

            Assert.Empty(ScanChannels.WatchedBodies(bodies, Engine()));
            Assert.Equal(new[] { "Minmus" }, ScanChannels.WatchedBodies(bodies, Engine("scansat.coverage.Minmus.1")));
            Assert.Equal(
                new[] { "Kerbin", "Mun" },
                ScanChannels.WatchedBodies(bodies, Engine("scansat.mask.Mun.256", "scansat.height.Kerbin", "vessel.orbit")));
        }
    }
}
