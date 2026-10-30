using GonogoKerbalismUplink;
using Sitrep.Contract;

namespace Gonogo.KerbalismUplink
{
    /// <summary>
    /// KSP-free handling of <c>kerbalism.device.set</c> and <c>kerbalism.script.set</c>:
    /// refuses an argument that names nothing before the actuator is reached, and
    /// leaves the live checks (a loaded craft, a device that is still there) to it.
    /// </summary>
    public static class KerbalismDeviceCommandProvider
    {
        public const string DeviceSetCommand = "kerbalism.device.set";
        public const string ScriptSetCommand = "kerbalism.script.set";

        public static CommandResult HandleDeviceSet(IKerbalismDeviceActuator actuator, KerbalismDeviceSetArgs? args)
        {
            if (string.IsNullOrEmpty(args?.DeviceId))
            {
                return CommandResult.Fail(KerbalismErrorCodes.NoSuchDevice);
            }
            return actuator.SetDevice(args!.DeviceId, args.On);
        }

        public static CommandResult HandleScriptSet(IKerbalismDeviceActuator actuator, KerbalismScriptSetArgs? args)
        {
            if (string.IsNullOrEmpty(args?.DeviceId) || string.IsNullOrEmpty(args?.ScriptType))
            {
                return CommandResult.Fail(KerbalismErrorCodes.NoSuchDevice);
            }
            return actuator.SetScriptState(args!.ScriptType, args.DeviceId, args.State);
        }
    }
}
