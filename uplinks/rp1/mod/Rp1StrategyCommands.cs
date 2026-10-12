// Committing to a strategy from outside the Administration Building.
//
// WHAT WAS WRONG. On a live RP-1 career the console lists 97 strategies (60
// leader configs plus 37 generated program ones) and can appoint NONE of them:
// every entry carries canActivate absent with "KSP answers this only while the
// Administration Building is open". That is honest, and it is the whole feature
// missing. Stock's Strategy.CanBeActivated dereferences Administration.Instance
// in its first statement, Strategy.Activate calls CanBeActivated, so both throw
// with the screen shut.
//
// WHAT THIS DOES INSTEAD. StrategyRP0.ActivateOverride is gate-plus-procedure
// and nothing else, and PerformActivate is public, non-virtual and never asks
// CanBeActivated. So we ask the arms that do not need the screen, then call the
// procedure. The UI-dependent arm is never asked rather than answered, and
// nothing here reproduces a rule the game would have applied.
//
// See Rp1StrategyWrites for the rule this obeys, the reason the program half is
// hoisted rather than bypassed, and the provenance of every member.
//
// THE TWO ARMS WE CANNOT ASK, and why that is honest rather than a hole:
//
//   Arm 1 is the concurrent-strategy cap, and it is the one the screen owns.
//   Under RP-1 it is a DEAD ARM for leaders: PatchStrategy zeroes the count
//   stock compares, precisely so leaders are exempt, and the real cap for
//   programs lives at arm 8 which we DO ask. Under stock it is a live rule we
//   cannot evaluate, so a stock career refuses with that named as the reason
//   rather than being guessed at.
//
//   Arm 3 is the commit-level ceiling. GameVariables.GetStrategyCommitRange is
//   the same method Administration.Start reads it from and is public and
//   VIRTUAL, so calling through GameVariables.Instance inherits a retiering
//   mod's override where reimplementing the thresholds would not. We ask it.
//
// EVERY OTHER ARM IS THE GAME'S OWN. Conflicts, the three affordability checks,
// the reputation floor, the strategy's own CanActivate and each effect's
// CanActivate are all invoked on the live objects. Arm 9 in particular executes
// third-party code, so a throw there refuses rather than proceeding: an
// unanswerable question leaves the commitment unmade.
using System;
using System.Collections.Generic;
using System.Reflection;
using Sitrep.Contract;

namespace GonogoRp1Uplink
{
    /// <summary>
    /// <c>rp1.program.accept</c> and <c>rp1.leader.appoint</c>: commit to a
    /// Program at a chosen speed, or to a leader, without the Administration
    /// Building. <c>rp1.program.complete</c>: close a running program the way the
    /// building's own dialog does.
    /// </summary>
    public sealed class Rp1StrategyCommands
    {
        /// <summary>Accept a Program at the speed the operator chose.</summary>
        public const string AcceptCommand = "rp1.program.accept";

        /// <summary>Appoint a leader.</summary>
        public const string AppointCommand = "rp1.leader.appoint";

        /// <summary>Complete a running Program, which is how RP-1 closes one.</summary>
        public const string CompleteCommand = "rp1.program.complete";

        private const string ScmTypeName = "RP0.SpaceCenterManagement";

        private readonly Type? _scm;
        private readonly Type? _strategyRp0;
        private readonly Type? _programStrategy;
        private readonly Type? _programHandler;

        public Rp1StrategyCommands()
        {
            _scm = Rp1Types.Find(ScmTypeName);
            _strategyRp0 = Rp1Types.Find(Rp1StrategyWrites.StrategyRp0TypeName);
            _programStrategy = Rp1Types.Find(Rp1StrategyWrites.ProgramStrategyTypeName);
            _programHandler = Rp1Types.Find(Rp1StrategyWrites.ProgramHandlerTypeName);
        }

        /// <summary>
        /// The command can run: RP-1's space centre and its three strategy types
        /// resolved.
        ///
        /// <para>TYPES ONLY, for the reason
        /// <see cref="Rp1PersonnelCommands.IsAvailable"/> spells out: a
        /// method-level gate on the manifest cannot say why it fired, because a
        /// command that was never declared looks exactly like one nobody wrote.
        /// The method lookups happen at the press and refuse with a sentence
        /// naming what was not recognised.</para>
        /// </summary>
        public bool IsAvailable =>
            _scm != null && _strategyRp0 != null && _programStrategy != null && _programHandler != null;

