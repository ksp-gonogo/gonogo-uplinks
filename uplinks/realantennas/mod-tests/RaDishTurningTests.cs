using System.Collections.Generic;
using System.Linq;
using Gonogo.RealAntennasUplink;
using Sitrep.Contract;
using Sitrep.Contract.TestSupport;
using Xunit;

namespace GonogoRealAntennasUplink.Tests
{
    /// <summary>
    /// The plan's view of a steered dish: its id, the dish that carries a link,
    /// what turning a dish to a peer would do, and what is owed to the craft a
    /// dish was borrowed from.
    /// </summary>
    public class RaDishTurningTests
    {
        private const string Relay = "vessel:11111111-1111-1111-1111-111111111111";
        private const string Ground = "ground:ksc";
        private static readonly Sitrep.Contract.Vector3d Here = new Sitrep.Contract.Vector3d(0, 0, 0);
        private static readonly Sitrep.Contract.Vector3d Peer = new Sitrep.Contract.Vector3d(1_000_000, 0, 0);

        private sealed class Positions : IContactPositions
        {
            public Sitrep.Contract.Vector3d? NodeAt(string nodeId, double ut) => nodeId switch
            {
                "node" => Here,
                "peer" => Peer,
                _ => null,
            };

            public Sitrep.Contract.Vector3d BodyAt(int bodyIndex, double ut) => new Sitrep.Contract.Vector3d(0, 5_000_000, 0);
        }

        private static RaPlannedAntenna Dish(string id, RaAimKind aim = RaAimKind.BodyCentre, int body = 3) => new RaPlannedAntenna
        {
            DishId = id,
            Steerable = true,
            BeamwidthRadians = 0.1,
            Band = "S",
            Aim = aim,
            AimBodyIndex = body,
        };

        private static RaPlannedAntenna Omni() => new RaPlannedAntenna { Steerable = false, Band = "S" };

        [Fact]
        public void ADishIdIsTheNodeThePartAndTheOrdinalAndParsesBack()
        {
            var id = RaDishIds.Of(Relay, 4242, 1);

            Assert.Equal(Relay + "#4242/1", id);
            Assert.True(RaDishIds.TryParse(id, out var node, out var part, out var ordinal));
            Assert.Equal(Relay, node);
            Assert.Equal(4242u, part);
            Assert.Equal(1, ordinal);
            Assert.Equal("11111111-1111-1111-1111-111111111111", RaDishIds.VesselGuid(node));
        }

        [Theory]
        [InlineData("")]
        [InlineData("vessel:x")]
        [InlineData("vessel:x#12")]
        [InlineData("vessel:x#a/0")]
        [InlineData("#12/0")]
        [InlineData("vessel:x#12/")]
        public void AnythingElseIsNotADishId(string text) =>
            Assert.False(RaDishIds.TryParse(text, out _, out _, out _));

        [Fact]
        public void ALinkNamesTheDishOfTheBestPairingAndOnlyASteeredOne()
        {
            var aimedAtPeer = Dish("a#1/0", RaAimKind.Vessel);
            aimedAtPeer.AimNodeId = "peer";
            var model = new RaContactLinkModel(new[] { aimedAtPeer }, new[] { Omni() });

            var dishes = model.DishesAt(0.0, Here, Peer, new Positions());

            Assert.Equal("a#1/0", dishes.FromDish);
            Assert.Null(dishes.ToDish);
            Assert.False(dishes.IsEmpty);
        }

        [Fact]
        public void AnOmniPairingNamesNoDish()
        {
            var model = new RaContactLinkModel(new[] { Omni() }, new[] { Omni() });

            Assert.True(model.DishesAt(0.0, Here, Peer, new Positions()).IsEmpty);
        }

        [Fact]
        public void TheDishesAreTheSameHoweverOftenAndInWhateverOrderTheyAreAsked()
        {
            var aimedAtPeer = Dish("node#1/0", RaAimKind.Vessel);
            aimedAtPeer.AimNodeId = "peer";
            var model = new RaContactLinkModel(new[] { aimedAtPeer, Dish("node#2/0") }, new[] { Omni() });

            RetargetConformance.AssertRetargetModelContract(
                new RaRetargetModel("node", new[] { aimedAtPeer }, _ => new[] { Omni() }, _ => true), "node", "peer", new Positions(), 0.0, 100.0);
            var first = model.DishesAt(0.0, Here, Peer, new Positions());
            model.MarginAt(50.0, Here, Peer, new Positions());
            Assert.Equal(first.FromDish, model.DishesAt(0.0, Here, Peer, new Positions()).FromDish);
        }

        [Fact]
        public void ARetargetModelNamesItsOwnSteeredDishesAndNobodyElses()
        {
            var model = new RaRetargetModel(
                "node", new[] { Dish("node#1/0"), Omni(), Dish("node#2/0") }, _ => null, _ => true, a => "label " + a.DishId);

            Assert.Equal(new[] { "node#1/0", "node#2/0" }, model.DishesOf("node").Select(d => d.DishId));
            Assert.Equal("label node#1/0", model.DishesOf("node").First().AimLabel);
            Assert.Empty(model.DishesOf("peer"));
        }

