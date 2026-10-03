using System.Collections.Generic;
using System.Linq;
using Gonogo.MechJebUplink;
using Sitrep.Contract;
using Xunit;

namespace GonogoMechJebUplink.Tests
{
    public class MechJebUnlockGateTests
    {
        private static readonly Dictionary<string, MechJebTechDescription> Tree = new Dictionary<string, MechJebTechDescription>
        {
            ["unmannedTech"] = new MechJebTechDescription("Unmanned Tech", 300),
            ["advFlightControl"] = new MechJebTechDescription("Advanced Flight Control", 90),
        };

        private sealed class FakeReads : IMechJebUnlockReads
        {
            public bool? Research = true;
            public MechJebModuleUnlock? Unlock;
            public string[] Purchased = new string[0];
            public string[] Researched = new string[0];

            public bool? CareerResearch() => Research;
            public MechJebModuleUnlock? UnlockOf(string module) => Unlock;
            public bool PartPurchased(string partName) => Purchased.Contains(partName);
            public bool TechResearched(string techId) => Researched.Contains(techId);
            public MechJebTechDescription Describe(string techId) => Tree[techId];
        }

        private static MechJebUnlockGate Gate(
            bool? research = true,
            MechJebModuleUnlock? unlock = null,
            string[]? purchased = null,
            string[]? researched = null) =>
            new MechJebUnlockGate(() => null, new FakeReads
            {
                Research = research,
                Unlock = unlock,
                Purchased = purchased ?? new string[0],
                Researched = researched ?? new string[0],
            });

        private static GateVerdict Ask(MechJebUnlockGate gate) =>
            gate.Evaluate(MechJebUnlockGate.For("MechJebModuleAscentMenu"), null!);

        private static MechJebModuleUnlock Techs(params string[] techs) => new MechJebModuleUnlock(new string[0], techs);

        [Fact]
        public void AnUnresearchedNode_LocksTheCommand_AndNamesIt()
        {
            var verdict = Ask(Gate(unlock: Techs("unmannedTech")));

            Assert.Equal(GateOutcome.Fail, verdict.Outcome);
            Assert.Equal(CommandErrorCode.NotUnlocked, verdict.ErrorCode);
            var missing = Assert.Single(verdict.Missing!);
            Assert.Equal(UnlockKind.Tech, missing.Kind);
            Assert.Equal("unmannedTech", missing.Id);
            Assert.Equal("Unmanned Tech", missing.Name);
            Assert.Equal(300, missing.ScienceCost);
        }

        [Fact]
        public void AResearchedNode_Passes()
        {
            Assert.Equal(GateOutcome.Pass, Ask(Gate(unlock: Techs("unmannedTech"), researched: new[] { "unmannedTech" })).Outcome);
        }

        [Fact]
        public void OfSeveralNodes_AnyOneUnlocks_AndTheCheapestIsNamed()
        {
            var unlock = Techs("unmannedTech", "advFlightControl");

            Assert.Equal(GateOutcome.Pass, Ask(Gate(unlock: unlock, researched: new[] { "unmannedTech" })).Outcome);
            Assert.Equal("advFlightControl", Assert.Single(Ask(Gate(unlock: unlock)).Missing!).Id);
        }

        [Fact]
        public void APurchasedPart_UnlocksWithoutTheNode()
        {
            var unlock = new MechJebModuleUnlock(new[] { "mumech.MJ2.AR202" }, new[] { "unmannedTech" });

            Assert.Equal(GateOutcome.Pass, Ask(Gate(unlock: unlock, purchased: new[] { "mumech.MJ2.AR202" })).Outcome);
        }

        [Fact]
        public void AModuleWithNoUnlockLists_IsNeverLocked()
        {
            Assert.Equal(GateOutcome.Pass, Ask(Gate(unlock: Techs())).Outcome);
        }

        [Fact]
        public void Sandbox_Passes_AsMechJebUnlocksEverythingThere()
        {
            Assert.Equal(GateOutcome.Pass, Ask(Gate(research: false, unlock: Techs("unmannedTech"))).Outcome);
        }

        [Fact]
        public void NoResearchScenario_OrNoMechJebAboard_IsUnknown_NeverALock()
        {
            Assert.Equal(GateOutcome.Unknown, Ask(Gate(research: null, unlock: Techs("unmannedTech"))).Outcome);
            Assert.Equal(GateOutcome.Unknown, Ask(Gate(unlock: null)).Outcome);
        }

        /// <summary>
        /// Every command declares this kind, and the engine refuses to start
        /// over a declared kind nothing evaluates, so a MechJeb whose version
        /// guard failed must still register the gate or it takes the whole mod
        /// down with it.
        /// </summary>
        [Fact]
        public void Register_AddsTheGate_EvenWhenMechJebIsUnusable()
        {
            var uplink = new MechJebUplink(new MainThreadDispatcher(_ => { }), _ => { });
            uplink._unavailableReason = "MechJeb2 API drifted";
            var host = new NullUplinkHost();

            uplink.Register(host);

            var gate = Assert.Single(host.GateEvaluators);
            Assert.Equal(MechJebUnlockGate.KindName, gate.Kind);
            var verdict = gate.Evaluate(MechJebUnlockGate.For("MechJebModuleAscentMenu"), null!);
            Assert.Equal(GateOutcome.Unknown, verdict.Outcome);
            Assert.Equal("MechJeb2 API drifted", verdict.Detail);
        }

        [Fact]
        public void EveryCommand_DeclaresTheWindowItStandsIn()
        {
            var commands = new MechJebUplink(new MainThreadDispatcher(_ => { }), _ => { }).Manifest.Commands;

            foreach (var command in commands)
            {
                Assert.Contains(command.Requires!, r => r.Kind == MechJebUnlockGate.KindName && r.Quantity.StartsWith("MechJebModule"));
            }
        }
    }
}
