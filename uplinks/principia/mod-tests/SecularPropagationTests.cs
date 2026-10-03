using System;
using System.Collections.Generic;
using GonogoPrincipiaUplink;
using Sitrep.Contract;
using Sitrep.Contract.TestSupport;
using Xunit;

namespace GonogoPrincipiaUplink.Tests
{
    /// <summary>
    /// The secular seeds the provider hands the contact plan: the producer's own
    /// analysis where it holds one that still describes the craft, and the J2
    /// estimate otherwise.
    /// </summary>
    public class SecularPropagationTests
    {
        private const int Earth = 3;
        private const double EarthMu = 3.986004418e14;
        private const double EarthRadius = 6378137.0;
        private const double EarthJ2 = 1.08263e-3;
        private const double Ut = 1000.0;
        private const double IssSma = EarthRadius + 400000.0;
        private const double IssInc = 51.6 * Math.PI / 180.0;

        private static PropagationTarget Iss(double sma = IssSma, double ecc = 0.001) =>
            PropagationTarget.Vessel(
                "vessel:0b7c4a52-5f6d-4c1e-9a0e-2f0d9c8b7a61",
                Earth,
                new OrbitElements(sma, ecc, IssInc, 1.0, 2.0, 0.5, Ut - 100.0, EarthMu));

        [Fact]
        public void TheThreeRatesAreTheHandWorkedSecularRatesAndComposeTheDriftSpeed()
        {
            var rates = PrincipiaHorizonBound.J2SecularRates(EarthJ2, EarthRadius, EarthMu, IssSma, 0.0, IssInc)!.Value;

            // a = 6778.137 km, e = 0, i = 51.6 deg: the node regresses at about 1.00e-6
            // rad/s and the along-track rates sum to about 8.76e-7 rad/s.
            Assert.InRange(rates.Node, -1.05e-6, -0.95e-6);
            Assert.InRange(rates.Periapsis + rates.MeanAnomaly, 8.5e-7, 9.0e-7);
            var along = rates.Periapsis + rates.MeanAnomaly;
            var across = Math.Sin(IssInc) * rates.Node;
            Assert.Equal(
                IssSma * Math.Sqrt((along * along) + (across * across)),
                PrincipiaHorizonBound.J2DriftRate(EarthJ2, EarthRadius, EarthMu, IssSma, 0.0, IssInc),
                9);
        }

        [Fact]
        public void AModelWithNoJ2HasNoRatesToApply()
        {
            Assert.Null(PrincipiaHorizonBound.J2SecularRates(0.0, EarthRadius, EarthMu, IssSma, 0.0, IssInc));
            Assert.Null(PrincipiaHorizonBound.J2SecularRates(EarthJ2, 0.0, EarthMu, IssSma, 0.0, IssInc));
        }

        [Fact]
        public void WithNoAnalysisACraftGetsTheJ2EstimateAndItConforms()
        {
            var provider = ProviderWith(new GravityModelBody("Earth", EarthMu, EarthRadius, EarthJ2));

            SecularPropagationConformance.AssertSecularPropagationContract(provider, Iss(), Ut);
            var seed = provider.SecularOrbitFor(Iss(), Ut)!.Value;

            Assert.Equal(SecularBasis.J2Estimate, seed.Basis);
            Assert.Equal(Ut, seed.Anchor.Epoch);
            var rates = PrincipiaHorizonBound.J2SecularRates(EarthJ2, EarthRadius, EarthMu, IssSma, 0.001, IssInc)!.Value;
            Assert.Equal(rates.Node, seed.NodeRate, 15);
            Assert.Equal(Math.Sqrt(EarthMu / Math.Pow(IssSma, 3)) + rates.MeanAnomaly, seed.MeanAnomalyRate, 15);
        }

