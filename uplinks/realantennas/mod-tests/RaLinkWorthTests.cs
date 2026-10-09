using System;
using System.Collections.Generic;
using Gonogo.RealAntennasUplink;
using Sitrep.Contract;
using Xunit;

namespace Gonogo.RealAntennasUplink.Tests
{
    /// <summary>
    /// What a RealAntennas link is worth at a believed distance: the lesser of
    /// the two directions, each from the pairing that carries the most data.
    /// </summary>
    public class RaLinkWorthTests
    {
        private static RaPlannedAntenna Antenna(double txPowerDbm = 40.0, string band = "S", int encoderLevel = 5, double codingRate = 0.5) => new RaPlannedAntenna
        {
            Band = band,
            TxPowerDbm = txPowerDbm,
            GainDbi = 10.0,
            FrequencyHz = 2.25e9,
            SymbolRateHz = 1000.0,
            MinSymbolRateHz = 125.0,
            ModulationBits = 3,
            NoiseTemperatureKelvin = 200.0,
            TechLevel = encoderLevel,
            EncoderName = "Test",
            EncoderTechLevel = encoderLevel,
            CodingRate = codingRate,
            EncoderRequiredEbN0Db = 2.5,
            BeamwidthRadians = 0.1,
            PowerDrawEc = 12.0,
        };

        private static IReadOnlyList<RaPlannedAntenna> One(RaPlannedAntenna antenna) => new[] { antenna };

        [Fact]
        public void TwoAntennasCloseTogetherRunAtTheTopOfTheLadder()
        {
            Assert.Equal(1.0, RaLinkWorth.At(One(Antenna()), One(Antenna()), 1_000.0).Strength, 9);
        }

        [Fact]
        public void TheLinkWeakensRungByRungWithDistanceAndThenDoesNotClose()
        {
            var a = One(Antenna());
            var b = One(Antenna());
            var last = 1.0;
            var separation = 1_000.0;
            var steppedDown = false;
            while (separation < 1e15)
            {
                var strength = RaLinkWorth.At(a, b, separation).Strength;
                Assert.True(strength <= last + 1e-12, "a link grew stronger with distance");
                steppedDown |= strength > 0.0 && strength < 1.0;
                last = strength;
                separation *= 2.0;
            }
            Assert.True(steppedDown, "the link went from full strength to none without a rung between");
            Assert.Equal(0.0, last);
        }

        [Fact]
        public void TheLinkIsWorthItsWeakerDirection()
        {
            var strong = Antenna(txPowerDbm: 60.0);
            var weak = Antenna(txPowerDbm: 20.0);
            var separation = 1_000.0;
            // Out to where the weak transmitter has stepped down and the strong one has not.
            while (RaLinkWorth.At(One(weak), One(strong), separation).Forward.Metric >= 1.0)
            {
                separation *= 2.0;
            }

            var worth = RaLinkWorth.At(One(strong), One(weak), separation);

            Assert.Equal(1.0, worth.Forward.Metric, 9);
            Assert.True(worth.Reverse.Metric < 1.0);
            Assert.Equal(worth.Reverse.Metric, worth.Strength, 9);
        }

        [Fact]
        public void AntennasInDifferentBandsDoNotTalk()
        {
            var worth = RaLinkWorth.At(One(Antenna(band: "S")), One(Antenna(band: "X")), 1_000.0);

            Assert.Equal(0.0, worth.Strength);
            Assert.Null(RaLinkWorth.Extensions(worth));
        }

        [Fact]
        public void EachDirectionTakesThePairingThatCarriesTheMostData()
        {
            var feeble = Antenna(txPowerDbm: -40.0);
            var separation = 1_000.0;
            // Out to where the feeble transmitter no longer runs at the top rate.
            while (RaLinkWorth.At(One(feeble), One(Antenna()), separation).Forward.Metric >= 1.0)
            {
                separation *= 2.0;
            }

            var worth = RaLinkWorth.At(new[] { feeble, Antenna(txPowerDbm: 40.0) }, One(Antenna()), separation);

            Assert.Equal(40.0, worth.ForwardTx!.TxPowerDbm);
        }

        [Fact]
        public void TwoAntennasTalkThroughTheLowerLevelEncoder()
        {
            var modern = Antenna(encoderLevel: 9, codingRate: 0.5);
            var old = Antenna(encoderLevel: 2, codingRate: 1.0);

            // The old encoder's coding rate of one doubles the data rate of the same symbols.
            Assert.Equal(4000.0, RaLinkWorth.At(One(modern), One(old), 1_000.0).Forward.BitsPerSecond, 6);
            Assert.Equal(2000.0, RaLinkWorth.At(One(modern), One(modern), 1_000.0).Forward.BitsPerSecond, 6);
        }

        [Fact]
        public void TheStrengthModelKeepsTheLinkStrengthContract()
        {
            var link = new RaLinkStrength(One(Antenna()), One(Antenna()));

            Sitrep.Contract.TestSupport.PathStrengthConformance.AssertLinkStrengthContract(link, 0.0, 1e13);
            Assert.Equal(1.0, link.FactsAt(0.0, 1_000.0).HopStrength, 9);
            Assert.Equal(SignalQuantity.DataRateHeadroom, link.FactsAt(0.0, 1_000.0).Quantity);
            Assert.NotNull(link.FactsAt(0.0, 1_000.0).Extensions);
        }

        [Fact]
        public void APathCarriesTheStrengthOfItsWeakestLink()
        {
            Assert.Equal(0.25, RaLinkStrength.Weakest(new[] { 0.9, 0.25, 0.5 }), 9);
            Assert.Equal(0.0, RaLinkStrength.Weakest(new double[0]));
        }

        [Fact]
        public void TheHopsFactsCarryTheSameKeysTheMeasuredBagHas()
        {
            var bag = RaLinkWorth.Extensions(RaLinkWorth.At(One(Antenna()), One(Antenna()), 1_000.0));

            var facts = Assert.IsType<Dictionary<string, object?>>(bag![RaLinkWorth.ProviderId]);
            Assert.Equal(
                new[] { "band", "beamwidth", "codingRate", "encoder", "modulationBits", "powerDrawEc", "requiredEbN0", "reverseBitsPerSec", "techLevel" },
                new SortedSet<string>(facts.Keys, StringComparer.Ordinal));
            Assert.Equal("S", facts["band"]);
            Assert.Equal(2000.0, (double)facts["reverseBitsPerSec"]!, 6);
        }
    }
}