        /// <summary>
        /// Whether the members this command invokes resolved, as a sentence for a
        /// health fact.
        /// </summary>
        public string MethodDiagnosis()
        {
            if (!IsAvailable) return "RP-1 strategy types not found";
            var scm = _scm == null ? null : Rp1Types.StaticValue(_scm, "Instance");
            if (scm == null) return "RP-1 space centre is not loaded; activation will refuse at the press";
            return "every resolved type is present; member lookups happen at the press";
        }

        /// <summary>
        /// Accept the named Program at the named speed.
        ///
        /// <para>NOT a set. Accepting is a one-way act that spends Confidence and
        /// starts a term, so a repeat is refused rather than treated as already
        /// satisfied, unlike <c>rp1.personnel.assign</c>.</para>
        ///
        /// <para>The speed is written with RP-1's own <c>Program.SetSpeed</c>, the
        /// call its Administration Building's speed buttons make, BEFORE the gate
        /// is asked: <c>ProgramStrategy.CanActivate</c> prices Confidence at the
        /// Program's current speed, so asking first would judge the wrong price.
        /// It is put back on any refusal, because the speed is persisted.</para>
        /// </summary>
        public CommandResult Accept(Rp1ProgramAcceptArgs? args)
        {
            var speed = args?.Speed?.Trim();
            if (string.IsNullOrEmpty(speed))
            {
                return CommandResult.Fail(
                    CommandErrorCode.NotClearToProceed,
                    "no speed was named, and the speed sets the Confidence price and the term");
            }
            if (Array.IndexOf(Rp1ProgramSpeeds.All, speed) < 0)
            {
                return CommandResult.Fail(
                    CommandErrorCode.NotClearToProceed,
                    $"\"{speed}\" is not a Program speed; RP-1 offers {string.Join(", ", Rp1ProgramSpeeds.All)}");
            }

            var found = Resolve(args?.StrategyId, out var system, out var strategy, out var handler);
            if (found != null) return found;

            if (!Rp1StrategyWrites.IsProgramStrategy(strategy, _programStrategy))
            {
                return CommandResult.Fail(
                    CommandErrorCode.WrongState,
                    $"\"{args!.StrategyId!.Trim()}\" is a leader rather than a Program; appoint it with {AppointCommand}");
            }

            /*
             * Read, never assumed. With the screen open PerformActivate's own
             * Register() performs the program half itself, so performing it here
             * as well accepts twice: two Accept()s, two Confidence charges, a
             * duplicate ActivePrograms entry and a restarted funding schedule. The
             * remote console is exactly the case where the screen may be open.
             *
             * Absent is not false. A flag we could not read leaves us unable to
             * tell which half the game will perform, and guessing either way risks
             * a double charge or a program that is active but never accepted.
             */
            var inAdmin = Rp1StrategyWrites.IsInAdmin(handler);
            if (inAdmin == null)
            {
                return CommandResult.Fail(
                    CommandErrorCode.NotClearToProceed,
                    "cannot tell whether the Administration Building is open, and a program would be accepted twice if it is");
            }

            var program = Rp1StrategyWrites.Program(strategy);
            if (program == null)
            {
                return CommandResult.Fail(CommandErrorCode.WrongState, "the program this strategy carries could not be read");
            }
            var previous = Rp1Types.Member(program, Rp1StrategyWrites.SpeedField);
            var setSpeed = Rp1StrategyWrites.SetSpeed(program);
            if (previous == null || !previous.GetType().IsEnum || setSpeed == null)
            {
                return CommandResult.Fail(
                    CommandErrorCode.ModeUnavailable,
                    "RP-1's Program.SetSpeed(Program.Speed) or the speed it sets was not recognised");
            }
            if (!Enum.IsDefined(previous.GetType(), speed!))
            {
                return CommandResult.Fail(
                    CommandErrorCode.ModeUnavailable,
                    $"this RP-1 has no Program speed called \"{speed}\"");
            }

            try
            {
                setSpeed.Invoke(program, new[] { Enum.Parse(previous.GetType(), speed!) });
            }
            catch (Exception ex)
            {
                return CommandResult.Fail(
                    CommandErrorCode.NotClearToProceed,
                    "RP-1 threw while setting the Program's speed: " + Rp1Types.ExceptionReason(ex));
            }
            void PutSpeedBack()
            {
                try
                {
                    setSpeed.Invoke(program, new[] { previous });
                }
                catch (Exception)
                {
                    // fail-soft: the refusal is the answer either way
                }
            }
            // Read back, because SetSpeed is silent: RP-1 ignores it on a Program
            // already accepted or completed, and a speed that did not take would
            // be accepted at a price nobody chose.
            if (Rp1Types.ReadEnumName(program, Rp1StrategyWrites.SpeedField) != speed)
            {
                PutSpeedBack();
                return CommandResult.Fail(CommandErrorCode.WrongState, "RP-1 would not take the speed for this Program");
            }

            var gate = Refusal(system, strategy, null);
            if (gate != null)
            {
                PutSpeedBack();
                return gate;
            }

            var result = Commit(strategy, handler, true, inAdmin == true, null);
            if (!result.Success) PutSpeedBack();
            return result;
        }

