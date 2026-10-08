#if SITREP_CODEGEN
using Reinforced.Typings.Attributes;
#endif
using Sitrep.Contract;

namespace Gonogo.RealAntennasUplink;

// ====================================================================
// DISH TURNING: a craft that holds a message for a peer it cannot see may turn
// an idle dish to the peer, send, and turn the dish back. These are the
// operator's two handles on it: a switch per craft, and the state of every dish
// that is on loan.
//
// What "idle" means. A dish is only ever borrowed when its own aim carries no
// contact at all, so turning it cannot break a link anyone is using. The turn
// is announced and waits for light already on its way to the dish, so none is
// lost. The network decides all of that; this Uplink turns the dish and puts it
// back, and says what it is doing.
// ====================================================================

/// <summary>
/// Args for <c>realantennas.vessel.setAutoRetarget</c>: whether a craft may turn
/// one of its idle dishes on its own to carry a message it holds.
///
/// <para>Addressed to the craft by id, so it reaches any craft, one on rails
/// included, and it rides that craft's light-time like any other change to what
/// it does on board. Allowed is the default; a craft the operator opts out of
/// never has a dish turned automatically, though other craft may still turn
/// their own dishes toward it. Turning it off while a dish is on loan puts the
/// dish back at once.</para>
/// </summary>
[SitrepContract]
#if SITREP_CODEGEN
[TsInterface]
#endif
[SitrepCommand("realantennas.vessel.setAutoRetarget")]
public class RealAntennasSetAutoRetargetArgs
{
    /// <summary>The craft, by its id as <c>system.vessels</c> gives it (the guid, without the <c>vessel:</c> prefix).</summary>
    [SitrepUnit(Units.Id)]
    public string Vessel { get; set; } = "";

    /// <summary><c>true</c> to let the craft turn an idle dish to carry what it holds, <c>false</c> to stop it.</summary>
    [SitrepUnit(Units.Flag)]
    public bool Allow { get; set; }
}

/// <summary>A dish that is on loan right now: where it is turned to, and what it goes back to.</summary>
[SitrepContract]
#if SITREP_CODEGEN
[TsInterface]
#endif
public class RealAntennasBorrowedDish
{
    /// <summary>The dish, as <c>"vessel:&lt;guid&gt;#&lt;part&gt;/&lt;ordinal&gt;"</c>. The same id the contact plan uses.</summary>
    [SitrepUnit(Units.Id)]
    public string DishId { get; set; } = "";

    /// <summary>The node the dish is turned to, as <c>"vessel:&lt;guid&gt;"</c> or <c>"ground:&lt;name&gt;"</c>.</summary>
    [SitrepUnit(Units.Id)]
    public string PeerId { get; set; } = "";

    /// <summary>The dish's name, the title of the part it is on, for a card that says which dish is borrowed.</summary>
    [SitrepUnit(Units.Text)]
    public string DishName { get; set; } = "";

    /// <summary>When the dish was turned.</summary>
    [SitrepUnit(Units.UniversalTime)]
    public double SinceUt { get; set; }

    /// <summary>What the dish was aimed at before, in RealAntennas' own words. It is turned back to this.</summary>
    [SitrepUnit(Units.Text)]
    public string PreviousAim { get; set; } = "";
}

/// <summary>The most recent loan of a craft that has ended.</summary>
[SitrepContract]
#if SITREP_CODEGEN
[TsInterface]
#endif
public class RealAntennasLastBorrow
{
    /// <summary>The node the dish was turned to.</summary>
    [SitrepUnit(Units.Id)]
    public string PeerId { get; set; } = "";

    /// <summary>When the dish was turned.</summary>
    [SitrepUnit(Units.UniversalTime)]
    public double TurnedUt { get; set; }

    /// <summary>When it ended.</summary>
    [SitrepUnit(Units.UniversalTime)]
    public double EndedUt { get; set; }

    /// <summary>How it ended: <c>restored</c> (put back as it was), <c>taken</c> (the operator aimed it meanwhile and their aim stands) or <c>gone</c> (the dish or its craft no longer exists).</summary>
    [SitrepUnit(Units.Text)]
    public string Outcome { get; set; } = "";
}

/// <summary>
/// One craft's dish turning, an entry of <c>realantennas.retargeting</c>: whether
/// it may turn a dish on its own, which dish of it is on loan, and how the last
/// loan ended. The channel value is a bare ARRAY with an entry for every craft
/// that is opted out, has a dish on loan, or has had one.
///
/// <para>As the reported craft's own delay delivers it: the channel is
/// <c>Delayed</c> and carries the whole fleet, so an entry for another craft is
/// not older or newer than the delay to the reported one makes it.</para>
/// </summary>
[SitrepContract]
#if SITREP_CODEGEN
[TsInterface]
#endif
[SitrepTopic("realantennas.retargeting", isArray: true)]
public class RealAntennasVesselRetargeting
{
    /// <summary>The craft, by its id as <c>system.vessels</c> gives it.</summary>
    [SitrepUnit(Units.Id)]
    public string VesselId { get; set; } = "";

    /// <summary>Whether the craft may turn an idle dish on its own.</summary>
    [SitrepUnit(Units.Flag)]
    public bool Allowed { get; set; }

    /// <summary>The dish on loan now, or <c>null</c> when none is.</summary>
    public RealAntennasBorrowedDish? Borrowed { get; set; }

    /// <summary>The most recent loan that ended, or <c>null</c> when none has.</summary>
    public RealAntennasLastBorrow? Last { get; set; }

    public PayloadMeta Meta { get; set; } = new();
}
