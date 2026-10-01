using System;
using System.Collections.Generic;
using GonogoPrincipiaUplink;
using Sitrep.Contract;
using Xunit;

namespace GonogoPrincipiaUplink.Tests
{
    /// <summary>
    /// The primary's oblateness in a craft's horizon bound: a low RSS Earth orbit,
    /// where J2 is the largest thing walking the craft off its conic, against the
    /// same orbit on a model with no J2, which is stock Principia.
    /// </summary>
    public class J2HorizonBoundTests
    {
        private const int Earth = 3;
        private const double EarthMu = 3.986004418e14;
        private const double EarthRadius = 6378137.0;
        private const double EarthJ2 = 1.08263e-3;
        private const double Ut = 1000.0;

        private static readonly Conic Iss = new Conic(
            EarthRadius + 400000.0, 0.0, 51.6, 0.0, 0.0, 0.0, Ut, EarthMu);

        [Fact]
        public void TheDriftRateMatchesTheHandWorkedSecularRatesForALowInclinedOrbit()
        {
            // a = 6778.137 km, e = 0, i = 51.6 deg: dw/dt + dM/dt correction is
            // 8.76e-7 rad/s along the track and the node moves 1.00e-6 rad/s, so the
            // craft is carried off its conic at about 7.9 m/s.
            var rate = PrincipiaHorizonBound.J2DriftRate(
                EarthJ2, EarthRadius, EarthMu, Iss.Sma, 0.0, 51.6 * Math.PI / 180.0);
            Assert.InRange(rate, 7.5, 8.3);
        }

        [Fact]
        public void ALowRssOrbitIsVouchedForSecondsNotRevolutions()
        {
            var provider = ProviderWith(new GravityModelBody("Earth", EarthMu, EarthRadius, EarthJ2));
            var rate = PrincipiaHorizonBound.J2DriftRate(
                EarthJ2, EarthRadius, EarthMu, Iss.Sma, 0.0, Iss.IncDegrees * Math.PI / 180.0);
            var expected = PrincipiaHorizonBound.ToleranceMetres / rate
                           / PrincipiaHorizonBound.SafetyFactor;
            var frame = PropagationFrame.CentredOn(Earth);

            // The bound before J2 was summed was the search window over the safety
            // factor, about four revolutions: 14,800 s for this craft.
            var oldBound = Iss.CycleSeconds * PrincipiaHorizonBound.SearchCycles
                           / PrincipiaHorizonBound.SafetyFactor;
            Assert.True(expected < oldBound / 100.0);

            Assert.True(provider.CanPropagate(Target(), frame, Ut, Ut + expected * 0.99));
            Assert.False(provider.CanPropagate(Target(), frame, Ut, Ut + expected * 1.05));
            Assert.False(provider.CanPropagate(Target(), frame, Ut, Ut + 600.0));
        }

        [Fact]
        public void WithNoGravityModelJ2TheBoundIsExactlyWhatItWas()
        {
            var provider = ProviderWith(new GravityModelBody("Earth", EarthMu));
            var frame = PropagationFrame.CentredOn(Earth);
            var window = Iss.CycleSeconds * PrincipiaHorizonBound.SearchCycles
                         / PrincipiaHorizonBound.SafetyFactor;

            Assert.True(provider.CanPropagate(Target(), frame, Ut, Ut + window - 1.0));
            Assert.False(provider.CanPropagate(Target(), frame, Ut, Ut + window + 1.0));

            // And the arithmetic, with nothing to sum: the span itself.
            var departure = new ConicDeparture(EarthMu, Ut, Iss.At);
            Assert.Equal(0.0, departure.J2DriftRate);
            Assert.Equal(window, PrincipiaHorizonBound.SpanSeconds(departure, Iss.CycleSeconds)!.Value, 6);
        }

        [Fact]
        public void AJ2WithNoReferenceRadiusIsLeftOutRatherThanGuessed()
        {
            var provider = ProviderWith(new GravityModelBody("Earth", EarthMu, null, EarthJ2));
            var window = Iss.CycleSeconds * PrincipiaHorizonBound.SearchCycles
                         / PrincipiaHorizonBound.SafetyFactor;
            Assert.True(provider.CanPropagate(
                Target(), PropagationFrame.CentredOn(Earth), Ut, Ut + window - 1.0));
        }

        private static PropagationTarget Target() =>
            PropagationTarget.Vessel(
                "iss",
                Earth,
                new OrbitElements(
                    Iss.Sma, Iss.Ecc, Iss.IncDegrees * Math.PI / 180.0, 0.0, 0.0, 0.0, Ut, EarthMu));

        private static PrincipiaPropagationProvider ProviderWith(GravityModelBody earth) =>
            new PrincipiaPropagationProvider(
                new EarthConics(),
                () => new GravityModel("rss-test", new[] { earth }),
                _ => new PrincipiaPerturber[0],
                _ => (int?)null,
                index => index == Earth ? "Earth" : null);

        private sealed class EarthConics : IPropagationProvider
        {
            public string ProviderId => "earth-conics";

            public StateVector Solve(PropagationTarget target, PropagationFrame frame, double ut) =>
                new StateVector(Iss.At(ut), new Sitrep.Contract.Vector3d(0, 0, 0));

            public void SolveMany(
                PropagationTarget target,
                PropagationFrame frame,
                IReadOnlyList<double> uts,
                StateVector[] into)
            {
                for (var i = 0; i < uts.Count; i++) into[i] = Solve(target, frame, uts[i]);
            }

            public double? CharacteristicCycleSeconds(PropagationTarget target) => Iss.CycleSeconds;

            public RadiusExtremes? RadiusExtremesOf(PropagationTarget target) => null;

            public bool CanPropagate(
                PropagationTarget target, PropagationFrame frame, double fromUt, double toUt) => true;

            public ClosestApproach? SolveClosestApproach(
                PropagationTarget subject,
                PropagationTarget other,
                PropagationFrame frame,
                double fromUt,
                double toUt) => null;
        }
    }
}
