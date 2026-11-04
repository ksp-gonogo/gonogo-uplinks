using System.Collections.Generic;
using Xunit;

namespace GonogoPrincipiaUplink.Tests
{
    /// <summary>
    /// A burn the player switched to Spherical in Principia's editor, in the shape
    /// the plugin hands it back: coordinate system 2 and the Cartesian components
    /// of the magnitude and angles entered. The figures are a 100 m/s burn read off
    /// a live game.
    /// </summary>
    public class SphericalBurnTests
    {
        private const int SphericalTnb = 2;

        private static FakeBurn SphericalBurn()
        {
            var burn = FakeBurn.FromPlugin();
            burn.intensity.coordinate_system_ = SphericalTnb;
            burn.intensity.xyz = new FakeXyz
            {
                x = 99.99725448717251,
                y = 0.7407749705494311,
                z = 0.018640565004431318,
            };
            return burn;
        }

        [Fact]
        public void ASphericalBurnPublishesItsComponentsAndTheirMagnitude()
        {
            var described = PlanReader.Describe(
                new FakeManoeuvre { burn = SphericalBurn() }, 0, 1, 0, 500.0, celestials: null);
            var observation = new PlanObservation();
            observation.Burns.Add(described);
            var burns = Assert.IsType<List<object?>>(PlanBuilder.Build(observation)["burns"]);
            var published = Assert.IsType<Dictionary<string, object?>>(burns[0]);

            Assert.Equal(SphericalTnb, published["coordinateSystem"]);
            Assert.Equal(99.99725448717251, published["deltaVTangent"]);
            Assert.Equal(0.7407749705494311, published["deltaVNormal"]);
            Assert.Equal(0.018640565004431318, published["deltaVBinormal"]);
            Assert.Equal(100.0, (double)published["deltaV"]!, 6);
        }
    }
}