        [Fact]
        public void ADishAimedAtAPeerThatCanHearItClosesTheLinkAndOneBesideAnUnreachablePeerDoesNot()
        {
            var dish = Dish("node#1/0");
            var hears = new RaRetargetModel("node", new[] { dish }, id => id == "peer" ? new[] { Omni() } : null, _ => true);
            var deaf = new RaRetargetModel("node", new[] { dish }, _ => null, _ => true);

            Assert.True(hears.MarginIfAimedAt("node#1/0", "peer", 0.0, Here, Peer, new Positions()) > 0.0);
            Assert.True(deaf.MarginIfAimedAt("node#1/0", "peer", 0.0, Here, Peer, new Positions()) < 0.0);
            Assert.True(hears.MarginIfAimedAt("node#9/9", "peer", 0.0, Here, Peer, new Positions()) < 0.0);
        }

        [Fact]
        public void APeerReceivesWithNothingTurnedOnlyThroughAnOmniOrADishAlreadyAimedAtTheNode()
        {
            var aimedAtNode = Dish("peer#1/0", RaAimKind.Vessel);
            aimedAtNode.AimNodeId = "node";
            var viaOmni = new RaRetargetModel("peer", new[] { Omni() }, _ => null, _ => true);
            var viaDish = new RaRetargetModel("peer", new[] { aimedAtNode }, _ => null, _ => true);
            var awayDish = new RaRetargetModel("peer", new[] { Dish("peer#1/0") }, _ => null, _ => true);

            Assert.True(viaOmni.PeerReceiveMargin("peer", "node", 0.0, Peer, Here, new Positions()) > 0.0);
            Assert.True(viaDish.PeerReceiveMargin("peer", "node", 0.0, Peer, Here, new Positions()) > 0.0);
            Assert.True(awayDish.PeerReceiveMargin("peer", "node", 0.0, Peer, Here, new Positions()) < 0.0);
        }

        [Fact]
        public void ACraftMayTurnADishUnlessItsOperatorOptedOut()
        {
            var register = new RaRetargetRegister();
            var model = new RaRetargetModel("vessel:g1", new RaPlannedAntenna[0], _ => null, id => register.Allowed(RaDishIds.VesselGuid(id)!));

            Assert.True(model.AutoRetargetAllowed("vessel:g1"));
            register.SetAllowed("g1", false);
            Assert.False(model.AutoRetargetAllowed("vessel:g1"));
            register.SetAllowed("g1", true);
            Assert.True(model.AutoRetargetAllowed("vessel:g1"));
            Assert.False(model.AutoRetargetAllowed("vessel:other"));
        }

        private static RealAntennasTargetStepArgs Previous() => new RealAntennasTargetStepArgs { Mode = "BodyCenter", BodyName = "Kerbin" };

        [Fact]
        public void ALoanIsOpenedOnceAndHoldsWhatTheDishMustGoBackTo()
        {
            var register = new RaRetargetRegister();
            var dish = RaDishIds.Of(Relay, 7, 0);

            var loan = register.Begin(dish, "ground:ksc", Previous(), "Kerbin", 100.0);

            Assert.NotNull(loan);
            Assert.True(loan!.IsOpen);
            Assert.Equal("11111111-1111-1111-1111-111111111111", loan.VesselId);
            Assert.Equal("BodyCenter", loan.Previous.Mode);
            Assert.Same(loan, register.OpenOn(dish));
            Assert.Same(loan, register.OpenOnPart(7, 0));
            Assert.Null(register.OpenOnPart(7, 1));
            Assert.Null(register.Begin(dish, "ground:ksc", Previous(), "Kerbin", 101.0));
        }

        [Fact]
        public void ASettledLoanIsNotOpenAndIsTheCraftsLastOne()
        {
            var register = new RaRetargetRegister();
            var dish = RaDishIds.Of(Relay, 7, 0);
            var loan = register.Begin(dish, "ground:ksc", Previous(), "Kerbin", 100.0)!;

            Assert.True(register.Settle(loan.Id, RaBorrowOutcome.Restored, 130.0));

            Assert.Empty(register.Open);
            Assert.Null(register.OpenOn(dish));
            Assert.Equal(130.0, register.LastEnded["11111111-1111-1111-1111-111111111111"].SettledUt);
            Assert.False(register.Settle(loan.Id, RaBorrowOutcome.Restored, 140.0));
            Assert.NotNull(register.Begin(dish, "ground:ksc", Previous(), "Kerbin", 200.0));
        }

        [Fact]
        public void OnlyTheLatestEndedLoanOfEachCraftIsKept()
        {
            var register = new RaRetargetRegister();
            var a = register.Begin(RaDishIds.Of(Relay, 7, 0), "p", Previous(), "x", 1.0)!;
            register.Settle(a.Id, RaBorrowOutcome.Restored, 2.0);
            var b = register.Begin(RaDishIds.Of(Relay, 7, 0), "p", Previous(), "x", 3.0)!;
            register.Settle(b.Id, RaBorrowOutcome.Taken, 4.0);

            Assert.Null(register.Find(a.Id));
            Assert.Equal(RaBorrowOutcome.Taken, register.LastEnded["11111111-1111-1111-1111-111111111111"].Outcome);
        }
    }
}
