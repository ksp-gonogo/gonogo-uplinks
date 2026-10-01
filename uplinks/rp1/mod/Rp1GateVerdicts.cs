using Sitrep.Contract;

namespace GonogoRp1Uplink
{
    /// <summary>
    /// A command handler's refusal restated as a gate verdict, for a gate that
    /// asks the handler's own judge instead of restating its rules.
    /// </summary>
    internal static class Rp1GateVerdicts
    {
        /// <summary>
        /// An unreadable answer stays unknown, which the engine treats as a
        /// refusal; every other refusal keeps its code, evidence and sentence.
        /// </summary>
        public static GateVerdict FromRefusal(CommandResult refusal)
        {
            var code = refusal.ErrorCode ?? CommandErrorCode.ModeUnavailable;
            if (code.Root == CommandErrorCode.Unreadable)
            {
                return GateVerdict.Unknown(refusal.Detail ?? "");
            }
            return new GateVerdict
            {
                Outcome = GateOutcome.Fail,
                ErrorCode = code,
                Breach = refusal.Breach,
                Detail = refusal.Detail ?? "",
            };
        }
    }
}
