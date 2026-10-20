using Sitrep.Contract;

namespace Gonogo.KerbalismUplink
{
    /// <summary>
    /// The live-module seam for switching Kerbalism experiments, SCANsat map
    /// scanners and laboratories on and off, the run twin of
    /// <see cref="IKerbalismFileActuator"/>. <see cref="KerbalismScienceBackend"/>
    /// (KSP-free) resolves the target against the latest capture and hands the
    /// resolved ids here; the live implementation reads the module's state at
    /// call time and acts on that, so a press that arrives after the state
    /// moved on is still idempotent.
    ///
    /// <para>Both methods act on the reported vessel and return a
    /// <see cref="CommandResult{T}"/> of <see cref="RunStateChange"/> on
    /// success, or a typed refusal: <see cref="CommandErrorCode.NoVessel"/> with no
    /// vessel, <see cref="CommandErrorCode.NotFound"/> for a part or module that
    /// is no longer there, <see cref="CommandErrorCode.CapabilityMismatch"/> for a
    /// craft with no live control source.</para>
    /// </summary>
    public interface IKerbalismRunActuator
    {
        /// <summary>Switch the experiment or scanner with this id on the part on or off.</summary>
        CommandResult SetExperimentRunning(string partId, string experimentId, bool run);

        /// <summary>Switch the laboratory on the part on or off.</summary>
        CommandResult SetLabRunning(string partId, bool run);
    }
}
