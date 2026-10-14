using System;
using Gonogo.RealAntennasUplink;
using Xunit;

namespace Gonogo.RealAntennasUplink.Tests
{
    /// <summary>
    /// The re-derived RealAntennas link-budget math (comms-uplink-design.md
    /// §4.3). Pure: every figure comes from RA's public formulas/constants,
    /// reasoned not copied, and is checked against the closed-form values so a
    /// regression in the re-derivation is caught headlessly (RA itself never
    /// runs in these tests).
    /// </summary>
    public class RaLinkBudgetTests
    {
        [Fact]
        public void PathLoss_MatchesFreeSpaceFormula()
        {
            // 20*log10(d*f) + path_loss_constant.
            double d = 1.0e9, f = 1.0e9;
            double expected = 20.0 * Math.Log10(d * f) + RaLinkBudget.PathLossConstantDb;

            Assert.Equal(expected, RaLinkBudget.PathLossDb(d, f), 9);
        }

        [Fact]
        public void PathLoss_IncreasesWithDistanceAndFrequency()
        {
            double near = RaLinkBudget.PathLossDb(1.0e8, 1.0e9);
            double far = RaLinkBudget.PathLossDb(1.0e10, 1.0e9);
            double higherFreq = RaLinkBudget.PathLossDb(1.0e8, 1.0e10);

            Assert.True(far > near);
            Assert.True(higherFreq > near);
        }

        [Fact]
        public void PathLoss_NonPositiveInputs_AreTypedZero_NotNaN()
        {
            Assert.Equal(0.0, RaLinkBudget.PathLossDb(0, 1e9));
            Assert.Equal(0.0, RaLinkBudget.PathLossDb(1e9, 0));
        }

        [Fact]
        public void ReceivedPower_IsBudgetSumMinusPathLoss()
        {
            double txPower = 10, txGain = 20, rxGain = 30, d = 1.0e9, f = 1.0e9;
            double expected = txPower + txGain + rxGain - RaLinkBudget.PathLossDb(d, f);

            Assert.Equal(expected, RaLinkBudget.ReceivedPowerDbm(txPower, txGain, rxGain, d, f), 9);
        }

        [Fact]
        public void NoiseSpectralDensity_MatchesBoltzmannFormula()
        {
            double t = 290.0;
            double expected = RaLinkBudget.BoltzmannDbm + 10.0 * Math.Log10(t);

            Assert.Equal(expected, RaLinkBudget.NoiseSpectralDensityDbm(t), 9);
        }

        [Fact]
        public void NoiseSpectralDensity_ClampsBelowCmbFloor_NoNegativeInfinity()
        {
            double result = RaLinkBudget.NoiseSpectralDensityDbm(0.0);
            double atFloor = RaLinkBudget.NoiseSpectralDensityDbm(RaLinkBudget.CmbTemperatureKelvin);

            Assert.False(double.IsInfinity(result));
            Assert.Equal(atFloor, result, 9);
        }

        [Fact]
        public void LinkMargin_PositiveWhenReceivedPowerBeatsNoiseFloor()
        {
            // Strong received power, modest rate/noise ⇒ margin closes.
            double margin = RaLinkBudget.LinkMarginDb(
                receivedPowerDbm: -80.0, noiseTempKelvin: 200.0, symbolRateHz: 1.0e6, requiredEbN0Db: 2.5);

            Assert.True(margin > 0);
            Assert.True(RaLinkBudget.ClosesLink(margin));
        }

        [Fact]
        public void LinkMargin_NegativeWhenNoiseFloorBeatsReceivedPower()
        {
            double margin = RaLinkBudget.LinkMarginDb(
                receivedPowerDbm: -160.0, noiseTempKelvin: 200.0, symbolRateHz: 1.0e8, requiredEbN0Db: 2.5);

            Assert.True(margin < 0);
            Assert.False(RaLinkBudget.ClosesLink(margin));
        }

        [Fact]
        public void LinkMargin_HigherSymbolRateWorsensMargin()
        {
            double slow = RaLinkBudget.LinkMarginDb(-90, 200, 1.0e5, 2.5);
            double fast = RaLinkBudget.LinkMarginDb(-90, 200, 1.0e7, 2.5);

            Assert.True(slow > fast);
        }

