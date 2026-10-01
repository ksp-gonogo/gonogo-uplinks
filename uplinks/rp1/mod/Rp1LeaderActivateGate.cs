// Core's career.strategy.activate, refused for an RP-1 leader RP-1 would not
// offer. No compile-time reference to RP0.dll, the same arm's-length reflection
// pattern as Rp1ScReflection, whose header carries the provenance rules this file
// follows.
//
// RP-1 keeps three rules outside the stock CanBeActivated: the leader's
// requirements are met, it is not in a re-hire cooldown after a dismissal, and it
// was not dismissed for good. Its Administration screen applies them by leaving
// such a leader off the list, so a core activation that names one by id walks
// past all three. Rp1LeadersReflection.AppointVerdict is the one place that
// asks them, shared with rp1.leader.appoint and the roster's canAppoint.
//
// Core already samples career.strategy.activate once per strategy and evaluates
// every contributed requirement for it, so this gate needs no item source of its
// own: naming strategyId in Needs is what puts it in that pass.
//
// Nothing is invoked that writes. An unreadable roster returns Unknown, which the
// engine treats as a refusal.
using System;
using Sitrep.Contract;

namespace GonogoRp1Uplink
{
    /// <summary>
    /// Whether RP-1 offers the named leader for appointment, as the clause core's
    /// activation gate cannot know.
    /// </summary>
    public sealed class Rp1LeaderActivateGate : ICommandGateEvaluator
    {
        /// <summary>
        /// The requirement kind this answers. Namespaced to this Uplink because a
        /// kind may only be claimed once across the whole engine.
        /// </summary>
        public const string GateKind = "rp1.leaderOffered";

        /// <summary>RP-1 offers this leader: requirements met, no cooldown running, not dismissed for good.</summary>
        public const string Offered = "offered";

        private const string StrategyIdPath = "strategyId";

        private readonly Type? _programStrategy;
        private readonly Type? _programHandler;

        public Rp1LeaderActivateGate()
        {
            _programStrategy = Rp1Types.Find(Rp1StrategyWrites.ProgramStrategyTypeName);
            _programHandler = Rp1Types.Find(Rp1StrategyWrites.ProgramHandlerTypeName);
        }

        /// <summary>
        /// RP-1's Program and handler types resolved. False means the requirement
        /// is not contributed at all and core's activation keeps exactly the
        /// requirements core declares.
        /// </summary>
        public bool IsAvailable => _programStrategy != null && _programHandler != null;

        /// <summary>
        /// The requirement to contribute to <c>career.strategy.activate</c>.
        /// Names <c>strategyId</c>: whether a leader is offered is a property of
        /// the leader, so the engine abstains for the argument-free sample and
        /// asks per strategy.
        /// </summary>
        public static CommandRequirement Requirement() => new CommandRequirement
        {
            Kind = GateKind,
            Quantity = Offered,
            Needs = new[] { StrategyIdPath },
        };

        public string Kind => GateKind;

        public GateVerdict Evaluate(CommandRequirement requirement, IGateArguments arguments)
        {
            var quantity = requirement?.Quantity ?? "";
            if (quantity != Offered)
            {
                return GateVerdict.Unknown($"RP-1 imposes no activation condition called \"{quantity}\"");
            }

            string? id = null;
            if (arguments != null && arguments.TryGet(StrategyIdPath, out var value) && value is string text
                && text.Trim().Length > 0)
            {
                id = text.Trim();
            }
            if (id == null)
            {
                return GateVerdict.Unknown("the activation named no strategy, so RP-1 has nothing to look for");
            }

            try
            {
                var system = Rp1StrategyCommands.StrategySystemInstance();
                if (system == null)
                {
                    return GateVerdict.Unknown("there is no strategy system to look the strategy up in");
                }
                if (!Rp1StrategyCommands.TryFindStrategy(system, id, out var strategy))
                {
                    // Core's own lookup answers an unknown strategy with NotFound.
                    return GateVerdict.Pass();
                }
                if (Rp1StrategyWrites.IsProgramStrategy(strategy, _programStrategy)
                    || Rp1Types.ReadBool(strategy, "IsActive") == true)
                {
                    // A Program is priced by its speed, which the activation does not
                    // carry, and an active strategy is core's own refusal to make.
                    return GateVerdict.Pass();
                }

                var handler = Rp1Types.StaticValue(_programHandler!, "Instance");
                var verdict = Rp1LeadersReflection.AppointVerdict(strategy, handler);
                return verdict.Refusal == null
                    ? GateVerdict.Pass()
                    : GateVerdict.Fail(CommandErrorCode.NotClearToProceed, verdict.Refusal);
            }
            catch (Exception ex)
            {
                return GateVerdict.Unknown("could not judge the leader: " + Rp1Types.ExceptionReason(ex));
            }
        }
    }
}
