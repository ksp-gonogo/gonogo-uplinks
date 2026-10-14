#if SITREP_CODEGEN
using Reinforced.Typings.Attributes;
#endif
using Sitrep.Contract;

namespace Gonogo.RealAntennasUplink;

// ====================================================================
// The RealAntennas-ONLY half of the comms.* wire contract, extracted from
// mod/Sitrep.Contract/Comms.cs (uplink-types-out-of-core plan, seventh and
// last step). The shared half stays there, and the split is not arbitrary:
// Comms.cs's own header describes a PROVIDER axis, where the elected backend
// (stock CommNet, or this Uplink's RaCommsBackend) sources the shared
// channels, and a private set only this Uplink can source. These are
// that private set, declared in RealAntennasUplink.Manifest and published by
// RealAntennasUplink.HandleOnCourier: nothing else in the mod can produce
// them, and without this Uplink installed they simply never emit.
//
// TRUE-NOW like every other comms.* channel: they describe the link AS KSC
// SEES IT, computed ground-side.
//
// R7 discipline, inherited unchanged: every payload carries PayloadMeta;
// absence is a nullable (T?), never a NaN/0/-1 sentinel.
//
// RaWire flattens these payloads producer-side (the self-flattening pattern
// the rest of this codebase's publishers use), so core's serializer does not
// need to know these types exist.
// ====================================================================

/// <summary>
/// The <c>comms.dataRate</c> payload: RealAntennas-ONLY. Bidirectional link
/// data rate in bits/sec, read live per-hop off the RA CommNet graph
/// (comms-uplink-design.md §4.3: "reachable cleanly").
/// </summary>
[SitrepContract]
#if SITREP_CODEGEN
[TsInterface]
#endif
[SitrepTopic("comms.dataRate")]
public class CommsDataRate
{
    [SitrepUnit(Units.BitsPerSecond)]
    public double UpBitsPerSec { get; set; }
    [SitrepUnit(Units.BitsPerSecond)]
    public double DownBitsPerSec { get; set; }
    public PayloadMeta Meta { get; set; } = new();
}

/// <summary>
/// The <c>comms.linkMargin</c> payload, RealAntennas only: how many decibels of
/// received power the active craft's first link could lose before RealAntennas
/// stops carrying it, so it is 0 or more, to within rounding, while the link is up and a figure near
/// 0 says the link is close to failing. Useful for showing the operator how
/// near the link is to dropping when <c>comms.signal</c> still reads full
/// strength.
///
/// <para>The margin is for the pair of antennas the link runs on, at the slowest
/// symbol rate both can run, with the pointing loss of each towards the other as
/// RealAntennas applies it. A link that has stepped down to a slower rate than
/// its antennas' top rate still reads a margin of 0 or more: the rate it has
/// stepped down to is on <c>comms.dataRate</c>. It is worked out from
/// RealAntennas' link-budget formulas, not read off a field the game keeps, and
/// takes no account of noise from a body behind the far end.</para>
///
/// <para>Carries the margin, whether the link closes, and the margin normalised
/// to a 0..1 quality, published together or not at all.</para>
/// </summary>
[SitrepContract]
#if SITREP_CODEGEN
[TsInterface]
#endif
[SitrepTopic("comms.linkMargin")]
public class CommsLinkMargin
{
    [SitrepUnit(Units.Decibels)]
    public double DecibelMargin { get; set; }
    [SitrepUnit(Units.Flag)]
    public bool ClosesLink { get; set; }

    /// <summary>
    /// <see cref="DecibelMargin"/> normalised onto 0..1: 0 at or below
    /// -20 dB of margin, 1 at or above +20 dB, linear between, and 0 when the
    /// link is down. A display figure for a signal-strength bar, not a
    /// measurement.
    /// </summary>
    [SitrepUnit(Units.Ratio)]
    public double Quality { get; set; }

    public PayloadMeta Meta { get; set; } = new();
}

