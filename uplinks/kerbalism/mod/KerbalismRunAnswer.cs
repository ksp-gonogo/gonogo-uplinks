using GonogoKerbalismUplink;
using Sitrep.Contract;

namespace Gonogo.KerbalismUplink
{
    /// <summary>
    /// Turns what a live switch did (<see cref="RunSwitchRaw"/>) into the command
    /// answer: a <see cref="CommandResult{T}"/> of <see cref="RunStateChange"/>
    /// for a switch that happened or was already in place, a typed refusal for
    /// the rest. KSP-free, so the mapping is tested without a vessel.
    /// </summary>
    public static class KerbalismRunAnswer
    {
        /// <summary>
        /// Names the mechanism, as the stock science commands do for the same
        /// condition: Kerbalism refuses to switch an experiment when the craft
        /// has no live control source.
        /// </summary>
        public const string NoControlSource =
            "this craft has no live control source, so Kerbalism will not switch its experiments";

        public static CommandResult From(RunSwitchRaw raw)
        {
            switch (raw.Outcome)
            {
                case RunSwitchOutcome.Switched:
                    return CommandResult<RunStateChange>.Ok(new RunStateChange { Changed = true, Running = raw.Running });
                case RunSwitchOutcome.AlreadyThere:
                    return CommandResult<RunStateChange>.Ok(new RunStateChange { Changed = false, Running = raw.Running });
                case RunSwitchOutcome.NotControllable:
                    return CommandResult.Fail(CommandErrorCode.CapabilityMismatch, NoControlSource);
                case RunSwitchOutcome.NotSwitched:
                    return CommandResult.Fail(KerbalismErrorCodes.ExperimentNotSwitched);
                default:
                    return CommandResult.Fail(CommandErrorCode.NotFound);
            }
        }
    }
}