        /// <summary>
        /// Appoint the named leader.
        ///
        /// <para>NOT a set, for the reason <see cref="Accept"/> gives: a repeat is
        /// refused rather than treated as already satisfied.</para>
        /// </summary>
        public CommandResult Appoint(Rp1LeaderAppointArgs? args)
        {
            var found = Resolve(args?.StrategyId, out var system, out var strategy, out var handler);
            if (found != null) return found;

            if (Rp1StrategyWrites.IsProgramStrategy(strategy, _programStrategy))
            {
                return CommandResult.Fail(
                    CommandErrorCode.WrongState,
                    $"\"{args!.StrategyId!.Trim()}\" is a Program rather than a leader; accept it with {AcceptCommand} and a speed");
            }

            /*
             * The rules RP-1 keeps outside CanBeActivated: requirements met, not
             * in a re-hire cooldown, not dismissed for good. Its Administration
             * screen applies them by leaving such a leader off the list, so the
             * press here is the only place left to apply them.
             */
            var offered = Rp1LeadersReflection.AppointVerdict(strategy, handler);
            if (offered.Refusal != null)
            {
                return CommandResult.Fail(CommandErrorCode.NotClearToProceed, offered.Refusal);
            }

            var gate = Refusal(system, strategy, args?.Factor);
            if (gate != null) return gate;

            return Commit(strategy, handler, false, false, args?.Factor);
        }

        /// <summary>
        /// The lookup and the preconditions both commitments share, returning the
        /// refusal or null with the strategy, its system and the program handler
        /// resolved.
        /// </summary>
        private CommandResult? Resolve(string? id, out object system, out object strategy, out object handler)
        {
            system = null!;
            strategy = null!;
            handler = null!;
            if (string.IsNullOrWhiteSpace(id))
            {
                return CommandResult.Fail(CommandErrorCode.NotFound, "no strategy was named");
            }
            if (!IsAvailable)
            {
                return CommandResult.Fail(CommandErrorCode.ModeUnavailable, "RP-1 strategy types are not present");
            }

            var found = StrategySystemInstance();
            if (found == null)
            {
                return CommandResult.Fail(CommandErrorCode.CareerModeRequired, "there is no strategy system");
            }
            system = found;

            if (!TryFindStrategy(system, id!.Trim(), out strategy))
            {
                return CommandResult.Fail(CommandErrorCode.NotFound, $"no strategy is named \"{id}\"");
            }
            if (Rp1Types.ReadBool(strategy, "IsActive") == true)
            {
                return CommandResult.Fail(CommandErrorCode.WrongState, "the strategy is already active");
            }

            /*
             * Precondition: the singletons PerformActivate dereferences without a
             * guard, checked BEFORE anything is written and refused on rather than
             * discovered. PerformActivate calls RecalculateBuildRates() and
             * OnLeaderChange() AFTER isActive, Register() and the currency charge,
             * so a null there is a half-completed activation and no refusal to
             * restore from. This is what makes the command safe in a scene we have
             * not tested: we decline to enter a procedure whose preconditions we
             * cannot see hold, rather than needing to know which scenes hold them.
             */
            var scm = _scm == null ? null : Rp1Types.StaticValue(_scm, "Instance");
            if (scm == null)
            {
                return CommandResult.Fail(
                    CommandErrorCode.NotClearToProceed,
                    "RP-1's space centre is not loaded, and committing needs it to recalculate build rates");
            }
            var programHandler = _programHandler == null ? null : Rp1Types.StaticValue(_programHandler, "Instance");
            if (programHandler == null)
            {
                return CommandResult.Fail(
                    CommandErrorCode.NotClearToProceed,
                    "RP-1's program handler is not loaded, and committing needs it to record the change");
            }
            handler = programHandler;
            return null;
        }

