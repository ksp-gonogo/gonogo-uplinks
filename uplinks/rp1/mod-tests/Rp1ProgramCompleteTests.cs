// What rp1.program.complete must do, and the gate that keeps core's deactivate
// off a Program.
//
// The defect both exist for is one of OMISSION, seen on the rig: a Program's
// strategy deactivated outside the Administration Building is unregistered and
// never completed, and the press reports success. So the command's tests assert
// the call log (deactivate, then complete, exactly once each) rather than only
// the result, and the gate's tests assert that a Program is refused while a
// leader, whose dismissal is exactly that deactivate, is not.
//
// Rp0Fixture's header states what fixture-backed tests cannot prove, and it holds
// here: a rename on RP-1's side is Rp1ReflectionTargets' job, against the shipped
// binary.
using System;
using System.Collections.Generic;
using GonogoRp1Uplink;
using RP0.Programs;
using Sitrep.Contract;
using Xunit;

namespace GonogoRp1Uplink.Tests
{
    public class Rp1ProgramCompleteTests : IDisposable
    {
        private readonly Rp1StrategyCommands _commands = new Rp1StrategyCommands();
        private readonly Rp1ProgramDeactivateGate _gate = new Rp1ProgramDeactivateGate();

        public Rp1ProgramCompleteTests() => Reset();

        public void Dispose() => Reset();

        private static void Reset()
        {
            Strategies.StrategySystem.Instance = null;
            ProgramHandler.Instance = null;
            StrategyCallLog.Reset();
        }

        /// <summary>A career running one Program, accepted and listed as RP-1 lists it.</summary>
        private static ProgramStrategy Running(bool canComplete = true, bool inAdmin = false)
        {
            var program = new Program { name = "earlyOrbital", acceptedUT = 100.0, CanComplete = canComplete };
            var strategy = new ProgramStrategy
            {
                Config = new Strategies.StrategyConfig { Name = "earlyOrbital", Title = "Early Orbital" },
                Program = program,
                IsActive = true,
            };
            var handler = new ProgramHandler { IsInAdmin = inAdmin };
            handler.ActivePrograms.Add(program);
            ProgramHandler.Instance = handler;
            Seed(strategy);
            return strategy;
        }

        private static void Seed(params Strategies.Strategy[] strategies)
        {
            var system = new Strategies.StrategySystem();
            system.Strategies.AddRange(strategies);
            Strategies.StrategySystem.Instance = system;
        }

        private CommandResult Complete(string id = "earlyOrbital") =>
            _commands.Complete(new Rp1ProgramCompleteArgs { StrategyId = id });

        [Fact]
        public void Outside_the_building_it_deactivates_then_completes_then_clears_the_deadline_alarm()
        {
            var strategy = Running();

            var result = Complete();

            Assert.True(result.Success);
            Assert.Equal(
                new[] { "DeactivateOverride", "CompleteProgram", "DeleteAlarms:Early Orbital" },
                StrategyCallLog.Calls);
            Assert.False(strategy.IsActive);
            Assert.Empty(ProgramHandler.Instance!.ActivePrograms);
            Assert.Same(strategy.Program, Assert.Single(ProgramHandler.Instance.CompletedPrograms));
        }

        /// <summary>
        /// Unreachable on the rig (game time is frozen with the building open, so
        /// no command settles), and still not a double completion if it ever is.
        /// </summary>
        [Fact]
        public void With_the_building_open_RP1_completes_it_and_the_command_does_not_again()
        {
            Running(inAdmin: true);

            var result = Complete();

            Assert.True(result.Success);
            Assert.Single(StrategyCallLog.Calls, "CompleteProgram");
            Assert.Single(ProgramHandler.Instance!.CompletedPrograms);
        }

        [Fact]
        public void Unmet_objectives_refuse_in_RP1s_own_words_and_write_nothing()
        {
            var strategy = Running(canComplete: false);

            var result = Complete();

            Assert.False(result.Success);
            Assert.Equal(CommandErrorCode.NotClearToProceed, result.ErrorCode);
            Assert.Equal("This Program has unmet objectives.", result.Detail);
            Assert.Empty(StrategyCallLog.Calls);
            Assert.True(strategy.IsActive);
            Assert.Single(ProgramHandler.Instance!.ActivePrograms);
        }

