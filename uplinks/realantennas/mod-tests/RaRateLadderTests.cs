using System;
using Gonogo.RealAntennasUplink;
using Xunit;

namespace Gonogo.RealAntennasUplink.Tests
{
    /// <summary>
    /// RealAntennas' rate ladder, as the Uplink works it out for a link at a
    /// believed distance. The pair here runs from 125 to 1000 symbols a second,
    /// up to three modulation bits, at a coding rate of a half: a best rate of
    /// 2000 bits a second, a least of 62.5, five halvings apart, so six rungs.
    /// </summary>
    public class RaRateLadderTests
    {
        private const double MaxSymbolRate = 1000.0;
        private const double MinSymbolRate = 125.0;
        private const int MaxBits = 3;
        private const double CodingRate = 0.5;

        /// <summary>The received power, over the noise and the encoder's need, that lets the link carry this many bits a second in theory.</summary>
        private static RaRateLadder.Rate At(double theoreticalBitsPerSecond) =>
            RaRateLadder.Select(10.0 * Math.Log10(theoreticalBitsPerSecond), 0.0, MaxSymbolRate, MinSymbolRate, MaxBits, CodingRate);

        [Fact]
        public void ALinkWithMarginForEveryModulationBitRunsAtTheTopOfTheLadder()
        {
            // Seven decibels over the top symbol rate buys two more bits at three decibels each.
            var rate = At(MaxSymbolRate * Math.Pow(10.0, 0.7));

            Assert.Equal(3, rate.ModulationBits);
            Assert.Equal(2000.0, rate.BitsPerSecond, 6);
            Assert.Equal(1.0, rate.Metric, 9);
        }

        [Fact]
        public void ALinkWithMarginForOneBitOnlyIsTwoRungsDown()
        {
            var rate = At(MaxSymbolRate * Math.Pow(10.0, 0.2));

            Assert.Equal(1, rate.ModulationBits);
            Assert.Equal(500.0, rate.BitsPerSecond, 6);
            Assert.Equal(1.0 - (2.0 / 6.0), rate.Metric, 9);
        }

        [Fact]
        public void ALinkTooWeakForTheTopSymbolRateHalvesItUntilItCloses()
        {
            // 300 bits a second in theory: the symbol rate halves twice, to 250.
            var rate = At(300.0);

            Assert.Equal(1, rate.ModulationBits);
            Assert.Equal(125.0, rate.BitsPerSecond, 6);
            Assert.Equal(1.0 - (4.0 / 6.0), rate.Metric, 9);
        }

        [Fact]
        public void ALinkTooWeakForTheSlowestSymbolRateDoesNotClose()
        {
            var rate = At(100.0);

            Assert.Equal(0.0, rate.BitsPerSecond);
            Assert.Equal(0.0, rate.Metric);
        }

        [Fact]
        public void TwoAntennasWithNoSymbolRateInCommonDoNotClose()
        {
            Assert.Equal(0.0, RaRateLadder.Select(90.0, 0.0, 100.0, 200.0, MaxBits, CodingRate).Metric);
        }

        /// <summary>Twelve rungs of thirteen, the strength a rig read on a real link one rung short of its best.</summary>
        [Fact]
        public void OneRungShortOfTheBestOnAThirteenRungLadderIsTwelveThirteenths()
        {
            // 2^12 between the best and the least rate: one bit, 4096 symbol rates apart.
            var rate = RaRateLadder.Select(10.0 * Math.Log10(2048.0 * 1.5), 0.0, 4096.0, 1.0, 1, 1.0);

            Assert.Equal(2048.0, rate.BitsPerSecond, 6);
            Assert.Equal(12.0 / 13.0, rate.Metric, 9);
        }
    }
}
