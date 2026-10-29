using GonogoKerbalismUplink;
using Sitrep.Contract;

namespace Gonogo.KerbalismUplink
{
    /// <summary>
    /// The real <see cref="IKerbalismDeviceActuator"/>, over Kerbalism's
    /// <c>Computer</c> through <see cref="KerbalismReflection"/>. Runs on the main
    /// thread like every other command handler.
    /// </summary>
    public sealed class KerbalismDeviceActuator : IKerbalismDeviceActuator
    {
        private readonly KerbalismReflection _k;
        private readonly Kernel? _kernel;

        public KerbalismDeviceActuator(KerbalismReflection k, Kernel? kernel = null)
        {
            _k = k;
            _kernel = kernel;
        }

        public CommandResult SetDevice(string deviceId, bool on)
        {
            if (!TryScope(out var v, out var refusal)) return refusal;
            return _k.SetDevice(v!, deviceId, on)
                ? CommandResult.Ok()
                : CommandResult.Fail(KerbalismErrorCodes.NoSuchDevice);
        }

        public CommandResult SetScriptState(string scriptType, string deviceId, bool? state)
        {
            if (!TryScope(out var v, out var refusal)) return refusal;
            return _k.SetScriptState(v!, scriptType, deviceId, state)
                ? CommandResult.Ok()
                : CommandResult.Fail(KerbalismErrorCodes.NoSuchDevice);
        }

        private bool TryScope(out Vessel? v, out CommandResult refusal)
        {
            v = _kernel.ReportedVessel() as Vessel;
            refusal = CommandResult.Ok();
            if (v == null)
            {
                refusal = CommandResult.Fail(CommandErrorCode.NoVessel);
                return false;
            }
            if (!v.loaded)
            {
                refusal = CommandResult.Fail(KerbalismErrorCodes.CraftNotLoaded);
                return false;
            }
            return true;
        }
    }
}
