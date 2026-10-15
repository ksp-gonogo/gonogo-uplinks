using System;
using Sitrep.Contract;

namespace Gonogo.RealAntennasUplink
{
    /// <summary>A body that can fill an antenna's beam with warm sky: where it is is read from the plan's positions by index.</summary>
    public sealed class RaOccluder
    {
        public int BodyIndex;
        public double RadiusMeters;

        /// <summary>The body's base temperature as RealAntennas reads it, before a star's frequency scaling.</summary>
        public double TemperatureKelvin;

        public bool IsStar;
    }

    /// <summary>
    /// The noise a receiving antenna picks up beyond its own electronics and the
    /// cosmic background: the warm disc of every body inside its beam, and the
    /// atmosphere above a station on a surface. These are RealAntennas'
    /// <c>Physics.BodyNoiseTemp</c>, <c>StarRadioTemp</c> and
    /// <c>AtmosphereNoiseTemperature</c>, in double precision.
    ///
    /// <para>Pure and KSP-free.</para>
    /// </summary>
    public static class RaSkyNoise
    {
        /// <summary>The antennas at or below this gain see no body: RealAntennas treats them as omnis.</summary>
        public const double OmniGainDbi = 5.0;

        /// <summary>A star's radio temperature at a frequency, from its surface temperature.</summary>
        public static double StarRadioTempKelvin(double surfaceTempKelvin, double frequencyHz) =>
            surfaceTempKelvin * Math.Pow(2.998e11 / frequencyHz, 0.24517);

        /// <summary>
        /// The atmosphere's noise over a station, in kelvin, at an elevation in
        /// degrees: the mean effective temperature of the air (267.5 K) over the
        /// fraction it absorbs along the slant path.
        /// </summary>
        public static double AtmosphereNoiseTempKelvin(double elevationDegrees, double frequencyHz)
        {
            var zenith = frequencyHz < 3e9 ? 0.035 : frequencyHz < 10e9 ? 0.5 : frequencyHz < 27e9 ? 0.2525 : 0.2285;
            var attenuationDb = zenith * (1.0 / Math.Sin(Math.Abs(elevationDegrees) * Math.PI / 180.0));
            var linear = Math.Pow(10.0, attenuationDb / 10.0);
            return 267.5 * (1.0 - 1.0 / linear);
        }

        /// <summary>The angle between two directions in degrees, as RealAntennas measures it.</summary>
        public static double AngleDegrees(Sitrep.Contract.Vector3d a, Sitrep.Contract.Vector3d b)
        {
            var la = a.Magnitude();
            var lb = b.Magnitude();
            var left = new Sitrep.Contract.Vector3d(a.X * lb, a.Y * lb, a.Z * lb);
            var right = new Sitrep.Contract.Vector3d(b.X * la, b.Y * la, b.Z * la);
            var diff = (left - right).Magnitude();
            var sum = (left + right).Magnitude();
            return 2.0 * Math.Atan2(diff, sum) * 180.0 / Math.PI;
        }

        /// <summary>
        /// One body's contribution to an antenna's noise temperature, in kelvin: the
        /// body's temperature over the share of the beam its disc fills, weighted by
        /// how far off the beam's axis it sits.
        /// </summary>
        /// <param name="antennaPosition">Where the antenna is.</param>
        /// <param name="gainDbi">The antenna's gain.</param>
        /// <param name="direction">Where the antenna points, from itself.</param>
        /// <param name="bodyPosition">The body's centre.</param>
        /// <param name="bodyRadiusMeters">The body's radius.</param>
        /// <param name="bodyTempKelvin">The body's temperature at the antenna's frequency.</param>
        /// <param name="beamwidthDegrees">The antenna's beamwidth.</param>
        public static double BodyNoiseTempKelvin(
            Sitrep.Contract.Vector3d antennaPosition,
            double gainDbi,
            Sitrep.Contract.Vector3d direction,
            Sitrep.Contract.Vector3d bodyPosition,
            double bodyRadiusMeters,
            double bodyTempKelvin,
            double beamwidthDegrees)
        {
            if (gainDbi <= OmniGainDbi || bodyTempKelvin < 1e-30)
            {
                return 0.0;
            }
            var toBody = bodyPosition - antennaPosition;
            var offAxis = AngleDegrees(toBody, direction);
            var distance = toBody.Magnitude();
            var bodyRadius = distance > 10.0 * bodyRadiusMeters
                ? Math.Atan2(bodyRadiusMeters, distance)
                : AngularRadiusRadians(bodyRadiusMeters, distance);
            var bodyRadiusDeg = bodyRadius * 180.0 / Math.PI;
            if (beamwidthDegrees < offAxis - bodyRadiusDeg)
            {
                return 0.0;
            }
            var d = offAxis * Math.PI / 180.0;
            var beam = beamwidthDegrees * Math.PI / 180.0;
            double overlap;
            double lossDb;
            if (beamwidthDegrees < bodyRadiusDeg - offAxis)
            {
                overlap = Math.PI * beam * beam;
                lossDb = 0.0;
            }
            else if (beamwidthDegrees > bodyRadiusDeg + offAxis)
            {
                overlap = Math.PI * bodyRadius * bodyRadius;
                lossDb = -RaLinkBudget.PointingLossDb(offAxis, beamwidthDegrees);
            }
            else
            {
                overlap = CircleOverlapArea(beam, bodyRadius, d);
                var centre = (d * d - bodyRadius * bodyRadius + beam * beam) / (2.0 * d);
                lossDb = -RaLinkBudget.PointingLossDb(((centre + beam) * 180.0 / Math.PI) / 2.0, beamwidthDegrees);
            }
            var share = overlap / (Math.PI * beam * beam);
            return bodyTempKelvin * share * Math.Pow(10.0, lossDb / 10.0);
        }

        private static double CircleOverlapArea(double bigR, double smallR, double d)
        {
            var part = (smallR * smallR * Math.Acos(Clamp((d * d + smallR * smallR - bigR * bigR) / (2.0 * d * smallR))))
                + (bigR * bigR * Math.Acos(Clamp((d * d + bigR * bigR - smallR * smallR) / (2.0 * d * bigR))));
            var kite = (-d + smallR + bigR) * (d + smallR - bigR) * (d - smallR + bigR) * (d + smallR + bigR);
            return part - (Math.Sqrt(Math.Max(0.0, kite)) / 2.0);
        }

        private static double Clamp(double cosine) => Math.Max(-1.0, Math.Min(1.0, cosine));

        /// <summary>The angular radius of a body seen from close range, in radians (RealAntennas' <c>MathUtils.AngularRadius</c>).</summary>
        private static double AngularRadiusRadians(double radius, double distance)
        {
            var half = distance / 2.0;
            var offset = ((half * half) - (half * half) + (radius * radius)) / (2.0 * half);
            var height = Math.Sqrt(Math.Max(0.0, (radius * radius) - (offset * offset)));
            var origin = new Sitrep.Contract.Vector3d(0, 0, 0);
            var apex = new Sitrep.Contract.Vector3d(distance, 0, 0);
            var edge = new Sitrep.Contract.Vector3d(offset, height, 0);
            return AngleDegrees(origin - apex, edge - apex) * Math.PI / 180.0;
        }
    }
}
