using Sitrep.Contract;

namespace Gonogo.KerbcastUplink
{
    /// <summary>
    /// What kerbcast's answer to <c>SetFov</c>/<c>SetPan</c> means on the wire.
    ///
    /// <para>Carved out of <see cref="KerbcastUplink"/> for the same reason
    /// <see cref="KerbcastHealth"/> and <see cref="SidecarDeathDebouncer"/>
    /// were: the uplink itself only compiles against a live KSP, and the
    /// mapping from a mod's refusal to an error code is exactly the sort of
    /// decision an operator reads and so deserves headless tests.</para>
    /// </summary>
    public static class KerbcastAimOutcome
    {
        /// <summary>
        /// False is kerbcast's OWN refusal, and it refuses when the camera id
        /// does not resolve, so <c>NotFound</c> is honest for it.
        ///
        /// <para>Null is the call never having been made (it threw), which is a
        /// fact about a different thing: answering <c>NotFound</c> would tell the
        /// operator their vessel has no camera with that id while they watched
        /// it stream. <c>ModeUnavailable</c> is the code that says the command
        /// cannot be carried out here, which is what happened.</para>
        /// </summary>
        public static CommandResult For(bool? kerbcastAccepted)
        {
            if (kerbcastAccepted == null)
            {
                return CommandResult.Fail(CommandErrorCode.ModeUnavailable);
            }
            return kerbcastAccepted.Value
                ? CommandResult.Ok()
                : CommandResult.Fail(CommandErrorCode.NotFound);
        }
    }
}
