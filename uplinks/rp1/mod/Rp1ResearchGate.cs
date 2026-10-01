// rp1.tech.research, answered per node before the press. The handler's own
// checks (RP-1 queues research here, the node exists and is not yet researched
// or queued, the science balance bears its price, the R&D ceiling allows its
// cost) already run in order and stop short of spending; this gate asks that same
// judge, so a control goes dark with the refusal the press would return.
using System;
using System.Collections.Generic;
using Sitrep.Contract;

namespace GonogoRp1Uplink
{
    /// <summary>
    /// Whether one tech node can be queued for research now.
    /// </summary>
    public sealed class Rp1ResearchGate : ICommandGateEvaluator, ICommandGateItems
    {
        /// <summary>
        /// The requirement kind this answers. Namespaced to this Uplink because a
        /// kind may only be claimed once across the whole engine.
        /// </summary>
        public const string GateKind = "rp1.techResearch";

        /// <summary>The node can be queued: it is researchable and the career can bear its science price.</summary>
        public const string Researchable = "researchable";

        private const string TechIdPath = "techId";

        private readonly Rp1ResearchCommands _research;

        public Rp1ResearchGate(Rp1ResearchCommands research)
        {
            _research = research;
        }

        /// <summary>
        /// The requirement to put on <c>rp1.tech.research</c>. Names
        /// <c>techId</c>, so the engine abstains for the argument-free sample and
        /// asks per node.
        /// </summary>
        public static CommandRequirement Requirement() => new CommandRequirement
        {
            Kind = GateKind,
            Quantity = Researchable,
            Needs = new[] { TechIdPath },
        };

        public string Kind => GateKind;

        public IEnumerable<string> Items(CommandRequirement requirement) => _research.ResearchableNodes();

        public GateVerdict Evaluate(CommandRequirement requirement, IGateArguments arguments)
        {
            var quantity = requirement?.Quantity ?? "";
            if (quantity != Researchable)
            {
                return GateVerdict.Unknown($"RP-1 imposes no research condition called \"{quantity}\"");
            }

            string? techId = null;
            if (arguments != null && arguments.TryGet(TechIdPath, out var value) && value is string text
                && text.Trim().Length > 0)
            {
                techId = text.Trim();
            }
            if (techId == null)
            {
                return GateVerdict.Unknown("no node was named, so RP-1 has nothing to look for");
            }

            try
            {
                var refusal = _research.Judge(techId, out _);
                return refusal == null ? GateVerdict.Pass() : Rp1GateVerdicts.FromRefusal(refusal);
            }
            catch (Exception ex)
            {
                return GateVerdict.Unknown("could not judge the research: " + ex.Message);
            }
        }
    }
}