        /// <summary>
        /// The arms of <c>CanBeActivated</c> that do not need the Administration
        /// screen, asked on the live objects rather than reproduced.
        /// </summary>
        /// <remarks>
        /// Returns the refusal, or null to proceed. A throw anywhere here refuses:
        /// arms 8 and 9 execute third-party code, and an unanswerable question
        /// must leave the commitment unmade rather than fall through to a spend.
        /// </remarks>
        private CommandResult? Refusal(object system, object strategy, double? factor)
        {
            try
            {
                var conflicts = Invoke(system, "HasConflictingActiveStrategies", 1, Rp1Types.Member(strategy, "GroupTags"));
                if (conflicts is bool clash && clash)
                {
                    return CommandResult.Fail(
                        CommandErrorCode.NotClearToProceed,
                        "another active strategy conflicts with this one");
                }

                var ceiling = CommitCeiling();
                var wanted = factor ?? Rp1Types.ReadDouble(strategy, "Factor");
                if (ceiling != null && wanted == null)
                {
                    // A commitment level nobody could read is not a commitment of
                    // nothing, which is what a substituted zero says and which
                    // clears every ceiling there is. An unreadable ceiling still
                    // permits, as it always has: that is no known limit rather
                    // than a known limit nothing can be checked against.
                    return CommandResult.Fail(
                        CommandErrorCode.NotClearToProceed,
                        "RP-1 would not say what commitment level this strategy carries, and the"
                        + " Administration Building caps it, so it was not activated");
                }
                if (ceiling != null && wanted > ceiling.Value)
                {
                    return CommandResult.Fail(
                        CommandErrorCode.NotClearToProceed,
                        $"the Administration Building allows a commitment of at most {ceiling.Value * 100.0:0.#}%");
                }

                var reason = StrategyRefusal(strategy);
                if (reason != null)
                {
                    return CommandResult.Fail(CommandErrorCode.NotClearToProceed, reason);
                }
            }
            catch (Exception ex)
            {
                return CommandResult.Fail(
                    CommandErrorCode.NotClearToProceed,
                    "RP-1 threw while judging eligibility: " + Rp1Types.ExceptionReason(ex));
            }
            return null;
        }

        /// <summary>
        /// The strategy's own <c>CanActivate</c>, which is arm 8 and where RP-1
        /// puts the real program slot cap, plus each effect's, which is arm 9.
        /// </summary>
        /// <remarks>
        /// Arm 8 is the reason a program is gated at all off-screen: RP-1's
        /// <c>ProgramStrategy.CanActivate</c> checks
        /// <c>MaxProgramSlots - ActiveProgramSlots</c> and needs no
        /// <c>Administration</c>. Skipping it would move the corrupted-career risk
        /// rather than remove it.
        /// </remarks>
        private static string? StrategyRefusal(object strategy)
        {
            var refusal = AskCanActivate(strategy);
            if (refusal != null) return refusal;

            /*
             * Arm 9, and it is open-ended: StrategyEffect.CanActivate is virtual,
             * so any mod's effect can refuse for a reason we cannot enumerate. We
             * ask each one rather than reproducing what they check.
             *
             * The semantics are "refuse if ANY effect refuses". Worth stating,
             * because the decompiler renders this loop INVERTED: its C# reads
             * `if (effects[i].CanActivate(ref reason)) return false;`, i.e.
             * refuse when an effect says it CAN. The IL disagrees. At IL_02ac the
             * callvirt is followed by `brtrue.s` continuing the loop, and the
             * fall-through is `ldc.i4.0; ret`. KSP ships a control-flow
             * obfuscator whose dead switch blocks break branch reconstruction,
             * and it inverted this loop while getting the sibling call twelve
             * lines earlier right.
             */
            foreach (var effect in Rp1Types.Enumerate(Rp1Types.Member(strategy, "Effects")))
            {
                var said = AskCanActivate(effect);
                if (said != null) return said;
            }
            return null;
        }

