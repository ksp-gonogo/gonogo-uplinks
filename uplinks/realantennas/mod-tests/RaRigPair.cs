using System;
using Gonogo.RealAntennasUplink;
using Sitrep.Contract;

namespace GonogoRealAntennasUplink.Tests
{
    /// <summary>
    /// A craft in solar orbit 240.6 Gm from a craft landed on Kerbin, with the
    /// antennas both carry, at RealAntennas' own figures. Kerbin's centre is the
    /// origin and the Sun sits 13.6 Gm away along -x.
    /// </summary>
    internal static class RaRigPair
    {
        internal static readonly Sitrep.Contract.Vector3d Surface = new Sitrep.Contract.Vector3d(0, 600_840, 0);

        internal static readonly Sitrep.Contract.Vector3d Craft = Surface + new Sitrep.Contract.Vector3d(240.6e9 * 0.7071, 240.6e9 * 0.7071, 0);

        /// <summary>The craft in space: an omni and a dish aimed at Kerbin's centre.</summary>
        internal static RaPlannedAntenna[] InSpace => new[] { LBand(false, RaAimKind.Untargeted), LBand(true, RaAimKind.BodyCentre) };

        /// <summary>The landed craft: a dish aimed at Kerbin's centre, into the ground, and two omnis.</summary>
        internal static RaPlannedAntenna[] Landed => new[] { LBand(true, RaAimKind.BodyCentre), LBand(false, RaAimKind.Untargeted), LBand(false, RaAimKind.Untargeted) };

        /// <summary>The landed craft with its dish turned to whatever it pairs with.</summary>
        internal static RaPlannedAntenna[] Turned => new[] { LBand(true, RaAimKind.Untargeted), LBand(false, RaAimKind.Untargeted), LBand(false, RaAimKind.Untargeted) };

        /// <summary>The Sun at RealAntennas' 5 MK base temperature, and Kerbin.</summary>
        internal static RaOccluder[] Occluders => new[]
        {
            new RaOccluder { BodyIndex = 0, RadiusMeters = 261_600_000.0, TemperatureKelvin = 5_000_000.0, IsStar = true },
            new RaOccluder { BodyIndex = 1, RadiusMeters = 600_000.0, TemperatureKelvin = 288.0 },
        };

        internal sealed class Positions : IContactPositions
        {
            public Sitrep.Contract.Vector3d? NodeAt(string nodeId, double ut) => null;

            public Sitrep.Contract.Vector3d BodyAt(int bodyIndex, double ut) =>
                bodyIndex == 0 ? new Sitrep.Contract.Vector3d(-13.6e9, 0, 0) : new Sitrep.Contract.Vector3d(0, 0, 0);
        }

        /// <summary>
        /// One L band antenna at tech level 9, from RealAntennas' own tables: a
        /// 31.5 kHz channel stepping down 21 halvings, the Turbo 1/2 encoder at
        /// 1 dB, a 200 K receiver, 30 dBm out. A one metre dish at the level's
        /// 0.68 reflector efficiency has 22.92 dBi and a 16.37 degree beam.
        /// </summary>
        private static RaPlannedAntenna LBand(bool dish, RaAimKind aim) => new RaPlannedAntenna
        {
            Steerable = dish,
            BeamwidthRadians = dish ? 16.37 * Math.PI / 180.0 : (double?)null,
            Band = "L",
            TxPowerDbm = 30.0,
            GainDbi = dish ? 22.92 : 1.5,
            FrequencyHz = 1.62e9,
            SymbolRateHz = 31500.0,
            MinSymbolRateHz = 31500.0 / Math.Pow(2.0, 21),
            NoiseTemperatureKelvin = 200.0,
            RequiredEbN0Db = 1.0,
            ModulationBits = 5,
            TechLevel = 9,
            EncoderTechLevel = 8,
            CodingRate = 0.5,
            EncoderRequiredEbN0Db = 1.0,
            Aim = aim,
            AimBodyIndex = aim == RaAimKind.BodyCentre ? 1 : (int?)null,
        };
    }
}
