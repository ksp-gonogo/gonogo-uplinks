using System.Collections.Generic;
using System.Linq;
using Gonogo.ScansatUplink;
using Sitrep.Contract.TestSupport;
using Xunit;

namespace GonogoScansatUplink.Tests
{
    public class ScanPublishStateTests
    {
        private static ScanCapture Capture(ScanPublishState state, double ut)
        {
            var coverage = new short[360, 180];
            coverage[0, 0] = 1 | 8;
            var includeHeightBiome = state.NeedsHeightBiome("Kerbin");
            var capture = new ScanCapture
            {
                Ut = ut,
                BodyName = "Kerbin",
                Coverage = coverage,
                CoveragePercents = new Dictionary<short, double?> { [1] = 12.5, [2] = 0.0, [8] = 3.0, [16] = 0.0, [128] = 0.0, [256] = 0.0 },
                IncludeHeightBiome = includeHeightBiome,
            };
            if (includeHeightBiome)
            {
                capture.HeightGrid = ScanGrids.BuildHeights(ScanGrids.Width, ScanGrids.Height, (_, _) => 0.0);
                capture.BiomeEntries = new List<object?>();
                capture.BiomeIndices = ScanGrids.BuildBiomeIndices(ScanGrids.Width, ScanGrids.Height, (_, _) => -1);
                state.MarkHeightBiomeCaptured("Kerbin");
            }
            return capture;
        }

        private static void AssertEveryLayerSent(List<ScanPublication> publications)
        {
            Assert.Single(publications, p => p.Kind == ScanChannelKind.Height);
            Assert.Single(publications, p => p.Kind == ScanChannelKind.Biome);
            Assert.Equal(6, publications.Count(p => p.Kind == ScanChannelKind.Coverage));
            Assert.Equal(6, publications.Count(p => p.Kind == ScanChannelKind.Mask));
        }

        [Fact]
        public void AnUnchangedBodyIsNotSentAgainWithoutAReset()
        {
            var state = new ScanPublishState();
            AssertEveryLayerSent(state.Compute(Capture(state, 10)));

            Assert.Empty(state.Compute(Capture(state, 20)));
        }

        [Theory]
        [InlineData(false)]
        [InlineData(true)]
        public void AfterATimelineResetAnExistingSubscriberIsSentEveryLayerAgain(bool afterEarlierUt)
        {
            var state = new ScanPublishState();
            AssertEveryLayerSent(state.Compute(Capture(state, 1000)));

            state.RequestReset();

            AssertEveryLayerSent(state.Compute(Capture(state, afterEarlierUt ? 400 : 1010)));
        }

        [Fact]
        public void AfterATimelineResetALateSubscriberIsNotReseededFromBeforeIt()
        {
            var state = new ScanPublishState();
            var heightTopic = ScanPublishState.FullTopicFor(ScanChannelKind.Height, "Kerbin");
            state.Compute(Capture(state, 1000));
            Assert.True(state.TryTakeReseed(heightTopic, 1000, out _, out _));

            state.RequestReset();

            Assert.False(state.TryTakeReseed(heightTopic, 400, out _, out _));
            state.Compute(Capture(state, 400));
            Assert.True(state.TryTakeReseed(heightTopic, 401, out _, out _));
        }

        [Fact]
        public void TheStateTheUplinkForwardsAResetToSurvivesTheHostsResets()
        {
            TimelineListenerConformance.AssertSurvivesResets(new ScanPublishState());
        }

        [Fact]
        public void AGridIsAlreadySeenOnlyOnceItHasBeenThroughComputeAndUntilAReset()
        {
            var state = new ScanPublishState();
            var capture = Capture(state, 10);
            var hash = CoverageHash.Hash(capture.Coverage!);

            Assert.False(state.AlreadySeen("Kerbin", hash));

            state.Compute(capture);

            Assert.True(state.AlreadySeen("Kerbin", hash));
            Assert.False(state.AlreadySeen("Kerbin", hash + 1));
            Assert.False(state.AlreadySeen("Mun", hash));

            state.RequestReset();

            // Not seen from the moment of the reset, before the Courier has acted on it, so the next capture is taken and every layer goes again.
            Assert.False(state.AlreadySeen("Kerbin", hash));
            AssertEveryLayerSent(state.Compute(Capture(state, 20)));
            Assert.True(state.AlreadySeen("Kerbin", hash));
        }

        [Fact]
        public void AGridThatWouldPublishNothingIsTheOnlyOneReportedAsAlreadySeen()
        {
            var state = new ScanPublishState();
            state.Compute(Capture(state, 10));
            var changed = Capture(state, 20);
            changed.Coverage![5, 5] = 2;
            var hash = CoverageHash.Hash(changed.Coverage);

            Assert.False(state.AlreadySeen("Kerbin", hash));
            Assert.NotEmpty(state.Compute(changed));
            Assert.True(state.AlreadySeen("Kerbin", hash));

            var again = Capture(state, 30);
            again.Coverage![5, 5] = 2;
            Assert.Empty(state.Compute(again));
        }
    }
}
