using System;
using Gonogo.RealAntennasUplink;
using Sitrep.Contract;
using Sitrep.Contract.TestSupport;
using Xunit;

namespace GonogoRealAntennasUplink.Tests
{
    /// <summary>
    /// The contact plan's view of an RA link: a dish sees its peer only inside its
    /// beam, a pairing closes only within its link budget's reach, and antennas in
    /// different bands never pair.
    /// </summary>
    public class RaContactModelTests
    {
        private static readonly Sitrep.Contract.Vector3d Here = new Sitrep.Contract.Vector3d(0, 0, 0);
        private static readonly Sitrep.Contract.Vector3d Peer = new Sitrep.Contract.Vector3d(1_000_000, 0, 0);

        private sealed class Positions : IContactPositions
        {
            public Sitrep.Contract.Vector3d? NodeAt(string nodeId, double ut) => nodeId switch
            {
                "from" => Here,
                "to" => Peer,
                "vessel:peer" => Peer,
                "vessel:elsewhere" => new Sitrep.Contract.Vector3d(0, 1_000_000, 0),
                _ => null,
            };

            public Sitrep.Contract.Vector3d BodyAt(int bodyIndex, double ut) => new Sitrep.Contract.Vector3d(-1_000_000, 0, 0);
        }

        private static RaPlannedAntenna Dish(RaAimKind aim, string? node = null, int? body = null, string band = "S") =>
            new RaPlannedAntenna
            {
                Steerable = true,
                BeamwidthRadians = 0.1,
                Band = band,
                Aim = aim,
                AimNodeId = node,
                AimBodyIndex = body,
            };

        private static RaPlannedAntenna Omni(string band = "S") => new RaPlannedAntenna { Steerable = false, Band = band };

        private static double Margin(RaPlannedAntenna from, RaPlannedAntenna to) =>
            new RaContactLinkModel(new[] { from }, new[] { to }).MarginAt(0.0, Here, Peer, new Positions());

        [Fact]
        public void ADishAimedElsewhereNeverSeesItsPeerAndOneAimedAtItDoes()
        {
            Assert.True(Margin(Dish(RaAimKind.Vessel, "vessel:elsewhere"), Omni()) < 0.0);
            Assert.True(Margin(Dish(RaAimKind.BodyCentre, body: 3), Omni()) < 0.0);
            Assert.True(Margin(Dish(RaAimKind.Vessel, "vessel:peer"), Omni()) > 0.0);
        }

        [Fact]
        public void AnUntargetedGroundStationSeesEveryDirection()
        {
            Assert.True(Margin(Omni(), Dish(RaAimKind.Untargeted)) > 0.0);
        }

        [Fact]
        public void TheBestPairingDecidesAndADifferentBandNeverPairs()
        {
            var model = new RaContactLinkModel(
                new[] { Dish(RaAimKind.Vessel, "vessel:elsewhere"), Omni() },
                new[] { Omni() });
            Assert.True(model.MarginAt(0.0, Here, Peer, new Positions()) > 0.0);

            Assert.Equal(RaContactLinkModel.NoPairing, Margin(Omni("S"), Omni("X")));
        }

        [Fact]
        public void APairingBeyondItsBudgetsReachIsNoContact()
        {
            static RaPlannedAntenna Radio() => new RaPlannedAntenna
            {
                Steerable = false,
                Band = "S",
                TxPowerDbm = 30.0,
                GainDbi = 0.0,
                FrequencyHz = 2.2e9,
                SymbolRateHz = 1000.0,
            };
            var reach = RaLinkBudget.MaxRangeMeters(30.0, 0.0, 0.0, 2.2e9, 200.0, 1000.0, 2.5)!.Value;
            var model = new RaContactLinkModel(new[] { Radio() }, new[] { Radio() });

            Assert.True(model.MarginAt(0.0, Here, new Sitrep.Contract.Vector3d(reach * 0.9, 0, 0), new Positions()) > 0.0);
            Assert.True(model.MarginAt(0.0, Here, new Sitrep.Contract.Vector3d(reach * 1.1, 0, 0), new Positions()) < 0.0);
        }

