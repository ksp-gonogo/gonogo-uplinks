using Gonogo.KosUplink;
using Xunit;

namespace GonogoKosUplink.Tests
{
    /// <summary>
    /// When the CPU list is forced out again after the active vessel changes,
    /// as it is on staging.
    /// </summary>
    public class KosSwitchKeyframeTests
    {
        [Fact]
        public void TheFirstVesselSeenAndASteadyOneForceNothing()
        {
            var arm = new KosSwitchKeyframe();

            Assert.False(arm.Observe("a"));
            Assert.False(arm.Observe("a"));
            Assert.False(arm.Observe("a"));
        }

        [Fact]
        public void AChangeOfActiveVesselForcesTwoPassesThenStops()
        {
            var arm = new KosSwitchKeyframe();
            arm.Observe("a");

            Assert.True(arm.Observe("b"));
            Assert.True(arm.Observe("b"));
            Assert.False(arm.Observe("b"));
        }

        [Fact]
        public void ASecondChangeInsideTheWindowRestartsIt()
        {
            var arm = new KosSwitchKeyframe();
            arm.Observe("a");
            Assert.True(arm.Observe("b"));

            Assert.True(arm.Observe("c"));
            Assert.True(arm.Observe("c"));
            Assert.False(arm.Observe("c"));
        }
    }
}