        /// <summary>
        /// One <c>CanActivate(ref string)</c> call, on a strategy or on one of
        /// its effects, returning the game's own words or null to proceed.
        /// </summary>
        private static string? AskCanActivate(object? target)
        {
            if (target == null) return null;
            var method = Rp1Types.InstanceMethod(target, "CanActivate", 1);
            if (method == null) return null;
            var argv = new object?[] { "" };
            var ok = method.Invoke(target, argv);
            if (ok is bool allowed && !allowed)
            {
                var said = argv[0] as string;
                return string.IsNullOrWhiteSpace(said) ? "RP-1 refused the commitment" : said!;
            }
            return null;
        }

        /// <summary>
        /// <c>GameVariables.GetStrategyCommitRange</c> at the Administration
        /// Building's level: arm 3's ceiling, from the source
        /// <c>Administration.Start</c> caches rather than from the screen.
        /// </summary>
        /// <remarks>
        /// Null when it cannot be read, which skips the arm rather than refusing:
        /// the ceiling is a ceiling, and the strategy's own default factor is
        /// already inside it. A commitment ABOVE it is refused by arm 8 or by the
        /// game at the next opportunity.
        /// </remarks>
        private static double? CommitCeiling()
        {
            var vars = GameVariablesInstance();
            if (vars == null) return null;
            var level = AdministrationLevel();
            if (level == null) return null;
            var method = Rp1Types.InstanceMethod(vars, "GetStrategyCommitRange", 1);
            return method == null ? null : Rp1Types.ToDouble(method.Invoke(vars, new object?[] { level.Value }));
        }

        private static object? GameVariablesInstance()
        {
            var t = Rp1Types.Find("GameVariables");
            return t == null ? null : Rp1Types.StaticValue(t, "Instance");
        }

        private static float? AdministrationLevel()
        {
            var t = Rp1Types.Find("ScenarioUpgradeableFacilities");
            if (t == null) return null;
            var facility = Rp1Types.Find("SpaceCenterFacility");
            if (facility == null) return null;
            var admin = Enum.Parse(facility, "Administration");
            var method = Rp1Types.StaticMethod(t, "GetFacilityLevel", 1);
            var value = method?.Invoke(null, new[] { admin });
            return value is float f ? f : (float?)null;
        }

        /// <summary>
        /// The commitment itself, in the order the in-screen path performs it.
        /// </summary>
        /// <remarks>
        /// <para><b>The program half runs FIRST.</b> In-screen, ActivateProgram
        /// runs inside Register(), which is step 2 of PerformActivate, before its
        /// alarm block. That block mints a KAC alarm from
        /// <c>programStrategy.Program.deadlineUT</c>, and Accept() assigns
        /// deadlineUT on the instance it RETURNS rather than on the template. So
        /// performing PerformActivate first leaves the template in place and the
        /// alarm is created at UT 0, silently, with nothing thrown.</para>
        ///
        /// <para><b>And only when the game will not perform it itself.</b> With
        /// the Administration screen open, Register()'s own OnRegister does the
        /// program half, so doing it here as well accepts twice.</para>
        ///
        /// <para><b>Factor is written before the gate and restored on a
        /// refusal</b>, because Strategy.Factor is a plain persisted setter: a
        /// refused activation that left it written would change the commitment
        /// level on the save with nothing to show for it.</para>
        /// </remarks>
        private CommandResult Commit(object strategy, object handler, bool isProgram, bool inAdmin, double? factor)
        {
            var previous = Rp1Types.ReadDouble(strategy, "Factor");
            if (factor.HasValue && !Rp1Types.WriteDouble(strategy, "Factor", factor.Value))
            {
                return CommandResult.Fail(CommandErrorCode.ModeUnavailable, "RP-1 would not take a commitment level");
            }

            try
            {
                if (isProgram && !inAdmin)
                {
                    var program = Rp1StrategyWrites.Program(strategy);
                    if (program == null)
                    {
                        Restore(strategy, factor, previous);
                        return CommandResult.Fail(CommandErrorCode.WrongState, "the program this strategy carries could not be read");
                    }
                    var activate = Rp1StrategyWrites.ActivateProgram(handler);
                    if (activate == null)
                    {
                        Restore(strategy, factor, previous);
                        return CommandResult.Fail(
                            CommandErrorCode.ModeUnavailable,
                            "RP-1's ProgramHandler.ActivateProgram(Program) was not recognised");
                    }
                    activate.Invoke(handler, new[] { program });
                }

                var perform = Rp1StrategyWrites.PerformActivate(strategy);
                if (perform == null)
                {
                    Restore(strategy, factor, previous);
                    return CommandResult.Fail(
                        CommandErrorCode.ModeUnavailable,
                        "RP-1's StrategyRP0.PerformActivate(bool) was not recognised");
                }
                perform.Invoke(strategy, new object?[] { true });
            }
            catch (Exception ex)
            {
                /*
                 * No restore here, deliberately. Past the first invoke the game
                 * may hold state we did not write and cannot unwind, so putting
                 * Factor back would describe a rollback that did not happen. Say
                 * what was attempted instead.
                 */
                throw new CommandFaultException(
                    FaultCode.CommandUnavailable,
                    "RP-1 threw while committing, and the career may be part-way through it: "
                        + Rp1Types.ExceptionReason(ex));
            }

            return CommandResult.Ok();
        }

