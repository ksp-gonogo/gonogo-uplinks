using Sitrep.Contract;
#if SITREP_CODEGEN
using Reinforced.Typings.Attributes;
#endif

namespace GonogoKerbalismUplink;

/// <summary>
/// Switch one device on or off, as Kerbalism's own automation window does. The
/// device is addressed by the id <c>kerbalism.diagnostics</c> lists it under.
/// <see cref="On"/> is the state to set rather than a flip from the current one,
/// so a repeated or reordered dispatch lands in the same place.
/// </summary>
[SitrepContract]
#if SITREP_CODEGEN
[TsInterface]
#endif
[SitrepCommand("kerbalism.device.set")]
public class KerbalismDeviceSetArgs
{
    /// <summary>The device, by the id <c>kerbalism.diagnostics</c> gives it.</summary>
    [SitrepUnit(Units.Id)]
    public string DeviceId { get; set; } = "";

    /// <summary>Whether the device should be on.</summary>
    [SitrepUnit(Units.Flag)]
    public bool On { get; set; }
}

/// <summary>
/// Set what one event script does to one device when its event happens: switch
/// it on, switch it off, or leave it out of the script. The craft must be
/// loaded, since Kerbalism lists devices for a loaded craft only.
/// </summary>
[SitrepContract]
#if SITREP_CODEGEN
[TsInterface]
#endif
[SitrepCommand("kerbalism.script.set")]
public class KerbalismScriptSetArgs
{
    /// <summary>The event, by the name <c>kerbalism.diagnostics</c> gives the script: <c>sunlight</c>, <c>power_low</c> and so on.</summary>
    [SitrepUnit(Units.Enumeration)]
    public string ScriptType { get; set; } = "";

    /// <summary>The device, by the id <c>kerbalism.diagnostics</c> gives it.</summary>
    [SitrepUnit(Units.Id)]
    public string DeviceId { get; set; } = "";

    /// <summary>The state the script sets the device to, or null to take the device out of the script.</summary>
    [SitrepUnit(Units.Flag)]
    public bool? State { get; set; }
}
