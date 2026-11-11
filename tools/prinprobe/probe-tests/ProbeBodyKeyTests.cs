using System;
using GonogoPrinProbe;
using Xunit;

namespace GonogoPrinProbe.Tests
{
    public class ProbeBodyKeyTests
    {
        /// <summary>The two shapes of <c>CelestialFromParent</c>, by parameter type.</summary>
        private static class Forwarder
        {
            public static object? ByIndex(IntPtr plugin, int celestialIndex) => null;

            public static object? ByCity(IntPtr plugin, ulong celestialCity) => null;

            public static void ApsidesByCity(
                IntPtr plugin, string guid, object? tMax, ulong celestialCity, object sun, int maxPoints,
                out object? apoapsides, out object? periapsides)
            {
                apoapsides = null;
                periapsides = null;
            }
        }

        [Fact]
        public void ABuildThatNamesBodiesByIndexIsGivenTheIndex()
        {
            var key = ProbeBodyKey.For(typeof(Forwarder).GetMethod(nameof(Forwarder.ByIndex))!, 1, 1, "Kerbin");

            Assert.Equal(1, key);
        }

        /// <summary>The city here is the one 2026110907-Lie's own CityHash64 gives Kerbin.</summary>
        [Fact]
        public void ABuildThatNamesBodiesByCityIsGivenTheCityOfTheName()
        {
            var key = ProbeBodyKey.For(typeof(Forwarder).GetMethod(nameof(Forwarder.ByCity))!, 1, 1, "Kerbin");

            Assert.Equal(6228157669635263037UL, key);
        }

        /// <summary>The apsides read names its body fourth, after the plugin, the craft and
        /// the end time.</summary>
        [Fact]
        public void FindsTheBodyParameterWhereverTheCallPutsIt()
        {
            var key = ProbeBodyKey.For(typeof(Forwarder).GetMethod(nameof(Forwarder.ApsidesByCity))!, 3, 1, "Kerbin");

            Assert.Equal(6228157669635263037UL, key);
        }

        [Fact]
        public void TheKeyInvokesTheCallItWasMadeFor()
        {
            foreach (var name in new[] { nameof(Forwarder.ByIndex), nameof(Forwarder.ByCity) })
            {
                var method = typeof(Forwarder).GetMethod(name)!;
                method.Invoke(null, new[] { IntPtr.Zero, ProbeBodyKey.For(method, 1, 2, "Mun") });
            }
        }
    }
}