        [Fact]
        public void A_leader_is_refused_because_there_is_nothing_to_complete()
        {
            Running();
            var leader = new RP0.StrategyRP0
            {
                Config = new Strategies.StrategyConfig { Name = "leaderKorolev", Title = "Korolev" },
                IsActive = true,
            };
            Strategies.StrategySystem.Instance!.Strategies.Add(leader);

            var result = Complete("leaderKorolev");

            Assert.False(result.Success);
            Assert.Equal(CommandErrorCode.WrongState, result.ErrorCode);
            Assert.True(leader.IsActive);
            Assert.Empty(StrategyCallLog.Calls);
        }

        [Fact]
        public void A_Program_not_running_is_refused()
        {
            var strategy = Running();
            strategy.IsActive = false;

            var result = Complete();

            Assert.False(result.Success);
            Assert.Equal(CommandErrorCode.WrongState, result.ErrorCode);
            Assert.Empty(StrategyCallLog.Calls);
        }

        [Fact]
        public void No_program_handler_refuses_before_anything_is_written()
        {
            var strategy = Running();
            ProgramHandler.Instance = null;

            var result = Complete();

            Assert.False(result.Success);
            Assert.Equal(CommandErrorCode.NotClearToProceed, result.ErrorCode);
            Assert.True(strategy.IsActive);
            Assert.Empty(StrategyCallLog.Calls);
        }

        [Fact]
        public void An_unknown_id_is_not_found()
        {
            Running();

            var result = Complete("noSuchProgram");

            Assert.False(result.Success);
            Assert.Equal(CommandErrorCode.NotFound, result.ErrorCode);
        }

        // ── The gate on core's career.strategy.deactivate ────────────────────

        private sealed class Args : IGateArguments
        {
            private readonly Dictionary<string, object> _values = new Dictionary<string, object>(StringComparer.Ordinal);

            public static Args Of(string strategyId)
            {
                var args = new Args();
                args._values["strategyId"] = strategyId;
                return args;
            }

            public bool TryGet(string path, out object value) => _values.TryGetValue(path, out value!);
        }

        private GateVerdict Ask(string strategyId) =>
            _gate.Evaluate(Rp1ProgramDeactivateGate.Requirement(), Args.Of(strategyId));

        [Fact]
        public void The_gate_refuses_core_deactivate_on_a_Program_and_names_the_command_that_completes_it()
        {
            Running();

            var verdict = Ask("earlyOrbital");

            Assert.Equal(GateOutcome.Fail, verdict.Outcome);
            Assert.Equal(CommandErrorCode.ModeUnavailable, verdict.ErrorCode);
            Assert.Contains("rp1.program.complete", verdict.Detail);
            Assert.Empty(StrategyCallLog.Calls);
        }

        [Fact]
        public void The_gate_passes_a_leader_whose_dismissal_is_that_deactivate()
        {
            Seed(new RP0.StrategyRP0
            {
                Config = new Strategies.StrategyConfig { Name = "leaderKorolev", Title = "Korolev" },
                IsActive = true,
            });

            Assert.Equal(GateOutcome.Pass, Ask("leaderKorolev").Outcome);
        }

        [Fact]
        public void The_gate_leaves_an_unknown_id_to_cores_own_not_found()
        {
            Running();

            Assert.Equal(GateOutcome.Pass, Ask("noSuchStrategy").Outcome);
        }

        [Fact]
        public void The_gate_refuses_when_there_is_no_roster_to_look_in()
        {
            Assert.Equal(GateOutcome.Unknown, Ask("earlyOrbital").Outcome);
        }

        [Fact]
        public void The_requirement_needs_the_strategy_id_so_the_engine_asks_it_only_at_the_press()
        {
            var requirement = Rp1ProgramDeactivateGate.Requirement();

            Assert.Equal(Rp1ProgramDeactivateGate.GateKind, requirement.Kind);
            Assert.Equal(new[] { "strategyId" }, requirement.Needs);
            Assert.True(_gate.IsAvailable);
        }
    }
}
