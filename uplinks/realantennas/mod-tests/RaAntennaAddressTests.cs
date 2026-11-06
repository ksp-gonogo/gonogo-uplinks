using System.Text.Json;
using Gonogo.RealAntennasUplink;
using Sitrep.Contract;
using Sitrep.Contract.TestSupport;
using Xunit;

namespace GonogoRealAntennasUplink.Tests
{
    /// <summary>The antenna address the hop bag and <c>realantennas.antennas</c> share, and the new fields of the antenna channel.</summary>
    public class RaAntennaAddressTests
    {
        [Fact]
        public void SeveralAntennasOnOnePartAreSeparatedByAnOrdinal()
        {
            var ids = RaAntennaIds.ForList(new string?[] { "4021", "4021", "77" });

            Assert.Equal(new[] { "4021/0", "4021/1", "77/0" }, ids);
        }

        [Fact]
        public void AnAntennaWhoseCraftIsUnloadedFallsBackToItsPositionInTheListButHasNoAddressElsewhere()
        {
            var flightIds = new string?[] { "4021", null };

            Assert.Equal(new[] { "4021/0", "index/1" }, RaAntennaIds.ForList(flightIds));
            Assert.Equal("4021/0", RaAntennaIds.Of(flightIds, 0));
            Assert.Null(RaAntennaIds.Of(flightIds, 1));
            Assert.Null(RaAntennaIds.Of(flightIds, 5));
            Assert.Null(RaAntennaIds.Of(flightIds, -1));
        }

        [Fact]
        public void TheAntennaChannelCarriesBandPowerDrawAndConditionBesideTheTechLevel()
        {
            var el = WirePayload.Of(
                RaWire.Antennas(new[]
                {
                    new RealAntennasAntennaState
                    {
                        AntennaId = "4021/0",
                        Name = "HG-55",
                        TechLevel = 9,
                        Band = "L",
                        TxPowerDbm = 30.0,
                        PowerDrawEc = 0.5,
                        Condition = "Enabled",
                        Meta = new PayloadMeta { Source = "vessel:1" },
                    },
                    new RealAntennasAntennaState { AntennaId = "4021/1", Meta = new PayloadMeta { Source = "vessel:1" } },
                }),
                "realantennas.antennas");

            var dish = el[0];
            Assert.Equal("L", dish.GetProperty("band").GetString());
            Assert.Equal(30.0, dish.GetProperty("txPowerDbm").GetDouble());
            Assert.Equal(0.5, dish.GetProperty("powerDrawEc").GetDouble());
            Assert.Equal("Enabled", dish.GetProperty("condition").GetString());
            var unread = el[1];
            Assert.Equal(JsonValueKind.Null, unread.GetProperty("band").ValueKind);
            Assert.Equal(JsonValueKind.Null, unread.GetProperty("txPowerDbm").ValueKind);
            Assert.Equal(JsonValueKind.Null, unread.GetProperty("condition").ValueKind);
        }
    }
}
