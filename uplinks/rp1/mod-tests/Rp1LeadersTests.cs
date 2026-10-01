// What rp1.leaders publishes and what rp1.leader.appoint refuses on its behalf.
//
// The refusal tests are the defect this was written around: RP-1 applies its
// requirements and re-hire cooldown only by leaving a leader off its own
// Administration list, so the console appointed a locked or cooling-down leader
// and reported success. Each asserts the call log stays empty, because a refusal
// that still performed the activation is the failure being guarded against.
using System;
using System.Collections.Generic;
using System.Linq;
using GonogoRp1Uplink;
using RP0;
using RP0.Programs;
using Sitrep.Contract;
using Xunit;

namespace GonogoRp1Uplink.Tests
{
    public class Rp1LeadersTests : IDisposable
    {
        private const double Year = 31557600d;

        private readonly Rp1StrategyCommands _commands = new Rp1StrategyCommands();

        public Rp1LeadersTests() => Reset();

        public void Dispose() => Reset();

        private static void Reset()
        {
            Strategies.StrategySystem.Instance = null;
            SpaceCenterManagement.Instance = null;
            ProgramHandler.Instance = null;
            StrategyCallLog.Reset();
            GameVariables.Instance = null;
            global::Reputation.Instance = null;
            StrategyConfigRP0.Now = 0d;
            CurrencyUtils.Reset();
        }

        private static StrategyRP0 Leader(string name, Action<StrategyConfigRP0>? configure = null)
        {
            var config = new StrategyConfigRP0 { Name = name, Title = name + " title", ReactivateCooldown = Year };
            configure?.Invoke(config);
            return new StrategyRP0 { Config = config, DepartmentName = "Engineering" };
        }

        private static void Roster(params Strategies.Strategy[] strategies)
        {
            var system = new Strategies.StrategySystem();
            system.Strategies.AddRange(strategies);
            Strategies.StrategySystem.Instance = system;
            SpaceCenterManagement.Instance = new SpaceCenterManagement();
            ProgramHandler.Instance = new ProgramHandler();
        }

        private CommandResult Appoint(string id) =>
            _commands.Appoint(new Rp1LeaderAppointArgs { StrategyId = id });

        [Fact]
        public void Appoint_refuses_a_leader_whose_requirements_are_unmet()
        {
            Roster(Leader("leaderKorolev", c => c.Unlocked = false));

            var result = Appoint("leaderKorolev");

            Assert.False(result.Success);
            Assert.Equal(CommandErrorCode.NotClearToProceed, result.ErrorCode);
            Assert.Contains("requirements are not met", result.Detail);
            Assert.Empty(StrategyCallLog.Calls);
        }

        [Fact]
        public void Appoint_refuses_a_leader_inside_its_rehire_cooldown()
        {
            Roster(Leader("leaderKorolev"));
            ProgramHandler.Instance!.ActivatedStrategies["leaderKorolev"] = 1000d;
            StrategyConfigRP0.Now = 1000d + Year / 2;

            var result = Appoint("leaderKorolev");

            Assert.False(result.Success);
            Assert.Contains("365 days after the dismissal", result.Detail);
            Assert.Empty(StrategyCallLog.Calls);
        }

        /// <summary>
        /// The stamp IsAvailable compares is the later of the leader's own and its
        /// tag's, so dismissing one of a pair cools the other down too.
        /// </summary>
        [Fact]
        public void Appoint_refuses_a_leader_whose_tag_sibling_was_just_dismissed()
        {
            Roster(Leader("leaderVonBraunEngineering", c => c.RemoveOnDeactivateTag = "leaderVonBraun"));
            ProgramHandler.Instance!.ActivatedStrategies["leaderVonBraun"] = 1000d;
            StrategyConfigRP0.Now = 2000d;

            Assert.False(Appoint("leaderVonBraunEngineering").Success);
            Assert.Empty(StrategyCallLog.Calls);
        }

        [Fact]
        public void Appoint_refuses_a_leader_removed_for_good()
        {
            Roster(Leader("leaderKorolev", c => c.ReactivateCooldown = 0d));
            ProgramHandler.Instance!.ActivatedStrategies["leaderKorolev"] = 1000d;
            StrategyConfigRP0.Now = 1000d + 10 * Year;

            var result = Appoint("leaderKorolev");

            Assert.False(result.Success);
            Assert.Contains("hired again once dismissed", result.Detail);
        }

