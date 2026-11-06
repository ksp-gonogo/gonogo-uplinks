using System.Collections.Generic;
using System.Text.Json;
using Gonogo.RealAntennasUplink;
using Sitrep.Contract;
using Sitrep.Contract.TestSupport;
using Xunit;

namespace GonogoRealAntennasUplink.Tests
{
    /// <summary>
    /// The craft-level figures of <c>realantennas.fleet</c>. The hop rates are
    /// what RealAntennas' own rate ladder gives the rig pair in
    /// <see cref="RaRigPair"/> a hundred thousand kilometres apart; the band
    /// frequencies other than L are test values.
    /// </summary>
    public class RaFleetTests
    {
        private static RaFleet.Reading Reading(string band, double hz, bool dish) => new RaFleet.Reading(band, hz, dish);

        [Fact]
        public void TheBestBandIsTheOneOfTheHighestFrequencyAntenna()
        {
            var antennas = new[] { Reading("L", 1.62e9, false), Reading("X", 8.4e9, true), Reading("S", 2.25e9, true) };

            Assert.Equal("X", RaFleet.BestBand(antennas));
        }

        [Fact]
        public void AnAntennaWhoseBandCannotBeReadIsNotTheBestBandAndNoneReadsNull()
        {
            Assert.Equal("L", RaFleet.BestBand(new[] { new RaFleet.Reading(null, 9e9, true), Reading("L", 1.62e9, false) }));
            Assert.Null(RaFleet.BestBand(new[] { new RaFleet.Reading("L", null, true) }));
            Assert.Null(RaFleet.BestBand(new RaFleet.Reading[0]));
        }

        [Fact]
        public void OnlyASteerableAntennaIsADishAndAnUnreadShapeIsNot()
        {
            var antennas = new[] { Reading("L", 1.62e9, true), Reading("L", 1.62e9, false), new RaFleet.Reading("L", 1.62e9, null), Reading("S", 2.25e9, true) };

            Assert.Equal(2, RaFleet.DishCount(antennas));
        }

        [Fact]
        public void TheRateToHomeIsTheSlowestHopAlongTheRouteInTheDirectionFromTheCraft()
        {
            var worth = RaLinkWorth.At(RaRigPair.InSpace, RaRigPair.Landed, 1e8);
            var forward = worth.Forward.BitsPerSecond;
            var reverse = worth.Reverse.BitsPerSecond;
            Assert.True(forward > 0 && reverse > 0, "the rig pair must close at 100 000 km for the rates to mean anything");

            var craftIsLinkA = RaFleet.RateToHome(new[] { new RaFleet.Hop(forward, reverse, true) });
            var craftIsLinkB = RaFleet.RateToHome(new[] { new RaFleet.Hop(forward, reverse, false) });

            Assert.Equal(forward, craftIsLinkA);
            Assert.Equal(reverse, craftIsLinkB);

            var twoHops = RaFleet.RateToHome(new[] { new RaFleet.Hop(forward, reverse, true), new RaFleet.Hop(forward / 4.0, reverse, true) });
            Assert.Equal(forward / 4.0, twoHops);
        }

        [Fact]
        public void ARouteWithNoHopOrAnUnreadHopHasNoRateNotZero()
        {
            Assert.Null(RaFleet.RateToHome(new RaFleet.Hop[0]));
            Assert.Null(RaFleet.RateToHome(new[] { new RaFleet.Hop(31_500.0, 31_500.0, true), new RaFleet.Hop(null, 31_500.0, true) }));
        }

        [Fact]
        public void TheFleetRowSerializesToItsCamelCaseWireShapeThroughTheRealCodec()
        {
            var rows = new List<RealAntennasFleetRow>
            {
                new RealAntennasFleetRow
                {
                    VesselId = "0d2f7c1e",
                    BestBand = "X",
                    BitsPerSecToHome = null,
                    DishCount = 2,
                    Meta = new PayloadMeta { Source = "vessel:0d2f7c1e" },
                },
            };

            var el = WirePayload.Of(RaWire.Fleet(rows), "realantennas.fleet");

            Assert.Equal(JsonValueKind.Array, el.ValueKind);
            var row = el[0];
            Assert.Equal("0d2f7c1e", row.GetProperty("vesselId").GetString());
            Assert.Equal("X", row.GetProperty("bestBand").GetString());
            Assert.Equal(JsonValueKind.Null, row.GetProperty("bitsPerSecToHome").ValueKind);
            Assert.Equal(2, row.GetProperty("dishCount").GetInt32());
        }

        [Fact]
        public void TheFleetChannelIsDelayedLikeRetargeting()
        {
            var manifest = RealAntennasManifest.Build();

            var fleet = System.Linq.Enumerable.SingleOrDefault(manifest.Channels, c => c.Topic == RealAntennasManifest.FleetTopic);
            var retargeting = System.Linq.Enumerable.SingleOrDefault(manifest.Channels, c => c.Topic == RealAntennasManifest.RetargetingTopic);
            Assert.NotNull(fleet);
            Assert.Equal(retargeting!.Delay, fleet!.Delay);
            Assert.Equal(DelayRole.Delayed, fleet.Delay);
        }
    }
}
