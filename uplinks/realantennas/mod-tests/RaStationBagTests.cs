using System.Collections.Generic;
using Gonogo.RealAntennasUplink;
using Sitrep.Contract;
using Sitrep.Contract.TestSupport;
using Xunit;

namespace GonogoRealAntennasUplink.Tests
{
    /// <summary>The <c>"realantennas"</c> bag on a <c>comms.groundStations</c> entry.</summary>
    public class RaStationBagTests
    {
        [Fact]
        public void AStationsBagIsItsHighestTechLevelAndHowManyAntennasItCarries()
        {
            var bag = RaGroundStations.Bag(new int?[] { 3, 5, 4 });

            var ra = Assert.IsType<Dictionary<string, object?>>(bag!["realantennas"]);
            Assert.Equal(5, ra["techLevel"]);
            Assert.Equal(3, ra["antennaCount"]);
        }

        [Fact]
        public void AStationWithNoReadableLevelStillCountsItsAntennasAndOneWithNoneHasNoBag()
        {
            var bag = RaGroundStations.Bag(new int?[] { null, null });
            var ra = Assert.IsType<Dictionary<string, object?>>(bag!["realantennas"]);
            Assert.Null(ra["techLevel"]);
            Assert.Equal(2, ra["antennaCount"]);

            Assert.Null(RaGroundStations.Bag(new int?[0]));
        }

        [Fact]
        public void AStationBagRidesTheCoreStationShapeThroughTheRealCodec()
        {
            var el = WirePayload.Of(
                new CommsGroundStations
                {
                    Stations = new[]
                    {
                        new CommsGroundStation
                        {
                            Id = "Kerbal Space Center",
                            Name = "Kerbal Space Center",
                            BodyName = "Kerbin",
                            Latitude = -0.0972,
                            Longitude = -74.5577,
                            Extensions = RaGroundStations.Bag(new int?[] { 2, 4 }),
                        },
                    },
                },
                "comms.groundStations");

            var bag = el.GetProperty("stations")[0].GetProperty("extensions").GetProperty("realantennas");
            Assert.Equal(4, bag.GetProperty("techLevel").GetInt32());
            Assert.Equal(2, bag.GetProperty("antennaCount").GetInt32());
        }

        [Theory]
        [InlineData(0.0, 0.0)]
        [InlineData(180.0, 180.0)]
        [InlineData(-180.0, 180.0)]
        [InlineData(285.4423, -74.5577)]
        [InlineData(-285.4423, 74.5577)]
        public void ALongitudeIsWrappedToTheHalfOpenRangeEveryGeographicValueUses(double degrees, double expected)
        {
            Assert.Equal(expected, RaGroundStations.WrapLongitude(degrees), 4);
        }
    }
}