        [Fact]
        public void MarginAtSlowestRate_IsPositiveForALinkThatStepsDownBelowItsTopRate()
        {
            // Too weak for the top symbol rate, strong enough for the slowest one.
            double top = RaLinkBudget.LinkMarginDb(-130.0, 200.0, 1.0e6, 2.5);
            double? slowest = RaLinkBudget.MarginAtSlowestRateDb(-130.0, 200.0, 1.0e6, 1.0e3, 1.0e6, 1.0e3, 2.5);

            Assert.True(top < 0);
            Assert.NotNull(slowest);
            Assert.True(slowest.Value > 0);
            Assert.Equal(RaLinkBudget.LinkMarginDb(-130.0, 200.0, 1.0e3, 2.5), slowest.Value, 9);
        }

        [Fact]
        public void MarginAtSlowestRate_UsesTheFasterOfTheTwoSlowestRates()
        {
            double? margin = RaLinkBudget.MarginAtSlowestRateDb(-100.0, 200.0, 1.0e6, 1.0e3, 1.0e6, 4.0e3, 2.5);

            Assert.Equal(RaLinkBudget.LinkMarginDb(-100.0, 200.0, 4.0e3, 2.5), margin!.Value, 9);
        }

        [Fact]
        public void MarginAtSlowestRate_IsAbsentWhenTheAntennasShareNoRate()
        {
            Assert.Null(RaLinkBudget.MarginAtSlowestRateDb(-100.0, 200.0, 1.0e3, 1.0e3, 1.0e6, 1.0e5, 2.5));
            Assert.Null(RaLinkBudget.MarginAtSlowestRateDb(-100.0, 200.0, null, null, 1.0e6, 1.0e5, 2.5));
        }

        [Fact]
        public void LinkMargin_NonPositiveSymbolRate_CannotClose()
        {
            double margin = RaLinkBudget.LinkMarginDb(-90, 200, 0, 2.5);

            Assert.True(double.IsNegativeInfinity(margin));
            Assert.False(RaLinkBudget.ClosesLink(margin));
        }

        [Theory]
        [InlineData(-100.0, 0.0)]  // far below window ⇒ clamps to 0
        [InlineData(0.0, 0.5)]     // link-close boundary ⇒ mid quality
        [InlineData(100.0, 1.0)]   // far above window ⇒ clamps to 1
        public void NormaliseQuality_MapsMarginOntoUnitInterval(double marginDb, double expected)
        {
            Assert.Equal(expected, RaLinkBudget.NormaliseQuality(marginDb), 6);
        }

        [Fact]
        public void NormaliseQuality_IsMonotonicInMargin()
        {
            Assert.True(RaLinkBudget.NormaliseQuality(-5) < RaLinkBudget.NormaliseQuality(5));
        }

        // Regression: with the vessel DISCONNECTED, comms.linkMargin must NOT
        // report closesLink:true with a stale positive margin. The uplink's
        // capture publishes the definitive link-down payloads instead of leaving
        // the LossyLatest channels holding the last-good geometric value. The
        // main-thread connectivity gate in CaptureOnMain reads FlightGlobals and
        // is not exercised headlessly (guarded defensively); these assert the
        // link-down payloads it emits are honest.
        [Fact]
        public void DownLinkMargin_DoesNotFalselyClose()
        {
            var margin = RaLinkDown.LinkMargin("vessel:test");

            Assert.False(margin.ClosesLink);
            Assert.False(margin.DecibelMargin > 0.0); // never a stale positive margin
        }

        [Fact]
        public void ConnectedLinkMargin_FloorsANegativeMarginAndStillCloses()
        {
            var margin = RaLinkBudget.ConnectedLinkMargin(-3.2, "vessel:test");

            Assert.True(margin.ClosesLink);
            Assert.Equal(0.0, margin.DecibelMargin);
            Assert.Equal(RaLinkBudget.NormaliseQuality(0.0), margin.Quality);
        }

        [Fact]
        public void ConnectedLinkMargin_KeepsAPositiveMargin()
        {
            var margin = RaLinkBudget.ConnectedLinkMargin(7.5, "vessel:test");

            Assert.True(margin.ClosesLink);
            Assert.Equal(7.5, margin.DecibelMargin);
        }

        [Fact]
        public void DownLinkQuality_IsZero()
        {
            Assert.Equal(0.0, RaLinkDown.LinkMargin("vessel:test").Quality);
        }

        [Fact]
        public void DownDataRate_IsHonestZeroThroughput()
        {
            var rate = RaLinkDown.DataRate("vessel:test");

            Assert.Equal(0.0, rate.UpBitsPerSec);
            Assert.Equal(0.0, rate.DownBitsPerSec);
        }
    }
}