        [Fact]
        public void TheJ2EstimateIsBoundedWithoutTheDriftItCarries()
        {
            var provider = ProviderWith(new GravityModelBody("Earth", EarthMu, EarthRadius, EarthJ2));
            var frame = PropagationFrame.CentredOn(Earth);

            var seed = provider.SecularOrbitFor(Iss(), Ut)!.Value;

            // The conic's own horizon is seconds, because J2 walks it off; the seed
            // carries J2, so its span is the one with that term left out.
            Assert.False(provider.CanPropagate(Iss(), frame, Ut, Ut + 600.0));
            Assert.True(seed.ValidUntilUt > Ut + 600.0);
        }

        [Fact]
        public void OnAModelWithNoJ2TheEstimateIsExactlyTheConic()
        {
            var provider = ProviderWith(new GravityModelBody("Earth", EarthMu));

            var seed = provider.SecularOrbitFor(Iss(), Ut)!.Value;

            Assert.Equal(0.0, seed.NodeRate);
            Assert.Equal(0.0, seed.PeriapsisRate);
            Assert.Equal(Math.Sqrt(EarthMu / Math.Pow(IssSma, 3)), seed.MeanAnomalyRate, 15);
        }

        [Fact]
        public void WithNoForceModelThereIsNoSeed()
        {
            var provider = new PrincipiaPropagationProvider(
                new FixedConics(), () => null, _ => new PrincipiaPerturber[0], _ => (int?)null, _ => "Earth");

            Assert.Null(provider.SecularOrbitFor(Iss(), Ut));
        }

        [Fact]
        public void ANarrowAnalysisOfTheCraftsOwnOrbitGivesItsRatesFromThePeriods()
        {
            var seeds = new PrincipiaSecularSeeds();
            seeds.Observe(Analysis());
            var provider = ProviderWith(new GravityModelBody("Earth", EarthMu, EarthRadius, EarthJ2), seeds);

            SecularPropagationConformance.AssertSecularPropagationContract(provider, Iss(), Ut);
            var seed = provider.SecularOrbitFor(Iss(), Ut)!.Value;

            Assert.Equal(SecularBasis.Analysis, seed.Basis);
            var m = 2 * Math.PI / 5545.0;
            var u = 2 * Math.PI / 5550.0;
            var l = 2 * Math.PI / 5560.0;
            Assert.Equal(m, seed.MeanAnomalyRate, 15);
            Assert.Equal(u - m, seed.PeriapsisRate, 15);
            Assert.Equal(l - u, seed.NodeRate, 15);
            Assert.Equal(IssSma, seed.Anchor.Sma, 6);
            Assert.Equal(1.0, seed.Anchor.Lan, 12);
            Assert.Equal(500.0 + 86_400.0, seed.ValidUntilUt);
        }

        [Fact]
        public void AnAnalysisThatNoLongerDescribesTheCraftFallsBackToTheEstimate()
        {
            var cases = new[]
            {
                (Analysis(smaSpread: 50_000.0), Iss()),
                (Analysis(), Iss(sma: IssSma * 1.05)),
                (Analysis(primary: 4), Iss()),
                (Analysis(span: 100.0), Iss()),
                (Analysis(inclinationDeg: 45.0), Iss()),
            };
            foreach (var (analysis, craft) in cases)
            {
                var seeds = new PrincipiaSecularSeeds();
                seeds.Observe(analysis);
                var provider = ProviderWith(new GravityModelBody("Earth", EarthMu, EarthRadius, EarthJ2), seeds);

                Assert.Equal(SecularBasis.J2Estimate, provider.SecularOrbitFor(craft, Ut)!.Value.Basis);
            }
        }

        [Fact]
        public void ABodyAndAnEscapingCraftAreRefused()
        {
            var provider = ProviderWith(new GravityModelBody("Earth", EarthMu, EarthRadius, EarthJ2));

            Assert.Null(provider.SecularOrbitFor(PropagationTarget.Body(Earth), Ut));
            Assert.Null(provider.SecularOrbitFor(
                PropagationTarget.Vessel("vessel:away", Earth, new OrbitElements(-1e7, 1.2, 0.0, 0.0, 0.0, 0.0, Ut, EarthMu)), Ut));
        }

