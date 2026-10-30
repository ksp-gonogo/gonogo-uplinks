using System;
using Sitrep.Contract;

namespace Gonogo.ContractConfiguratorUplink
{
    /// <summary>What the hook on a Contract Configurator objective's state change does with it.</summary>
    internal enum HoldAction
    {
        /// <summary>Let the game make the change now.</summary>
        LetThrough,

        /// <summary>Make no change and put nothing on the line.</summary>
        Skip,

        /// <summary>Put the change on the delay line.</summary>
        Hold,
    }

    /// <summary>Everything the decision reads, gathered by the hook so the decision itself touches no game type.</summary>
    internal sealed class HoldFacts
    {
        public ObjectiveState Target { get; set; }

        /// <summary>The objective's state at home, or null when it is in none of the three.</summary>
        public ObjectiveState? Current { get; set; }

        /// <summary>The objective's own enabled flag; the game ignores a state change on a disabled one.</summary>
        public bool Enabled { get; set; }

        /// <summary>Whether Contract Configurator would accept a move to Met now, in its sequence and duration rules.</summary>
        public bool ReadyToComplete { get; set; }

        /// <summary>Whether the objective is Contract Configurator's Timer.</summary>
        public bool IsTimer { get; set; }

        /// <summary>The Timer's end time, or null when it has not started.</summary>
        public double? TimerEndUt { get; set; }

        /// <summary>The craft whose action caused the change, or empty when none did.</summary>
        public string SourceVesselId { get; set; } = "";

        /// <summary>The target of the objective's latest change still on the line, or null when it has none.</summary>
        public ObjectiveState? PendingTarget { get; set; }
    }

    internal static class ObjectiveHoldPolicy
    {
        /// <param name="heldAtOrBefore">Whether the line holds a change for the contract stamped at or before a universal time.</param>
        public static HoldAction Decide(HoldFacts facts, Func<double, bool> heldAtOrBefore)
        {
            if (!facts.Enabled)
            {
                return HoldAction.LetThrough;
            }

            if (facts.IsTimer)
            {
                // A Timer's failure is the clock running out, not something a craft did.
                // It waits while word of anything the craft did before the end is still on its way.
                return facts.Target == ObjectiveState.Failed
                    && facts.Current != ObjectiveState.Failed
                    && facts.TimerEndUt is double end
                    && heldAtOrBefore(end)
                        ? HoldAction.Skip
                        : HoldAction.LetThrough;
            }

            if (facts.PendingTarget is ObjectiveState pending)
            {
                if (pending == facts.Target)
                {
                    return HoldAction.Skip;
                }
            }
            else if (facts.Current == facts.Target)
            {
                return HoldAction.LetThrough;
            }

            if (facts.Target == ObjectiveState.Met && !facts.ReadyToComplete)
            {
                return HoldAction.LetThrough;
            }

            return facts.SourceVesselId.Length == 0 ? HoldAction.LetThrough : HoldAction.Hold;
        }
    }
}