/// <summary>
/// RealAntennas' namespace of a <c>CommsHop</c>'s provider extension bag: the
/// per-hop RA facts core's shared <c>CommsHop</c> shape does not (and should
/// not) declare, carried under the provider id <c>"realantennas"</c> and typed
/// here rather than in core (see <c>Sitrep.Contract/ProviderExtensions.cs</c>
/// for the mechanism, and a sibling Uplink's reliability extension for the
/// exemplar).
///
/// <para>On a RealAntennas install the hop's <c>strength</c> on <c>comms.path</c>
/// is the strength of the best antenna pairing between the two ends at the
/// distance the hop crosses, as if both ends were pointed at each other and with
/// no noise from a body behind the far end, and the facts in this bag are the
/// ones of that pairing. It is a planned figure for the pair, not what the game
/// currently gives the link: a dish aimed away from the far end, or sky noise,
/// lowers <c>comms.signal</c> and leaves the hop's strength where it was.
/// <c>comms.linkMargin</c> is the figure that follows the aim.</para>
///
/// <para>It rides <c>comms.path</c>, which is already the TrueNow geometry
/// SignalDelay consumes, so every field here is TrueNow like the rest of the
/// comms family: these are properties of the link KSC is computing right now,
/// several of them (data rate) parallel to the delay computation, so
/// delay-gating them would be circular.</para>
///
/// <para>Every field is nullable: absent under bare CommNet (the vanilla
/// backend leaves the whole bag null), and individually absent when a
/// particular RA read fails, the same typed-absence posture as the rest of this
/// slice. Read client-side through <c>readRealAntennasHopExt</c>, never by
/// reaching into <c>hop.extensions?.realantennas</c> and casting.</para>
/// </summary>
[SitrepContract]
#if SITREP_CODEGEN
[TsInterface]
#endif
public class RealAntennasHopExt
{
    /// <summary>RF band the hop is on (L/S/X/K): <c>RealAntenna.RFBand.name</c>.</summary>
    [SitrepUnit(Units.Text)]
    public string? Band { get; set; }

    /// <summary>Antenna tech level (0..9): the progression axis behind the rate ceiling.</summary>
    [SitrepUnit(Units.Count)]
    public int? TechLevel { get; set; }

    /// <summary>Negotiated modulation order: shows the link stepping down under a thin margin.</summary>
    [SitrepUnit(Units.Count)]
    public int? ModulationBits { get; set; }

    /// <summary>Active FEC encoder name (e.g. "Reed-Solomon 255/223", "Turbo 1/2").</summary>
    [SitrepUnit(Units.Text)]
    public string? Encoder { get; set; }

    /// <summary>Encoder coding rate (0..1): the FEC overhead the rate already includes.</summary>
    [SitrepUnit(Units.Ratio)]
    public double? CodingRate { get; set; }

    /// <summary>Required Eb/N0 (dB) to close the link at this encoder: RA's own figure.</summary>
    [SitrepUnit(Units.Decibels)]
    public double? RequiredEbN0 { get; set; }

    /// <summary>Dish beamwidth (degrees): pointing tightness/sensitivity.</summary>
    [SitrepUnit(Units.Degrees)]
    public double? Beamwidth { get; set; }

    /// <summary>Transmit electric-charge draw (units/s): the comms power cost of this hop.</summary>
    [SitrepUnit(Units.ResourceUnitsPerSecond)]
    public double? PowerDrawEc { get; set; }

    /// <summary>
    /// Reverse-direction throughput (bits/sec): the opposite of the forward rate
    /// this Uplink publishes on <c>realantennas.hopRates</c>, off the same live
    /// RACommLink. The backend only surfaced the forward direction before.
    /// </summary>
    [SitrepUnit(Units.BitsPerSecond)]
    public double? ReverseBitsPerSec { get; set; }
}

/// <summary>
/// One entry of the <c>realantennas.hopRates</c> channel: the RealAntennas
/// forward band rate for a single hop, keyed by the same node ids
/// <c>comms.path</c> already carries (<c>RaCommsBackend.NodeId(link.a)</c>/
/// <c>NodeId(link.b)</c>), so a client can join a rate onto the route the core
/// schedule already renders without this Uplink republishing the topology.
///
/// <para>RealAntennas' relay graph subclasses stock CommNet's
/// (<c>RACommNode : CommNet.CommNode</c>, <c>RACommLink : CommNet.CommLink</c>),
/// so the hop set and its node ids are identical to <c>comms.path</c>'s: this
/// channel only embellishes each existing hop with its bitrate, it never
/// re-derives the path. The channel value is a bare array of these entries
/// (one per hop that has a readable rate), self-flattened at the publish
/// boundary by <c>RaWire.HopRates</c> the same way this Uplink's other channels
/// flatten, so core's serializer never needs to know the type exists.</para>
///
/// <para>TRUE-NOW like the rest of the comms family: it describes the link as
/// KSC sees it, computed ground-side. Absent entirely without RealAntennas
/// installed (this Uplink is not even elected), and a hop whose rate cannot be
/// read this tick simply yields no entry, never a 0 sentinel.</para>
/// </summary>
[SitrepContract]
#if SITREP_CODEGEN
[TsInterface]
#endif
[SitrepTopic("realantennas.hopRates", isArray: true)]
public class RealAntennasHopRate
{
    /// <summary>The hop's source node id, identical to the matching <c>CommsHop.From</c>.</summary>
    [SitrepUnit(Units.Id)]
    public string FromNodeId { get; set; } = "";

    /// <summary>The hop's destination node id, identical to the matching <c>CommsHop.To</c>.</summary>
    [SitrepUnit(Units.Id)]
    public string ToNodeId { get; set; } = "";

    /// <summary>Forward band rate (bits/sec) for this hop, off the live RACommLink.</summary>
    [SitrepUnit(Units.BitsPerSecond)]
    public double BitsPerSec { get; set; }
}
