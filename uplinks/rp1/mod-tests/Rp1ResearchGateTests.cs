using System;
using System.Collections.Generic;
using System.Linq;
using GonogoRp1Uplink;
using RP0;
using Sitrep.Contract;
using Xunit;

namespace GonogoRp1Uplink.Tests
{
    /// <summary>
    /// rp1.tech.research answered per node before the press, against the stand-in
    /// RP-1 object graph. The gate asks the handler's own judge, so each verdict
    /// here must equal the refusal the press returns and the gate must write nothing.
    /// </summary>
    public class Rp1ResearchGateTests : IDisposable
    {
        private readonly Rp1ResearchCommands _commands = new Rp1ResearchCommands();
        private readonly Rp1ResearchGate _gate;

        public Rp1ResearchGateTests()
        {
            _gate = new Rp1ResearchGate(_commands);
            Reset();
        }

        public void Dispose() => Reset();

        private static void Reset()
        {
            SpaceCenterManagement.Instance = null;
            PresetManager.Reset();
            ResearchAndDevelopment.Reset();
            GameVariables.Reset();
            ScenarioUpgradeableFacilities.Reset();
            CurrencyModifierQueryRP0.Reset();
            KCTUtilities.Reset();
            Database.TechNodePeriods.Clear();
            AssetBase.RnDTechTree = null;
        }

        private sealed class Args : IGateArguments
        {
            private readonly Dictionary<string, object> _values = new Dictionary<string, object>();

            public static Args Of(string techId)
            {
                var args = new Args();
                args._values["techId"] = techId;
                return args;
            }

            public bool TryGet(string path, out object value) => _values.TryGetValue(path, out value!);
        }

        private static void Career(float banked, params (string id, int cost)[] nodes)
        {
            SpaceCenterManagement.Instance = new SpaceCenterManagement();
            AssetBase.RnDTechTree = new RDTechTree();
            foreach (var (id, cost) in nodes)
            {
                AssetBase.RnDTechTree.Techs.Add(new ProtoTechNode
                {
                    techID = id,
                    scienceCost = cost,
                    state = RDTech.State.Available,
                });
                ResearchAndDevelopment.Titles[id] = id;
            }
            ResearchAndDevelopment.Instance!.science = banked;
        }

        private GateVerdict Ask(string techId) => _gate.Evaluate(Rp1ResearchGate.Requirement(), Args.Of(techId));

        [Fact]
        public void A_node_the_career_can_pay_for_passes_and_nothing_is_charged()
        {
            Career(500f, ("start", 100));

            var verdict = Ask("start");

            Assert.Equal(GateOutcome.Pass, verdict.Outcome);
            Assert.Empty(ResearchAndDevelopment.Instance!.Charges);
            Assert.Empty(SpaceCenterManagement.Instance!.TechList);
        }

        [Fact]
        public void A_node_beyond_the_science_balance_fails_with_the_press_breach()
        {
            Career(100f, ("start", 900));

            var verdict = Ask("start");
            var press = _commands.Research(new Rp1TechResearchArgs { TechId = "start" });

            Assert.Equal(GateOutcome.Fail, verdict.Outcome);
            Assert.Equal(CommandErrorCode.InsufficientScience, verdict.ErrorCode);
            Assert.Equal(900.0, verdict.Breach!.Actual);
            Assert.Equal(100.0, verdict.Breach.Limit);
            Assert.Equal(press.ErrorCode, verdict.ErrorCode);
        }

        [Fact]
        public void A_node_already_on_the_queue_fails_as_the_press_does()
        {
            Career(500f, ("start", 100));
            Assert.True(_commands.Research(new Rp1TechResearchArgs { TechId = "start" }).Success);

            var verdict = Ask("start");

            Assert.Equal(GateOutcome.Fail, verdict.Outcome);
            Assert.Contains("already on the research queue", verdict.Detail);
        }

        [Fact]
        public void An_unknown_node_fails_as_not_found()
        {
            Career(500f, ("start", 100));

            var verdict = Ask("nothing");

            Assert.Equal(GateOutcome.Fail, verdict.Outcome);
            Assert.Equal(CommandErrorCode.NotFound, verdict.ErrorCode);
        }

        [Fact]
        public void No_node_named_is_unknown_rather_than_a_pass()
        {
            Career(500f, ("start", 100));

            var verdict = _gate.Evaluate(Rp1ResearchGate.Requirement(), new Args());

            Assert.Equal(GateOutcome.Unknown, verdict.Outcome);
        }

        [Fact]
        public void Items_name_the_nodes_still_to_research_and_not_the_queued_ones()
        {
            Career(500f, ("start", 100), ("basic", 100), ("queued", 100));
            Assert.True(_commands.Research(new Rp1TechResearchArgs { TechId = "queued" }).Success);

            var items = _gate.Items(Rp1ResearchGate.Requirement()).ToArray();

            Assert.Equal(new[] { "start", "basic" }, items);
        }

        [Fact]
        public void Items_are_empty_without_a_tech_tree()
        {
            SpaceCenterManagement.Instance = new SpaceCenterManagement();

            Assert.Empty(_gate.Items(Rp1ResearchGate.Requirement()));
        }
    }
}