        /// <summary>
        /// Complete a running Program: the strategy's deactivation and
        /// <c>ProgramHandler.CompleteProgram</c>, which RP-1 performs together
        /// only from its Administration Building's confirm dialog.
        /// </summary>
        /// <remarks>
        /// <para>RP-1 completes a Program inside <c>ProgramStrategy.OnUnregister</c>
        /// and only while <c>ProgramHandler.IsInAdmin</c> is true, so deactivating
        /// the strategy anywhere else unregisters it and nothing more: the
        /// Program stays in <c>ActivePrograms</c>, keeps paying, holds its slots,
        /// and RP-1's own screen then offers no way to complete or re-accept it.
        /// Seen on the rig on 2026-09-29 through core's
        /// <c>career.strategy.deactivate</c>, which is why that command is gated
        /// off Programs (<see cref="Rp1ProgramDeactivateGate"/>) and this one
        /// exists.</para>
        ///
        /// <para>The order is RP-1's own dialog's: deactivate, then complete, then
        /// clear the deadline alarm. It cannot run the other way round, because
        /// <c>ProgramStrategy.CanDeactivate</c> requires <c>CanComplete</c> and a
        /// completed Program no longer answers it.</para>
        ///
        /// <para>Every member is resolved and <c>CanBeDeactivated</c> is asked
        /// before anything is written, so a refusal or an unrecognised member
        /// leaves the career as it was. <c>IsInAdmin</c> is read first, as on the
        /// accept side, and <c>CompleteProgram</c> is skipped only when RP-1's own
        /// <c>OnUnregister</c> has already completed the Program; a command
        /// arriving while the building is open settles nothing anyway, because
        /// game time is frozen there.</para>
        /// </remarks>
        public CommandResult Complete(Rp1ProgramCompleteArgs? args)
        {
            var id = args?.StrategyId;
            if (string.IsNullOrWhiteSpace(id))
            {
                return CommandResult.Fail(CommandErrorCode.NotFound, "no Program was named");
            }
            if (!IsAvailable)
            {
                return CommandResult.Fail(CommandErrorCode.ModeUnavailable, "RP-1 strategy types are not present");
            }

            var system = StrategySystemInstance();
            if (system == null)
            {
                return CommandResult.Fail(CommandErrorCode.CareerModeRequired, "there is no strategy system");
            }
            if (!TryFindStrategy(system, id!, out var strategy))
            {
                return CommandResult.Fail(CommandErrorCode.NotFound, $"no strategy is named \"{id}\"");
            }
            if (!Rp1StrategyWrites.IsProgramStrategy(strategy, _programStrategy))
            {
                return CommandResult.Fail(
                    CommandErrorCode.WrongState,
                    $"\"{id}\" is a leader rather than a Program, so there is nothing to complete");
            }
            if (Rp1Types.ReadBool(strategy, "IsActive") != true)
            {
                return CommandResult.Fail(CommandErrorCode.WrongState, "the Program is not running");
            }

            var handler = _programHandler == null ? null : Rp1Types.StaticValue(_programHandler, "Instance");
            if (handler == null)
            {
                return CommandResult.Fail(
                    CommandErrorCode.NotClearToProceed,
                    "RP-1's program handler is not loaded, and completing needs it to record the change");
            }
            var inAdmin = Rp1StrategyWrites.IsInAdmin(handler);
            if (inAdmin == null)
            {
                return CommandResult.Fail(
                    CommandErrorCode.NotClearToProceed,
                    "cannot tell whether the Administration Building is open, and a Program would be completed twice if it is");
            }

            var program = Rp1StrategyWrites.Program(strategy);
            if (program == null)
            {
                return CommandResult.Fail(CommandErrorCode.WrongState, "the Program this strategy carries could not be read");
            }
            var ask = Rp1StrategyWrites.CanBeDeactivated(strategy);
            var deactivate = Rp1StrategyWrites.DeactivateOverride(strategy);
            var complete = Rp1StrategyWrites.CompleteProgram(handler);
            if (ask == null || deactivate == null || complete == null)
            {
                return CommandResult.Fail(
                    CommandErrorCode.ModeUnavailable,
                    "RP-1's " + (ask == null
                        ? "Strategy.CanBeDeactivated(out string)"
                        : deactivate == null
                            ? "StrategyRP0.DeactivateOverride()"
                            : "ProgramHandler.CompleteProgram(Program)") + " was not recognised");
            }

            try
            {
                var argv = new object?[] { null };
                if (!(ask.Invoke(strategy, argv) is bool allowed) || !allowed)
                {
                    var said = argv[0] as string;
                    return CommandResult.Fail(
                        CommandErrorCode.NotClearToProceed,
                        string.IsNullOrWhiteSpace(said) ? "RP-1 refused to complete the Program" : said!);
                }
            }
            catch (Exception ex)
            {
                return CommandResult.Fail(
                    CommandErrorCode.NotClearToProceed,
                    "RP-1 threw while judging whether the Program can be completed: " + Rp1Types.ExceptionReason(ex));
            }

            try
            {
                if (!(deactivate.Invoke(strategy, Array.Empty<object?>()) is bool closed) || !closed)
                {
                    return CommandResult.Fail(CommandErrorCode.NotClearToProceed, "RP-1 refused to complete the Program");
                }
                if (Rp1Types.ReadBool(program, "IsComplete") != true)
                {
                    complete.Invoke(handler, new[] { program });
                }
            }
            catch (Exception ex)
            {
                // Past DeactivateOverride the strategy is unregistered, so name
                // the state the career may be left in rather than a rollback.
                throw new CommandFaultException(
                    FaultCode.CommandUnavailable,
                    "RP-1 threw while completing, and the Program may be unregistered without being completed: "
                        + Rp1Types.ExceptionReason(ex));
            }

            ClearDeadlineAlarm(strategy);
            return CommandResult.Ok();
        }

