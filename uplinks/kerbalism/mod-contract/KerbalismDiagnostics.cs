using System.Collections.Generic;
using Sitrep.Contract;
#if SITREP_CODEGEN
using Reinforced.Typings.Attributes;
#endif

namespace GonogoKerbalismUplink;

/// <summary>
/// What Kerbalism's own automation and log windows show for the craft: the devices
/// its computer can switch, the event scripts that act on them, and the most recent
/// messages in its log. Published on <c>kerbalism.diagnostics</c>.
///
/// <para>Each list is null when Kerbalism could not be asked, which is not the same
/// as empty: a craft that is not loaded has no devices to read, and an empty list
/// says there are none.</para>
/// </summary>
[SitrepContract]
#if SITREP_CODEGEN
[TsInterface]
#endif
[SitrepTopic("kerbalism.diagnostics")]
public class KerbalismDiagnostics
{
    /// <summary>The craft's switchable devices in the order Kerbalism lists them. Null while the craft is not loaded.</summary>
    public IReadOnlyList<KerbalismDevice>? Devices { get; set; }

    /// <summary>The event scripts that act on at least one device. Null while the craft is not loaded.</summary>
    public IReadOnlyList<KerbalismScript>? Scripts { get; set; }

    /// <summary>Kerbalism's message log, newest first.</summary>
    public IReadOnlyList<KerbalismLogEntry>? Log { get; set; }
}

/// <summary>One device the Kerbalism computer can switch.</summary>
[SitrepContract]
#if SITREP_CODEGEN
[TsInterface]
#endif
public class KerbalismDevice
{
    /// <summary>Kerbalism's id for the device, the key an event script refers to it by.</summary>
    [SitrepUnit(Units.Text)]
    public string? Id { get; set; }

    /// <summary>The name Kerbalism lists the device under.</summary>
    [SitrepUnit(Units.Text)]
    public string? Name { get; set; }

    /// <summary>The part the device belongs to.</summary>
    [SitrepUnit(Units.Text)]
    public string? PartName { get; set; }

    /// <summary>The device's state in Kerbalism's own words, with its colouring removed ("on", "off", "always on").</summary>
    [SitrepUnit(Units.Text)]
    public string? Status { get; set; }
}

/// <summary>One event script and how many devices it sets.</summary>
[SitrepContract]
#if SITREP_CODEGEN
[TsInterface]
#endif
public class KerbalismScript
{
    /// <summary>Kerbalism's name for the event: <c>sunlight</c>, <c>shadow</c>, <c>power_low</c>, <c>landed</c> and so on.</summary>
    [SitrepUnit(Units.Enumeration)]
    public string? Type { get; set; }

    /// <summary>How many devices the script switches when the event happens.</summary>
    [SitrepUnit(Units.Count)]
    public int? DeviceCount { get; set; }

    /// <summary>What the script sets each of its devices to when the event happens.</summary>
    public IReadOnlyList<KerbalismScriptState>? States { get; set; }
}

/// <summary>The state one event script gives one device.</summary>
[SitrepContract]
#if SITREP_CODEGEN
[TsInterface]
#endif
public class KerbalismScriptState
{
    /// <summary>The device, by the id <c>kerbalism.diagnostics</c> lists it under.</summary>
    [SitrepUnit(Units.Id)]
    public string? DeviceId { get; set; }

    /// <summary>Whether the script switches the device on, rather than off.</summary>
    [SitrepUnit(Units.Flag)]
    public bool? On { get; set; }
}

/// <summary>One message in Kerbalism's log.</summary>
[SitrepContract]
#if SITREP_CODEGEN
[TsInterface]
#endif
public class KerbalismLogEntry
{
    /// <summary>
    /// <c>relax</c>, <c>warning</c>, <c>danger</c>, <c>fatality</c>, <c>breakdown</c> or
    /// <c>alert</c> (a message posted with no severity). Null when the title could
    /// not be matched to one of those.
    /// </summary>
    [SitrepUnit(Units.Enumeration)]
    public string? Level { get; set; }

    /// <summary>The message text, with Kerbalism's formatting removed.</summary>
    [SitrepUnit(Units.Text)]
    public string? Message { get; set; }
}
