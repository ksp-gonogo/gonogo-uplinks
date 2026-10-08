using System.Linq;
using Gonogo.RealAntennasUplink;
using Xunit;

namespace GonogoRealAntennasUplink.Tests
{
    /// <summary>The loans and the opt-outs go in the save and come back as they were.</summary>
    public class RaRetargetPersistenceTests
    {
        private const string Craft = "11111111-1111-1111-1111-111111111111";

        [Fact]
        public void AnOpenLoanAnOptOutAndALastLoanSurviveASaveAndALoad()
        {
            var register = new RaRetargetRegister();
            register.SetAllowed("22222222-2222-2222-2222-222222222222", false);
            var open = register.Begin(
                RaDishIds.Of("vessel:" + Craft, 7, 0),
                "ground:ksc",
                new RealAntennasTargetStepArgs { Mode = "BodyLatLonAlt", BodyName = "Kerbin", Latitude = -0.1, Longitude = 285.4, Altitude = -600000 },
                "Kerbin",
                1234.5)!;
            var done = register.Begin(RaDishIds.Of("vessel:" + Craft, 8, 1), "vessel:x", new RealAntennasTargetStepArgs { Mode = "Vessel", VesselId = "x" }, "x", 10.0)!;
            register.Settle(done.Id, RaBorrowOutcome.Restored, 20.0);

            var node = new ConfigNode();
            RaRetargetPersistence.Save(register, node);
            var loaded = new RaRetargetRegister();
            RaRetargetPersistence.Load(loaded, node);

            Assert.False(loaded.Allowed("22222222-2222-2222-2222-222222222222"));
            Assert.True(loaded.Allowed(Craft));
            var back = Assert.Single(loaded.Open);
            Assert.Equal(open.Id, back.Id);
            Assert.Equal(open.DishId, back.DishId);
            Assert.Equal(1234.5, back.TurnedUt);
            Assert.Equal("BodyLatLonAlt", back.Previous.Mode);
            Assert.Equal(285.4, back.Previous.Longitude);
            Assert.Equal(RaBorrowOutcome.Restored, loaded.LastEnded[Craft].Outcome);
            Assert.Equal(20.0, loaded.LastEnded[Craft].SettledUt);
            Assert.NotNull(loaded.Begin(RaDishIds.Of("vessel:" + Craft, 9, 0), "p", new RealAntennasTargetStepArgs { Mode = "BodyCenter" }, "", 1.0));
            Assert.Equal(2, loaded.Open.Count());
        }

        [Fact]
        public void ALoanThatWillNotParseIsSkippedAndTheRestLoad()
        {
            var node = new ConfigNode();
            var root = node.AddNode("REALANTENNAS_RETARGET");
            root.AddNode("BORROW").AddValue("id", "borrow-1");
            var register = new RaRetargetRegister();
            register.SetAllowed("a", false);
            RaRetargetPersistence.Save(register, node);
            var loaded = new RaRetargetRegister();

            RaRetargetPersistence.Load(loaded, node);

            Assert.Empty(loaded.Open);
        }
    }
}