        /// <summary>
        /// The alarm clean-up RP-1's own Complete confirm performs. Best effort:
        /// the Program is already complete, and a leftover alarm is not a reason
        /// to report that it is not.
        /// </summary>
        private static void ClearDeadlineAlarm(object strategy)
        {
            try
            {
                var title = Rp1Types.ReadString(strategy, "Title");
                var delete = Rp1StrategyWrites.DeleteAlarmsWithTitle();
                if (!string.IsNullOrEmpty(title) && delete != null)
                {
                    delete.Invoke(null, new object?[] { title, false });
                }
            }
            catch (Exception)
            {
                // fail-soft: see the summary
            }
        }

        private static void Restore(object strategy, double? factor, double? previous)
        {
            if (factor.HasValue && previous.HasValue)
            {
                Rp1Types.WriteDouble(strategy, "Factor", previous.Value);
            }
        }

        internal static object? StrategySystemInstance()
        {
            var t = Rp1Types.Find("Strategies.StrategySystem");
            return t == null ? null : Rp1Types.StaticValue(t, "Instance");
        }

        internal static bool TryFindStrategy(object system, string id, out object strategy)
        {
            foreach (var candidate in Rp1Types.Enumerate(Rp1Types.Member(system, "Strategies")))
            {
                // Strategy carries no Name of its own: KSP's type exposes Config,
                // DepartmentName, Department, Title, Description and GroupTags,
                // and the id every read side publishes is StrategyConfig.Name.
                // Reading "Name" off the Strategy therefore missed, and the old
                // fallback read Config - a StrategyConfig, not a string - through
                // a safe cast that always answered null, so the comparison was
                // null against the id for every candidate and the lookup could
                // never match any strategy at all.
                var name = Rp1Types.ReadString(Rp1Types.Member(candidate, "Config"), "Name")
                    ?? Rp1Types.ReadString(candidate, "Title");
                if (string.Equals(name, id, StringComparison.OrdinalIgnoreCase))
                {
                    strategy = candidate;
                    return true;
                }
            }
            strategy = null!;
            return false;
        }

        private static object? Invoke(object target, string name, int arity, params object?[] argv)
        {
            var method = Rp1Types.InstanceMethod(target, name, arity);
            return method?.Invoke(target, argv);
        }
    }
}
