using Sitrep.Contract;

namespace Gonogo.KerbalismUplink
{
    /// <summary>
    /// The live seam for switching Kerbalism devices and editing its event
    /// scripts. Both methods act on the craft core reports as the vessel and on
    /// a loaded craft only, since Kerbalism builds its device list for no other.
    /// </summary>
    public interface IKerbalismDeviceActuator
    {
        /// <summary>Switch one device on or off (<c>Device.Ctrl</c>).</summary>
        CommandResult SetDevice(string deviceId, bool on);

        /// <summary>Set the state an event script gives one device, or null to remove the device from the script (<c>Script.Set</c>).</summary>
        CommandResult SetScriptState(string scriptType, string deviceId, bool? state);
    }
}