        [Fact]
        public void Appoint_refuses_a_disabled_leader()
        {
            Roster(Leader("leaderKorolev", c => c.IsDisabled = true));

            Assert.Contains("disabled", Appoint("leaderKorolev").Detail);
            Assert.Empty(StrategyCallLog.Calls);
        }

        [Fact]
        public void Appoint_goes_ahead_once_the_cooldown_has_run()
        {
            Roster(Leader("leaderKorolev"));
            ProgramHandler.Instance!.ActivatedStrategies["leaderKorolev"] = 1000d;
            StrategyConfigRP0.Now = 1000d + Year + 1;

            Assert.True(Appoint("leaderKorolev").Success);
            Assert.Equal(new[] { "PerformActivate" }, StrategyCallLog.Calls);
        }

        [Fact]
        public void Publishes_every_leader_and_no_Program()
        {
            var program = new ProgramStrategy
            {
                Config = new Strategies.StrategyConfig { Name = "earlyOrbital" },
                Program = new Program { name = "earlyOrbital" },
            };
            Roster(Leader("leaderKorolev"), program, Leader("leaderGlushko", c => c.Unlocked = false));

            var raw = new Rp1LeadersReflection().Read(5000d);

            Assert.NotNull(raw);
            Assert.Equal(new[] { "leaderKorolev", "leaderGlushko" }, raw!.Leaders.Select(l => l.StrategyId).ToArray());
            var open = raw.Leaders[0];
            Assert.Equal("leaderKorolev title", open.Title);
            Assert.Equal("Engineering", open.Department);
            Assert.True(open.CanAppoint);
            Assert.Null(open.AppointBlockedReason);
            Assert.Equal(0d, open.SetupFunds);
            Assert.Equal(0d, open.SetupConfidence);
            // Dismissal readings belong to a serving leader.
            Assert.Null(open.DeactivateReputation);
            var locked = raw.Leaders[1];
            Assert.False(locked.CanAppoint);
            Assert.Contains("requirements", locked.AppointBlockedReason);
        }

        [Fact]
        public void A_leader_in_its_cooldown_is_published_with_the_instant_it_ends()
        {
            Roster(Leader("leaderKorolev"));
            ProgramHandler.Instance!.ActivatedStrategies["leaderKorolev"] = 1000d;
            StrategyConfigRP0.Now = 2000d;

            var leader = new Rp1LeadersReflection().Read(2000d)!.Leaders.Single();

            Assert.False(leader.CanAppoint);
            Assert.Equal(1000d + Year, leader.RehireFromUt);
        }

        /// <summary>
        /// The stand-in's subsidy is 10 to 20 funds a day over 0 to 100
        /// reputation, a tenth of a fund a day per point, so 10 points off 50 is
        /// one fund a day.
        /// </summary>
        [Fact]
        public void A_serving_leader_carries_its_dismissal_cost_and_what_it_does_to_subsidy()
        {
            var leader = Leader("leaderKorolev");
            leader.IsActive = true;
            leader.DateActivated = 1000d;
            leader.LeastDuration = 30 * 86400d;
            leader.RemovePenaltyDuration = 10 * Year;
            leader.CostNow = 10d;
            Roster(leader);
            global::Reputation.Instance = new global::Reputation(50f);

            var row = new Rp1LeadersReflection().Read(5000d)!.Leaders.Single();

            Assert.True(row.Active);
            Assert.Equal(10d, row.DeactivateReputation);
            Assert.Equal(1d, row.DismissSubsidyLossPerDay!.Value, 9);
            Assert.Equal(1000d + 30 * 86400d, row.CanRemoveFromUt);
            Assert.Equal(1000d + 10 * Year, row.FreeToRemoveFromUt);
            Assert.Null(row.CanAppoint);
        }

        /// <summary>
        /// Above the reputation where subsidy caps, losing some of the surplus costs
        /// no income, and zero is the answer rather than an absent figure.
        /// </summary>
        [Fact]
        public void A_dismissal_above_the_subsidy_cap_costs_no_income()
        {
            var leader = Leader("leaderKorolev");
            leader.IsActive = true;
            leader.CostNow = 10d;
            Roster(leader);
            global::Reputation.Instance = new global::Reputation(150f);

            var row = new Rp1LeadersReflection().Read(5000d)!.Leaders.Single();

            Assert.Equal(0d, row.DismissSubsidyLossPerDay);
        }

