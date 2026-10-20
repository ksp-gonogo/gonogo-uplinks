using GonogoKerbalismUplink;
using Sitrep.Contract;

namespace Gonogo.KerbalismUplink
{
    /// <summary>
    /// The real <see cref="IKerbalismRunActuator"/>: switches the live Kerbalism
    /// module through <see cref="KerbalismReflection"/>, on the Unity main thread
    /// (<c>ChannelEngine</c> marshals every command handler there, the guarantee
    /// <see cref="KerbalismFileActuator"/> relies on).
    ///
    /// <para>The reported vessel is resolved per call, as for the file verbs, so
    /// an EVA does not retarget a press at the kerbal.</para>
    /// </summary>
    public sealed class KerbalismRunActuator : IKerbalismRunActuator
    {
        private readonly KerbalismReflection _k;
        private readonly Kernel? _kernel;

        public KerbalismRunActuator(KerbalismReflection k, Kernel? kernel = null)
        {
            _k = k;
            _kernel = kernel;
        }

        private Vessel? ScopedVessel() => _kernel.ReportedVessel() as Vessel;

        public CommandResult SetExperimentRunning(string partId, string experimentId, bool run)
        {
            var vessel = ScopedVessel();
            if (vessel == null) return CommandResult.Fail(CommandErrorCode.NoVessel);
            return KerbalismRunAnswer.From(_k.SwitchExperiment(vessel, partId, experimentId, run));
        }

        public CommandResult SetLabRunning(string partId, bool run)
        {
            var vessel = ScopedVessel();
            if (vessel == null) return CommandResult.Fail(CommandErrorCode.NoVessel);
            return KerbalismRunAnswer.From(_k.SwitchLab(vessel, partId, run));
        }
    }
}