        [Fact]
        public void ThePublishedPrecessionIsTheNodesRateWhenThereIsOne()
        {
            var analysis = Analysis();
            analysis.Orbit!.NodalPrecessionDegreesPerHour = -0.2;
            var seeds = new PrincipiaSecularSeeds();
            seeds.Observe(analysis);
            var provider = ProviderWith(new GravityModelBody("Earth", EarthMu, EarthRadius, EarthJ2), seeds);

            var seed = provider.SecularOrbitFor(Iss(), Ut)!.Value;

            Assert.Equal(-0.2 * Math.PI / 180.0 / 3600.0, seed.NodeRate, 15);
        }

        [Fact]
        public void APrimaryTheModelDoesNotNameGetsNoSeedRatherThanAZeroDrift()
        {
            var provider = ProviderWith(new GravityModelBody("Kerbin", EarthMu, EarthRadius, EarthJ2));

            Assert.Null(provider.SecularOrbitFor(Iss(), Ut));
        }

        private static AnalysisObservation Analysis(
            double smaSpread = 100.0, int primary = Earth, double span = 86_400.0, double inclinationDeg = 51.6) =>
            new AnalysisObservation
            {
                VesselId = "0b7c4a52-5f6d-4c1e-9a0e-2f0d9c8b7a61",
                SampledAtUt = 500.0,
                Orbit = new OrbitAnalysisObservation
                {
                    GravitationallyBound = true,
                    PrimaryIndex = primary,
                    MissionDurationSeconds = span,
                    AnomalisticPeriodSeconds = 5545.0,
                    NodalPeriodSeconds = 5550.0,
                    SiderealPeriodSeconds = 5560.0,
                    MeanSemimajorAxisMetres = new IntervalObservation { Min = IssSma - (smaSpread / 2.0), Max = IssSma + (smaSpread / 2.0) },
                    MeanEccentricity = new IntervalObservation { Min = 0.0009, Max = 0.0011 },
                    MeanInclinationDegrees = new IntervalObservation { Min = inclinationDeg - 0.01, Max = inclinationDeg + 0.01 },
                },
            };

        private static PrincipiaPropagationProvider ProviderWith(GravityModelBody earth, PrincipiaSecularSeeds? seeds = null) =>
            new PrincipiaPropagationProvider(
                new FixedConics(),
                () => new GravityModel("rss-test", new[] { earth }),
                _ => new PrincipiaPerturber[0],
                _ => (int?)null,
                index => index == Earth ? "Earth" : null,
                seeds);

        /// <summary>A circular low Earth orbit, whatever the target, which is all the bound reads.</summary>
        private sealed class FixedConics : IPropagationProvider
        {
            private static readonly double Period = 2 * Math.PI * Math.Sqrt(Math.Pow(IssSma, 3) / EarthMu);

            public string ProviderId => "fixed-conics";

            public StateVector Solve(PropagationTarget target, PropagationFrame frame, double ut)
            {
                var angle = 2 * Math.PI * ut / Period;
                return new StateVector(
                    new Vector3d(IssSma * Math.Cos(angle), IssSma * Math.Sin(angle), 0.0),
                    new Vector3d(0, 0, 0));
            }

            public void SolveMany(PropagationTarget target, PropagationFrame frame, IReadOnlyList<double> uts, StateVector[] into)
            {
                for (var i = 0; i < uts.Count; i++) into[i] = Solve(target, frame, uts[i]);
            }

            public double? CharacteristicCycleSeconds(PropagationTarget target) => Period;

            public RadiusExtremes? RadiusExtremesOf(PropagationTarget target) => null;

            public bool CanPropagate(PropagationTarget target, PropagationFrame frame, double fromUt, double toUt) =>
                target.Kind != PropagationTargetKind.Vessel
                || (target.Osculating != null && target.Osculating.Value.Ecc < 1.0 && target.Osculating.Value.Sma > 0.0);

            public ClosestApproach? SolveClosestApproach(
                PropagationTarget subject, PropagationTarget other, PropagationFrame frame, double fromUt, double toUt) => null;
        }
    }
}
