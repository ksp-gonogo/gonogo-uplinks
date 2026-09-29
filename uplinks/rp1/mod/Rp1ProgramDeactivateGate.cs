// Core's career.strategy.deactivate, refused for an RP-1 Program. No
// compile-time reference to RP0.dll, the same arm's-length reflection pattern as
// Rp1ScReflection, whose header carries the provenance rules this file follows.
//
// WHAT WAS WRONG. Core deactivates a strategy with Strategy.Deactivate(), which
// RP-1's Harmony prefix routes to StrategyRP0.DeactivateOverride. For a Program
// that unregisters the strategy and nothing more: RP-1 completes a Program in
// ProgramStrategy.OnUnregister only while ProgramHandler.IsInAdmin is true, and
// that flag is set only by its Administration Building's own window. Seen on the
// rig on 2026-09-29 (RP-1 4.7.0.0): one core deactivate on a completable Program
// left it unregistered, still in ActivePrograms with no completedUT, still paying
// out and holding its slots, with no reputation paid, no leaders unlocked, and no
// control left in RP-1's own screen to complete or re-accept it. A stranded
// Program, permanently, from a single press.
//
// WHY THIS REFUSES RATHER THAN COMPLETING. A deactivate that silently completed
// would be a different act from the one the control offers, with a reputation
// award and leader unlocks the operator did not ask for. The RP-1-native act is
// rp1.program.complete, so the refusal names it. A leader is not refused: its
// dismissal is exactly what DeactivateOverride performs, with RP-1's own
// reputation charge and cooldown.
//
// WHAT IS READ, and why each is safe:
//
//   StrategySystem.Instance.Strategies   the roster Rp1StrategyCommands walks
//   StrategyConfig.Name                  the id every read side publishes
//
// Nothing is invoked and nothing is written. An unreadable roster returns
// Unknown, which the engine treats as a refusal: an unanswerable question leaves
// the deactivate blocked rather than open.
using System;
using Sitrep.Contract;

namespace GonogoRp1Uplink
{
    /// <summary>
    /// Whether core's <c>career.strategy.deactivate</c> may proceed, refusing it
    /// for an RP-1 Program in favour of <c>rp1.program.complete</c>.
    ///
    /// <para>Nothing here touches KSP or Unity, so it compiles and runs headless
    /// against a stand-in object graph.</para>
    /// </summary>
    public sealed class Rp1ProgramDeactivateGate : ICommandGateEvaluator
    {
        /// <summary>
        /// The requirement kind this answers. Namespaced to this Uplink because a
        /// kind may only be claimed once across the whole engine.
        /// </summary>
        public const string GateKind = "rp1.strategyDeactivate";

        /// <summary>The strategy is not an RP-1 Program.</summary>
        public const string NotAProgram = "notAProgram";

        /// <summary>
        /// What an operator reads, as the clause after the control's name. Says
        /// what deactivating would do first, because that is what makes the
        /// refusal make sense, and then the command that closes a Program.
        /// </summary>
        internal const string Detail =
            "RP-1 closes a Program by completing it. Deactivating one only unregisters it, leaving it "
            + "running, paying out and holding its slots with no way back in RP-1's own screen. "
            + "Use rp1.program.complete";

        private readonly Type? _programStrategy;

        public Rp1ProgramDeactivateGate()
        {
            _programStrategy = Rp1Types.Find(Rp1StrategyWrites.ProgramStrategyTypeName);
        }

        /// <summary>
        /// RP-1's Program strategy type resolved. False means the requirement is
        /// not contributed at all, and core's deactivate keeps exactly the
        /// requirements core declares.
        /// </summary>
        public bool IsAvailable => _programStrategy != null;

        /// <summary>
        /// The requirement to contribute to <c>career.strategy.deactivate</c>.
        /// </summary>
        /// <remarks>
        /// Names <c>strategyId</c> in <see cref="CommandRequirement.Needs"/>:
        /// whether a strategy is a Program is a property of the strategy, so the
        /// engine abstains for the argument-free sample and asks at the press.
        /// </remarks>
        public static CommandRequirement Requirement() => new CommandRequirement
        {
            Kind = GateKind,
            Quantity = NotAProgram,
            Needs = new[] { "strategyId" },
        };

        public string Kind => GateKind;

        public GateVerdict Evaluate(CommandRequirement requirement, IGateArguments arguments)
        {
            var quantity = requirement?.Quantity ?? "";
            if (quantity != NotAProgram)
            {
                return GateVerdict.Unknown($"RP-1 imposes no deactivation condition called \"{quantity}\"");
            }

            string? id = null;
            if (arguments != null && arguments.TryGet("strategyId", out var value) && value is string text
                && text.Trim().Length > 0)
            {
                id = text.Trim();
            }
            if (id == null)
            {
                // Unreachable while the requirement declares its Needs, and
                // Unknown rather than Pass if it ever is.
                return GateVerdict.Unknown("the deactivate named no strategy, so RP-1 has nothing to look for");
            }

            var type = Rp1Types.Find("Strategies.StrategySystem");
            var system = type == null ? null : Rp1Types.StaticValue(type, "Instance");
            if (system == null)
            {
                return GateVerdict.Unknown("there is no strategy system to look the strategy up in");
            }

            foreach (var candidate in Rp1Types.Enumerate(Rp1Types.Member(system, "Strategies")))
            {
                var name = Rp1Types.ReadString(Rp1Types.Member(candidate, "Config"), "Name")
                    ?? Rp1Types.ReadString(candidate, "Title");
                if (!string.Equals(name, id, StringComparison.OrdinalIgnoreCase))
                {
                    continue;
                }
                return Rp1StrategyWrites.IsProgramStrategy(candidate, _programStrategy)
                    ? GateVerdict.Fail(CommandErrorCode.ModeUnavailable, Detail)
                    : GateVerdict.Pass();
            }

            // No such strategy: core's own lookup answers that with NotFound, in
            // its own words, so this gate has nothing to add.
            return GateVerdict.Pass();
        }
    }
}
