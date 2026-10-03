using System;
using System.Collections.Generic;
using Sitrep.Contract;

namespace GonogoPrincipiaUplink
{
    /// <summary>
    /// The producer's own orbit analyses, kept per craft, and the secular seed each
    /// one gives: the analysis's mean shape and rates, with the craft's own
    /// orientation and phase carried forward at those rates.
    ///
    /// <para>Fed from the analysis capture and asked from the main thread, so every
    /// read and write takes the one lock. KSP-free, so the seed is provable with no
    /// game running.</para>
    /// </summary>
    public sealed class PrincipiaSecularSeeds
    {
        /// <summary>The widest relative spread of the mean semi-major axis band an analysis may show and still be called secular.</summary>
        public const double NarrowSmaFraction = 1e-3;

        /// <summary>The widest spread of the mean eccentricity band an analysis may show and still be called secular.</summary>
        public const double NarrowEccWidth = 1e-3;

        /// <summary>
        /// How far the craft's osculating semi-major axis may sit from the analysed
        /// mean, as a fraction of it, before the analysis is taken to describe an
        /// orbit the craft has left. Wider than the short-period swing of a low orbit
        /// and far narrower than any deliberate burn.
        /// </summary>
        public const double DriftSmaFraction = 1e-2;

        /// <summary>The same for eccentricity, as an absolute difference.</summary>
        public const double DriftEccWidth = 1e-2;

        /// <summary>The same for inclination, in radians, so a plane change after the analysis is not carried on the old plane.</summary>
        public const double DriftIncRadians = 1e-2;

        private readonly object _gate = new object();
        private readonly Dictionary<string, AnalysisObservation> _byVessel =
            new Dictionary<string, AnalysisObservation>(StringComparer.Ordinal);

        /// <summary>Keeps the newest analysis for its craft. One with no orbit analysis says nothing and replaces nothing.</summary>
        public void Observe(AnalysisObservation observation)
        {
            if (observation?.VesselId == null || observation.Orbit == null)
            {
                return;
            }
            lock (_gate)
            {
                _byVessel[observation.VesselId] = observation;
            }
        }

        /// <summary>
        /// Seed A for <paramref name="target"/> at <paramref name="ut"/>, or null when
        /// no analysis is held for it, the analysis is not secular, its span is over,
        /// or the craft has left the orbit it describes.
        /// </summary>
        public SecularOrbit? SeedFor(PropagationTarget target, OrbitElements osculating, double ut)
        {
            AnalysisObservation? observation;
            lock (_gate)
            {
                if (target.Id == null || !_byVessel.TryGetValue(VesselKey(target.Id), out observation))
                {
                    return null;
                }
            }
            return SeedFrom(observation, target.ParentBodyIndex, osculating, ut);
        }

        /// <summary>The analysis store keys on the bare guid the producer uses; a plan names craft as <c>"vessel:&lt;guid&gt;"</c>.</summary>
        private static string VesselKey(string id) =>
            id.StartsWith("vessel:", StringComparison.Ordinal) ? id.Substring("vessel:".Length) : id;

        /// <summary>
        /// The seed one analysis gives, from its bands and periods and from the
        /// craft's own osculating orientation and phase. With mean anomaly M, mean
        /// argument of latitude u = ω + M and mean longitude λ = Ω + u, the
        /// anomalistic, nodal and sidereal periods give Ṁ, u̇ and λ̇, so
        /// ω̇ = u̇ − Ṁ and Ω̇ = λ̇ − u̇.
        /// </summary>
        public static SecularOrbit? SeedFrom(AnalysisObservation observation, int parentBodyIndex, OrbitElements osculating, double ut)
        {
            var orbit = observation.Orbit;
            if (orbit == null || orbit.GravitationallyBound != true || orbit.PrimaryIndex != parentBodyIndex)
            {
                return null;
            }

            var sma = Mid(orbit.MeanSemimajorAxisMetres);
            var ecc = Mid(orbit.MeanEccentricity);
            var incDeg = Mid(orbit.MeanInclinationDegrees);
            if (sma == null || ecc == null || incDeg == null || !(sma > 0.0) || !(ecc >= 0.0) || !(ecc < 1.0))
            {
                return null;
            }
            if (Width(orbit.MeanSemimajorAxisMetres) > NarrowSmaFraction * sma.Value
                || Width(orbit.MeanEccentricity) > NarrowEccWidth)
            {
                return null;
            }
            var inc = incDeg.Value * Math.PI / 180.0;
            if (Math.Abs(osculating.Sma - sma.Value) > DriftSmaFraction * sma.Value
                || Math.Abs(osculating.Ecc - ecc.Value) > DriftEccWidth
                || Math.Abs(osculating.Inc - inc) > DriftIncRadians)
            {
                return null;
            }

            var anomalistic = Rate(orbit.AnomalisticPeriodSeconds);
            var nodal = Rate(orbit.NodalPeriodSeconds);
            var sidereal = Rate(orbit.SiderealPeriodSeconds);
            if (anomalistic == null || nodal == null || sidereal == null)
            {
                return null;
            }

            if (orbit.MissionDurationSeconds == null || !(orbit.MissionDurationSeconds > 0.0))
            {
                return null;
            }
            var validUntil = (orbit.ElementsEpochUt ?? observation.SampledAtUt) + orbit.MissionDurationSeconds.Value;
            if (!(validUntil > ut))
            {
                return null;
            }

            var anchor = new OrbitElements(
                sma.Value,
                ecc.Value,
                inc,
                osculating.Lan,
                osculating.ArgPe,
                MeanAnomalyAt(osculating, ut),
                ut,
                osculating.Mu);
            // The published precession is the node's rate measured directly; the
            // difference of two periods carries the same rate as a small remainder
            // of two large ones, so it is the fallback.
            var nodeRate = orbit.NodalPrecessionDegreesPerHour is double perHour && !double.IsNaN(perHour) && !double.IsInfinity(perHour)
                ? perHour * Math.PI / 180.0 / 3600.0
                : sidereal.Value - nodal.Value;
            return new SecularOrbit(
                anchor,
                nodeRate,
                nodal.Value - anomalistic.Value,
                anomalistic.Value,
                validUntil,
                SecularBasis.Analysis);
        }

        /// <summary>The osculating mean anomaly carried from the elements' own epoch to <paramref name="ut"/> on two-body mean motion.</summary>
        public static double MeanAnomalyAt(OrbitElements elements, double ut) =>
            elements.MeanAnomalyAtEpoch + (Math.Sqrt(elements.Mu / (elements.Sma * elements.Sma * elements.Sma)) * (ut - elements.Epoch));

        private static double? Mid(IntervalObservation? band) =>
            band?.Min != null && band.Max != null ? (band.Min.Value + band.Max.Value) / 2.0 : (double?)null;

        private static double Width(IntervalObservation? band) =>
            band?.Min != null && band.Max != null ? Math.Abs(band.Max.Value - band.Min.Value) : double.PositiveInfinity;

        private static double? Rate(double? periodSeconds) =>
            periodSeconds != null && periodSeconds.Value > 0.0 && !double.IsInfinity(periodSeconds.Value)
                ? 2.0 * Math.PI / periodSeconds.Value
                : (double?)null;
    }
}