        [Fact]
        public void PointingLossShortensTheReachInsideTheBeam()
        {
            Assert.Equal(3.0, RaContactLinkModel.LossDb(Dish(RaAimKind.Vessel, "vessel:peer"), 0.05), 9);
            Assert.Equal(12.0, RaContactLinkModel.LossDb(Dish(RaAimKind.Vessel, "vessel:peer"), 0.1), 9);
            Assert.Equal(0.0, RaContactLinkModel.LossDb(Omni(), null));

            var radio = new RaPlannedAntenna { TxPowerDbm = 30.0, GainDbi = 20.0, FrequencyHz = 2.2e9, SymbolRateHz = 1000.0 };
            var reach = RaLinkBudget.MaxRangeMeters(30.0, 20.0, 20.0, 2.2e9, 200.0, 1000.0, 2.5)!.Value;
            Assert.True(RaContactLinkModel.RangeMargin(radio, radio, reach * 0.9) > 0.0);
            Assert.True(RaContactLinkModel.RangeMargin(radio, radio, reach * 0.9, 3.0, 3.0) < 0.0);
        }

        [Fact]
        public void TheModelKeepsTheLinkModelContract()
        {
            ContactModelConformance.AssertLinkModelContract(
                new RaContactLinkModel(new[] { Dish(RaAimKind.Vessel, "vessel:peer") }, new[] { Omni() }),
                new Positions(),
                0.0,
                3600.0);
        }

        /// <summary>
        /// RealAntennas keeps a link by stepping its symbol rate down, to the
        /// slowest both antennas can run, so the pair reaches as far as that
        /// slowest rate closes. Reckoned at the fastest rate, a link the game
        /// still carries read as long out of range, and the plan went dark
        /// while telemetry was arriving.
        /// </summary>
        [Fact]
        public void APairReachesAsFarAsItsSlowestSymbolRateCloses()
        {
            var fastOnly = new RaPlannedAntenna { TxPowerDbm = 30.0, GainDbi = 20.0, FrequencyHz = 2.2e9, SymbolRateHz = 1024.0 };
            var stepsDown = new RaPlannedAntenna { TxPowerDbm = 30.0, GainDbi = 20.0, FrequencyHz = 2.2e9, SymbolRateHz = 1024.0, MinSymbolRateHz = 1.0 };
            var atFullRate = RaLinkBudget.MaxRangeMeters(30.0, 20.0, 20.0, 2.2e9, 200.0, 1024.0, 2.5)!.Value;

            // 1024 times slower is 30 dB, which is 32 times as far.
            Assert.True(RaContactLinkModel.RangeMargin(fastOnly, fastOnly, atFullRate * 10.0) < 0.0);
            Assert.True(RaContactLinkModel.RangeMargin(stepsDown, stepsDown, atFullRate * 10.0) > 0.0);
            Assert.True(RaContactLinkModel.RangeMargin(stepsDown, stepsDown, atFullRate * 33.0) < 0.0);
        }

        [Fact]
        public void ThePairsSlowestRateIsTheFasterOfTheTwoAntennasSlowest()
        {
            Assert.Equal(8.0, RaRateLadder.SlowestCommonSymbolRate(1024.0, 8.0, 512.0, 2.0));
            // An antenna that states no slowest rate runs only at its fastest.
            Assert.Equal(512.0, RaRateLadder.SlowestCommonSymbolRate(1024.0, 8.0, 512.0, null));
            // No rate in common: nothing closes.
            Assert.Null(RaRateLadder.SlowestCommonSymbolRate(4.0, 2.0, 1024.0, 512.0));
            Assert.Null(RaRateLadder.SlowestCommonSymbolRate(null, null, 512.0, 2.0));
        }
    }
}
