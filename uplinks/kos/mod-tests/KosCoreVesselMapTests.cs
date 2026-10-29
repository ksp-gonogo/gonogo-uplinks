using System.Collections.Generic;
using Gonogo.KosUplink;
using Xunit;

namespace GonogoKosUplink.Tests
{
    /// <summary>
    /// Which craft a CPU is aboard across the passes either side of staging,
    /// when its part briefly reports no vessel.
    /// </summary>
    public class KosCoreVesselMapTests
    {
        private static Dictionary<string, string> Pass(
            Dictionary<string, string> previous, params (string core, string? vessel)[] seen)
        {
            var observed = new List<KeyValuePair<string, string?>>();
            foreach (var (core, vessel) in seen)
            {
                observed.Add(new KeyValuePair<string, string?>(core, vessel));
            }
            return KosCoreVesselMap.Next(previous, observed);
        }

        [Fact]
        public void ACpuWhosePartHasNoVesselForAPassKeepsItsLastCraftUntilItsNewOneAppears()
        {
            var map = Pass(new Dictionary<string, string>(), ("7", "vessel-a"));
            Assert.Equal("vessel-a", map["7"]);

            map = Pass(map, ("7", null));
            Assert.Equal("vessel-a", map["7"]);

            map = Pass(map, ("7", "vessel-b"));
            Assert.Equal("vessel-b", map["7"]);
        }

        [Fact]
        public void ACpuNoLongerListedLeavesTheMap()
        {
            var map = Pass(new Dictionary<string, string>(), ("7", "vessel-a"), ("8", "vessel-a"));

            map = Pass(map, ("8", "vessel-a"));

            Assert.False(map.ContainsKey("7"));
            Assert.Equal("vessel-a", map["8"]);
        }

        [Fact]
        public void ACpuNeverSeenOnAVesselIsNotInventedOne()
        {
            var map = Pass(new Dictionary<string, string>(), ("7", null));

            Assert.False(map.ContainsKey("7"));
        }
    }
}