        [Fact]
        public void No_roster_publishes_the_absence()
        {
            Assert.Null(new Rp1LeadersReflection().Read(5000d));
            Assert.Null(Rp1LeadersCapture.BuildLeaders(new Rp1LeadersRaw { Ut = 5000d }));
        }

        [Fact]
        public void Rows_carry_the_wire_names_the_contract_declares()
        {
            var raw = new Rp1LeadersRaw { Ut = 1d, Available = true };
            raw.Leaders.Add(new Rp1LeaderRaw { StrategyId = "leaderKorolev" });

            var row = Rp1LeadersCapture.BuildLeaders(raw)!.Single();

            var declared = typeof(Rp1LeaderEntry).GetProperties()
                .Select(p => char.ToLowerInvariant(p.Name[0]) + p.Name.Substring(1))
                .OrderBy(n => n, StringComparer.Ordinal);
            Assert.Equal(declared, row.Keys.OrderBy(n => n, StringComparer.Ordinal));
        }

        /// <summary>
        /// Appointing lands on the channel the Leaders screen reads, so the press
        /// resolves when rp1.leaders shows the leader serving.
        /// </summary>
        [Fact]
        public void Appoint_resolves_on_rp1_leaders()
        {
            var appoint = new Rp1ScUplink().Manifest.Commands
                .Single(c => c.Command == Rp1StrategyCommands.AppointCommand);

            Assert.Equal(Rp1ScUplink.LeadersTopic, appoint.Subject);
        }

        private static GateVerdict Offered(string id)
        {
            var args = new Dictionary<string, object> { ["strategyId"] = id };
            return new Rp1LeaderActivateGate().Evaluate(Rp1LeaderActivateGate.Requirement(), new GateBag(args));
        }

        private sealed class GateBag : IGateArguments
        {
            private readonly Dictionary<string, object> _values;

            public GateBag(Dictionary<string, object> values) => _values = values;

            public bool TryGet(string path, out object value) => _values.TryGetValue(path, out value!);
        }

        [Fact]
        public void The_activation_gate_refuses_a_leader_in_its_cooldown_with_RP1s_sentence()
        {
            Roster(Leader("leaderKorolev"));
            ProgramHandler.Instance!.ActivatedStrategies["leaderKorolev"] = 1000d;
            StrategyConfigRP0.Now = 2000d;

            var verdict = Offered("leaderKorolev");

            Assert.Equal(GateOutcome.Fail, verdict.Outcome);
            Assert.Equal(CommandErrorCode.NotClearToProceed, verdict.ErrorCode);
            Assert.Contains("re-hired", verdict.Detail);
            Assert.Empty(StrategyCallLog.Calls);
        }

        [Fact]
        public void The_activation_gate_refuses_a_leader_whose_requirements_are_unmet()
        {
            Roster(Leader("leaderGlushko", c => c.Unlocked = false));

            var verdict = Offered("leaderGlushko");

            Assert.Equal(GateOutcome.Fail, verdict.Outcome);
            Assert.Contains("requirements", verdict.Detail);
        }

        [Fact]
        public void The_activation_gate_passes_a_leader_RP1_offers()
        {
            Roster(Leader("leaderKorolev"));

            Assert.Equal(GateOutcome.Pass, Offered("leaderKorolev").Outcome);
        }

        [Fact]
        public void The_activation_gate_leaves_a_Program_and_an_unknown_strategy_to_core()
        {
            Roster(new ProgramStrategy
            {
                Config = new Strategies.StrategyConfig { Name = "earlyOrbital" },
                Program = new Program { name = "earlyOrbital" },
            });

            Assert.Equal(GateOutcome.Pass, Offered("earlyOrbital").Outcome);
            Assert.Equal(GateOutcome.Pass, Offered("nothingByThatName").Outcome);
        }

        [Fact]
        public void The_activation_gate_is_unknown_without_a_strategy_system()
        {
            Strategies.StrategySystem.Instance = null;

            Assert.Equal(GateOutcome.Unknown, Offered("leaderKorolev").Outcome);
        }

    }
}
