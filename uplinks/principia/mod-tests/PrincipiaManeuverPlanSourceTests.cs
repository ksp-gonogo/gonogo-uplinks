using GonogoPrincipiaUplink;
using Sitrep.Contract;
using Xunit;

namespace GonogoPrincipiaUplink.Tests
{
    /// <summary>
    /// The producer's flight-plan burns as the generalised maneuver plan: the
    /// mapping a widget renders without knowing the producer exists.
    /// </summary>
    public class PrincipiaManeuverPlanSourceTests
    {
        private static PlannedBurnObservation Burn(int index = 0) =>
            new PlannedBurnObservation
            {
                Index = index,
                IgnitionUt = 1000,
                CutoffUt = 1060,
                TimeToHalfDeltaVSeconds = 30,
                DeltaVTangent = 3,
                DeltaVNormal = 4,
                DeltaVBinormal = 0,
                ThrustKilonewtons = 60,
                SpecificImpulseSeconds = 320,
                InitialMassTons = 12,
                FinalMassTons = 11,
                InertiallyFixed = true,
            };

        private static PlanObservation PlanOf(params PlannedBurnObservation[] burns)
        {
            var plan = new PlanObservation { PlanExists = true };
            plan.Burns.AddRange(burns);
            return plan;
        }

        [Fact]
        public void TheBurnInstantIsTheHalfDeltaVPointRatherThanIgnition()
        {
            // The impulsive equivalent of a finite burn. Reporting ignition would
            // make every countdown fire early by half a burn, and would do it
            // invisibly, because ignition IS an instant and reads as a plausible
            // one. 1000 + 30, not 1000.
            Assert.Equal(1030, PrincipiaManeuverPlanSource.MapBurn(Burn())?.Ut);
        }

        [Fact]
        public void IgnitionAndCutoffStillTravelInTheirOwnFields()
        {
            // So nothing is lost by the instant above not being one of them.
            var node = PrincipiaManeuverPlanSource.MapBurn(Burn());

            Assert.Equal(1000, node?.IgnitionUt);
            Assert.Equal(1060, node?.CutoffUt);
        }

        [Fact]
        public void AnInstantThatCouldNotBeReadFallsBackToIgnitionRatherThanNothing()
        {
            var burn = Burn();
            burn.TimeToHalfDeltaVSeconds = null;

            Assert.Equal(1000, PrincipiaManeuverPlanSource.MapBurn(burn)?.Ut);
        }

        [Fact]
        public void ABurnWithNoReadableInstantIsOmittedRatherThanPlacedAtZero()
        {
            // Zero renders as a burn in the deep past: an operator would see a
            // manoeuvre that is not there, at a time it is not at.
            var burn = Burn();
            burn.IgnitionUt = null;

            Assert.Null(PrincipiaManeuverPlanSource.MapBurn(burn));
            Assert.Empty(PrincipiaManeuverPlanSource.Map(PlanOf(burn))!);
        }

        [Fact]
        public void TheBasisIsUnnamedRatherThanClaimedAsStocks()
        {
            // The shared node names only stock's basis. Claiming it would read the
            // Frenet components as radial/normal/prograde, which is a different burn
            // entirely and looks completely ordinary.
            var node = PrincipiaManeuverPlanSource.MapBurn(Burn());

            Assert.Equal(ManeuverFrame.Unknown, node?.Frame);
        }

        [Fact]
        public void TheComponentsSitInTheBasisOwnOrder()
        {
            // Tangent, normal, binormal into slots one, two and three. The slot
            // NAMES are the stock basis's, which is why Frame above is not stock's. A permutation here rotates every burn.
            var node = PrincipiaManeuverPlanSource.MapBurn(Burn());

            Assert.Equal(3, node?.DvRadial);
            Assert.Equal(4, node?.DvNormal);
            Assert.Equal(0, node?.DvPrograde);
        }

        [Fact]
        public void TheTotalIsTheMagnitudeOfAllThreeAxes()
        {
            Assert.Equal(5, PrincipiaManeuverPlanSource.MapBurn(Burn())?.DvTotal);
        }

        [Fact]
        public void AMissingComponentLeavesNoTotalRatherThanASmallerOne()
        {
            // A total built from two of three axes is smaller than the real burn
            // and reads as a perfectly ordinary number.
            var burn = Burn();
            burn.DeltaVBinormal = null;

            Assert.Null(PrincipiaManeuverPlanSource.MapBurn(burn)?.DvTotal);
        }

        [Fact]
        public void AnIdSaysItIsTheProducersAndNotAStockGuid()
        {
            // A bare "0" is exactly the positional id that used to be sent to the
            // stock actuator, which resolves only an exact guid match and answered
            // NotFound to it every time.
            var id = PrincipiaManeuverPlanSource.MapBurn(Burn(2))?.Id;

            Assert.Equal("principia:2", id);
            Assert.StartsWith(PrincipiaManeuverPlanSource.IdPrefix, id);
        }

        [Fact]
        public void NotHavingReadTheCraftIsNotTheSameAsTheCraftHavingNoPlan()
        {
            // Null on this seam means "this craft cannot hold a plan at all",
            // which is what makes the wire name a planner beside the nodes. A
            // craft this planner COULD plan for, and simply has not, answers
            // empty.
            //
            // These were collapsed and the rig showed the cost: a craft with no
            // flight plan reported no planner either, so a client could not tell
            // an install with an n-body planner from one with none.
            Assert.Null(PrincipiaManeuverPlanSource.Map(null));
            Assert.Empty(
                PrincipiaManeuverPlanSource.Map(new PlanObservation { PlanExists = false })!);
            Assert.Empty(PrincipiaManeuverPlanSource.Map(PlanOf())!);
        }

        [Fact]
        public void EveryBurnInThePlanIsCarried()
        {
            var plan = PlanOf(Burn(0), Burn(1), Burn(2));

            Assert.Equal(3, PrincipiaManeuverPlanSource.Map(plan)!.Count);
        }
    }
}
