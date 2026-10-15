using System;
using System.Collections.Generic;
using Gonogo.RealAntennasUplink;
using Sitrep.Contract;
using Xunit;

namespace Gonogo.RealAntennasUplink.Tests
{
    /// <summary>
    /// The noise a receiver picks up from the sky, against figures worked by hand
    /// from RealAntennas' own formulas (<c>Physics.BodyNoiseTemp</c>,
    /// <c>AtmosphereNoiseTemperature</c>, <c>StarRadioTemp</c>).
    /// </summary>
    public class RaSkyNoiseTests
    {
        private static readonly Sitrep.Contract.Vector3d Origin = new Sitrep.Contract.Vector3d(0, 0, 0);

        [Fact]
        public void ABodyWhollyInsideTheBeamFillsItsShareOfTheBeam()
        {
            // 30 dBi is a 7.2474 degree beam; a 600 km body at 12000 km is 2.8624 degrees.
            var temperature = RaSkyNoise.BodyNoiseTempKelvin(
                Origin, 30.0, new Sitrep.Contract.Vector3d(1, 0, 0), new Sitrep.Contract.Vector3d(12_000_000, 0, 0), 600_000.0, 300.0, 7.247413331665305);

            Assert.Equal(46.7969, temperature, 3);
        }

        [Fact]
        public void ABodyAtTheEdgeOfTheBeamIsWeightedByItsOverlapAndItsOffset()
        {
            var aim = new Sitrep.Contract.Vector3d(1, 0, 0);
            var angle = 6.0 * Math.PI / 180.0;
            var body = new Sitrep.Contract.Vector3d(12_000_000 * Math.Cos(angle), 12_000_000 * Math.Sin(angle), 0);

            var temperature = RaSkyNoise.BodyNoiseTempKelvin(Origin, 30.0, aim, body, 600_000.0, 300.0, 7.247413331665305);

            Assert.Equal(3.6528, temperature, 3);
        }

        [Fact]
        public void ABodyBeyondTheBeamAddsNothing()
        {
            var temperature = RaSkyNoise.BodyNoiseTempKelvin(
                Origin, 30.0, new Sitrep.Contract.Vector3d(1, 0, 0), new Sitrep.Contract.Vector3d(0, 12_000_000, 0), 600_000.0, 300.0, 7.2474);

            Assert.Equal(0.0, temperature);
        }

        [Fact]
        public void AnOmniSeesNoBody()
        {
            var temperature = RaSkyNoise.BodyNoiseTempKelvin(
                Origin, 3.0, new Sitrep.Contract.Vector3d(1, 0, 0), new Sitrep.Contract.Vector3d(12_000_000, 0, 0), 600_000.0, 300.0, 180.0);

            Assert.Equal(0.0, temperature);
        }

        [Fact]
        public void TheAtmosphereAddsNoiseThatGrowsTowardTheHorizon()
        {
            Assert.Equal(4.2770, RaSkyNoise.AtmosphereNoiseTempKelvin(30.0, 2.2e9), 3);
            Assert.True(RaSkyNoise.AtmosphereNoiseTempKelvin(5.0, 2.2e9) > RaSkyNoise.AtmosphereNoiseTempKelvin(30.0, 2.2e9));
        }

        [Fact]
        public void AStarIsHotterTheLowerTheFrequency()
        {
            Assert.Equal(16_682_573.0, RaSkyNoise.StarRadioTempKelvin(5_000_000.0, 2.2e9), 0.5);
        }

        private sealed class Positions : IContactPositions
        {
            public Sitrep.Contract.Vector3d? NodeAt(string nodeId, double ut) => null;
            public Sitrep.Contract.Vector3d BodyAt(int bodyIndex, double ut) => new Sitrep.Contract.Vector3d(0, 12_000_000, 0);
        }

        [Fact]
        public void ADishWithNoTargetTracksItsPeerAndHearsABodyBehindIt()
        {
            var dish = new RaPlannedAntenna
            {
                Steerable = true, Aim = RaAimKind.Untargeted, GainDbi = 30.0, FrequencyHz = 2.2e9, BeamwidthRadians = 7.247413331665305 * Math.PI / 180.0,
            };
            var occluder = new[] { new RaOccluder { BodyIndex = 0, RadiusMeters = 600_000.0, TemperatureKelvin = 300.0 } };

            var towardBody = RaContactLinkModel.ExtraNoiseKelvin(dish, Origin, new Sitrep.Contract.Vector3d(0, 5_000_000, 0), 0.0, new Positions(), occluder);
            var awayFromBody = RaContactLinkModel.ExtraNoiseKelvin(dish, Origin, new Sitrep.Contract.Vector3d(0, -5_000_000, 0), 0.0, new Positions(), occluder);

            Assert.Equal(46.7969, towardBody, 3);
            Assert.Equal(0.0, awayFromBody);
        }
    }
}
