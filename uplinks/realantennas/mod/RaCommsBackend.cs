using System;
using System.Collections.Generic;
using CommNet;
using Sitrep.Contract;

namespace Gonogo.RealAntennasUplink
{
    /// <summary>
    /// The RealAntennas <see cref="ICommsBackend"/>: the higher-priority
    /// backend elected for the exclusive <c>"comms"</c> capability when RA is
    /// loaded (comms-uplink-design.md §2.2). Connectivity/strength/control-state
    /// and hop GEOMETRY come from the SAME stock CommNet graph CommNet uses
    /// (§4.3: <c>RACommLink : CommNet.CommLink</c>, <c>RACommNode : CommNet.CommNode</c>,
    /// so <c>precisePosition</c>/<c>ControlPath</c> are stock reads under either
    /// backend): NO RA reflection is needed for those. The one RA-specific
    /// enrichment here is the per-hop <c>Extensions["realantennas"]</c> bag (band,
    /// tech level, modulation, reverse rate, ...), read via
    /// <see cref="RaReflection"/> off the live RACommLink. The FORWARD band rate is
    /// no longer set on the hop: it rides this Uplink's own
    /// <c>realantennas.hopRates</c> channel instead, keyed by the same
    /// <see cref="NodeId"/>s these hops carry.
    ///
    /// <para>Main-thread only (live KSP reads), called from the RA uplink's
    /// capture-on-main sampler.</para>
    /// </summary>
    public sealed class RaCommsBackend : CommsBackendBase, ICommsContactModel, ICommsPathStrength, ICommsRetargetBackend
    {
        public const string Id = "realantennas";

        private readonly RaReflection _ra;
        private readonly Kernel? _kernel;
        private readonly RaRetargetRegister? _retargets;
        private readonly Func<RaDishTurner?>? _turner;

        /// <summary>
        /// Every node's antennas as the last capture read them, by plan id, for the
        /// retarget model to answer questions about a peer. Written on the main
        /// thread during a capture and read by the planner after it, so it is a
        /// concurrent map; a value is replaced whole and never edited.
        /// </summary>
        private readonly System.Collections.Concurrent.ConcurrentDictionary<string, IReadOnlyList<RaPlannedAntenna>> _rosterAntennas =
            new System.Collections.Concurrent.ConcurrentDictionary<string, IReadOnlyList<RaPlannedAntenna>>(StringComparer.Ordinal);

        /// <summary>The antennas read at one instant, so the many pairs a capture asks about one node read it once.</summary>
        private readonly Dictionary<CommNode, List<RaPlannedAntenna>?> _plannedAt = new Dictionary<CommNode, List<RaPlannedAntenna>?>();
        private double _plannedUt = double.NaN;

        /// <param name="kernel">
        /// Core's capability registry, for the <c>activeVessel</c> resolution
        /// described on <see cref="ScopedVessel"/>. Optional, and null resolves
        /// no vessel at all: this backend then reports a link it could not see,
        /// which is the honest degradation, rather than the wrong craft's.
        /// </param>
        /// <param name="retargets">The loans and opt-outs of dish turning. Null where this backend turns none.</param>
        /// <param name="turner">The game-touching half of a dish turn, resolved when asked so it can be built after the backend.</param>
        internal RaCommsBackend(RaReflection ra, Kernel? kernel, RaRetargetRegister? retargets, Func<RaDishTurner?>? turner)
        {
            _ra = ra;
            _kernel = kernel;
            _retargets = retargets;
            _turner = turner;
        }

        public RaCommsBackend(RaReflection ra, Kernel? kernel = null)
            : this(ra, kernel, null, null)
        {
        }

        public override string ProviderId => Id;

        /// <summary>
        /// The craft this backend answers for, from core's <c>activeVessel</c>
        /// capability rather than from KSP.
        ///
        /// <para>KSP's answer during an EVA is the kerbal, whose
        /// <c>connection</c> is the suit's: no antenna, a control path that is
        /// not the ship's, and a signal strength that has nothing to do with the
        /// craft the operator is watching. Queried per call, as
        /// <see cref="IActiveVessel"/> requires: the answer changes on a vessel
        /// switch, a dock, an undock, and on both ends of an EVA.</para>
        /// </summary>
        private Vessel? ScopedVessel() => _kernel.ReportedVessel() as Vessel;

        private CommNetVessel? Connection() => ScopedVessel()?.connection;

        // ── What CommsBackendBase cannot read for itself ────────────────────

        /// <summary>
        /// The craft this backend answers for. Same question the stock backend
        /// answers, reached by a different route: core's <c>activeVessel</c>
        /// capability through the kernel, since an Uplink has no
        /// <c>ActiveVesselScope</c> to read. Both resolve to
        /// <c>KspActiveVessel</c>, so they agree.
        /// </summary>
        protected override CommsSubject Subject()
        {
            var vessel = ScopedVessel();
            return vessel == null
                ? CommsSubject.None
                : new CommsSubject(vessel.id.ToString());
        }

        /// <summary>
        /// The three live readings off the link.
        ///
        /// <para>All three are STOCK reads even here, and deliberately so:
        /// <c>RACommNetVessel</c> sets <c>IsConnected</c> from RA's own gates
        /// (canComm, an explicit electric-charge <c>powered</c> flag, occlusion,
        /// and a positive data rate BOTH ways) and <c>FindClosestWhere</c>'s
        /// <c>minRelayTL</c>, and it overrides neither <c>GetControlLevel</c> nor
        /// <c>UpdateControlState</c>. So the DETERMINATION differs wildly and the
        /// reported value is the same stock accessor, which is exactly the case
        /// for reading it through the shared half rather than reimplementing
        /// it.</para>
        ///
        /// <para>The strength is the one reading that means something different
        /// here (RA fills it with a rate-ladder headroom fraction, stock with a
        /// range fraction). That is a defect in the wire field rather than in
        /// this read, and it is carried through unchanged rather than papered
        /// over: see <see cref="CommsLinkState.SignalStrength"/>.</para>
        /// </summary>
        protected override CommsLinkState? LinkState()
        {
            var conn = Connection();
            if (conn == null)
            {
                return null;
            }
            return new CommsLinkState(conn.IsConnected, GradeOf(conn.GetControlLevel()), conn.SignalStrength);
        }

        /// <summary>
        /// The control path as KSP-free link views. Stock reads throughout,
        /// because <c>RACommLink : CommNet.CommLink</c> and
        /// <c>RACommNode : CommNet.CommNode</c>: the objects RA solves over ARE
        /// stock's, so <c>ControlPath</c> and <c>precisePosition</c> need no RA
        /// reflection at all. Any vessel's path, loaded or not, since CommNet
        /// solves every vessel's route, not only the scoped one's.
        /// </summary>
        protected override IReadOnlyList<CommsLinkView>? ControlPath(object? vessel)
        {
            var path = (vessel as Vessel)?.connection?.ControlPath;
            if (path == null)
            {
                return null;
            }

            var links = new List<CommsLinkView>();
            foreach (var link in path)
            {
                if (link?.a == null || link.b == null)
                {
                    continue;
                }
                links.Add(new CommsLinkView(View(link.a), View(link.b), link));
            }
            return links;
        }

        /// <summary>
        /// The one genuinely RA-specific thing on a hop: the per-hop extras
        /// (band, tech level, modulation, encoder, required Eb/N0, beamwidth, EC
        /// draw, reverse rate) under this provider's own namespace, typed
        /// client-side by <c>RealAntennasHopExt</c>. The FORWARD band rate is
        /// deliberately absent: it rides this Uplink's own
        /// <c>realantennas.hopRates</c> channel, keyed by the same
        /// <see cref="NodeId"/>s these hops carry.
        ///
        /// <para>Read back off <see cref="CommsLinkView.Handle"/>, which is
        /// what that handle is for: a link-level fact has no home on either
        /// node, so the view carries the link itself. Main-thread only, on the
        /// capture that produced the view.</para>
        /// </summary>
        protected override Dictionary<string, object?>? HopExtensions(CommsLinkView link)
            => link.Handle is CommLink raLink ? RaHopExtensions.ForHop(_ra, raLink) : null;

        /// <summary>
        /// Stock's <c>Vessel.ControlLevel</c> in the contract's vocabulary; the
        /// collapse to the three states the wire carries happens once, in
        /// <see cref="CommsBackendBase"/>.
        /// </summary>
        private static CommsControlGrade GradeOf(Vessel.ControlLevel level) => level switch
        {
            Vessel.ControlLevel.FULL => CommsControlGrade.Full,
            Vessel.ControlLevel.PARTIAL_MANNED => CommsControlGrade.PartialManned,
            Vessel.ControlLevel.PARTIAL_UNMANNED => CommsControlGrade.PartialUnmanned,
            _ => CommsControlGrade.None,
        };

        /// <summary>One node as the base's view of it, positions converted into the contract's own vector.</summary>
        private static CommsNodeView View(CommNode node)
        {
            var p = node.precisePosition;
            return new CommsNodeView(
                node,
                NodeId(node),
                NodeDisplayName(node),
                node.isHome,
                node.isControlSource,
                new Sitrep.Contract.Vector3d(p.x, p.y, p.z));
        }

        /// <summary>
        /// RA's own route between two nodes (see <see cref="RaRouting"/> for why
        /// that is a different question from stock's, and what it costs to get
        /// wrong).
        /// </summary>
        public override IReadOnlyList<CommsRouteHop>? RouteBetween(object? from, object? to)
            => RaRouting.Between(from, to);

        /// <summary>
        /// RA's own reach rule between two nodes (see <see cref="RaReach"/> for
        /// why stock's rule silently reports zero reach for every craft on an RA
        /// install, which is what asking the seam instead of core fixes).
        /// </summary>
        public override ICommsReachModel ReachModel(object? from, object? to)
            => RaReach.Between(_ra, from, to);

        /// <summary>
        /// The pair's link as RA would close it, from every antenna's figures and
        /// aim as they stand now. Null when either end has no antennas RA can read,
        /// or a dish is aimed somewhere the plan cannot place (a point on a surface,
        /// an azimuth and elevation, an orbit-relative direction): the pair then
        /// stays on line of sight and <see cref="ReachModel"/>, as before.
        /// </summary>
        public IContactLinkModel? LinkModel(object? from, object? to, double ut)
        {
            var fromAntennas = Planned(from, ut);
            var toAntennas = Planned(to, ut);
            return fromAntennas == null || toAntennas == null || fromAntennas.Count == 0 || toAntennas.Count == 0
                ? null
                : new RaContactLinkModel(fromAntennas, toAntennas);
        }

        /// <summary>
        /// What a link between two nodes is worth at a separation, from both
        /// ends' antennas as they stand now: RealAntennas' own rate-ladder
        /// strength (<see cref="RaLinkWorth"/>). Null when either end has no
        /// antenna to read. Where an antenna points does not matter here, so
        /// an aim the plan cannot place does not withhold the strength as it
        /// withholds the <see cref="LinkModel"/>.
        /// </summary>
        public IContactLinkStrength? LinkStrength(object? from, object? to, double ut)
        {
            var fromAntennas = Planned(from, ut, placeAims: false);
            var toAntennas = Planned(to, ut, placeAims: false);
            return fromAntennas == null || toAntennas == null || fromAntennas.Count == 0 || toAntennas.Count == 0
                ? null
                : new RaLinkStrength(fromAntennas, toAntennas);
        }

        /// <summary>The least of the hops: a path carries the rate of its slowest link.</summary>
        public double Combine(IReadOnlyList<double> hopStrengths) => RaLinkStrength.Weakest(hopStrengths);

        private List<RaPlannedAntenna>? Planned(object? node, double ut, bool placeAims = true)
        {
            if (!(node is CommNode commNode))
            {
                return null;
            }
            if (ut != _plannedUt)
            {
                _plannedAt.Clear();
                _plannedUt = ut;
            }
            // The two flavours differ only in whether an aim the plan cannot place withholds the list.
            if (placeAims && _plannedAt.TryGetValue(commNode, out var cached))
            {
                return cached;
            }
            var read = ReadPlanned(commNode, placeAims);
            if (placeAims)
            {
                _plannedAt[commNode] = read;
            }
            return read;
        }

        private List<RaPlannedAntenna>? ReadPlanned(CommNode node, bool placeAims)
        {
            var planned = new List<RaPlannedAntenna>();
            var index = 0;
            var antennas = _ra.NodeAntennas(node);
            var vessel = ResolveOwningVessel(node);
            var nodeId = vessel == null ? null : "vessel:" + vessel.id;
            var parts = vessel == null ? null : RaPartIds.Of(_ra, vessel, antennas);
            foreach (var antenna in antennas)
            {
                var one = new RaPlannedAntenna
                {
                    Id = index++.ToString(),
                    Steerable = _ra.Steerable(antenna) == true,
                    BeamwidthRadians = _ra.Beamwidth(antenna) * (Math.PI / 180.0),
                    Band = _ra.BandName(antenna),
                    TxPowerDbm = _ra.TxPower(antenna),
                    GainDbi = _ra.Gain(antenna),
                    FrequencyHz = _ra.Frequency(antenna),
                    SymbolRateHz = _ra.SymbolRate(antenna),
                    NoiseTemperatureKelvin = _ra.NoiseTemperatureKelvin(antenna),
                    RequiredEbN0Db = _ra.RequiredEbN0Db(antenna),
                    MinSymbolRateHz = _ra.MinSymbolRate(antenna),
                    ModulationBits = _ra.ModulationBits(antenna),
                    TechLevel = _ra.TechLevel(antenna),
                    EncoderName = _ra.EncoderName(antenna),
                    EncoderTechLevel = _ra.EncoderTechLevel(antenna),
                    CodingRate = _ra.CodingRate(antenna),
                    EncoderRequiredEbN0Db = _ra.EncoderRequiredEbN0Db(antenna),
                    PowerDrawEc = _ra.PowerDrawLinear(antenna),
                    AimLabel = _ra.Target(antenna)?.ToString(),
                };
                var part = parts?[planned.Count];
                if (nodeId != null && part != null && one.Steerable)
                {
                    one.DishId = RaDishIds.Of(nodeId, part.Value.Part, part.Value.Ordinal);
                }
                if (!Aim(_ra.Target(antenna), one) && placeAims)
                {
                    return null;
                }
                planned.Add(one);
            }
            if (nodeId != null)
            {
                _rosterAntennas[nodeId] = planned;
            }
            else if (node.isHome)
            {
                _rosterAntennas["ground:" + NodeDisplayName(node)] = planned;
            }
            return planned;
        }

        /// <summary>Fills in where <paramref name="antenna"/> points. False for an aim the plan cannot place.</summary>
        private bool Aim(object? target, RaPlannedAntenna antenna)
        {
            if (target == null || !antenna.Steerable)
            {
                antenna.Aim = RaAimKind.Untargeted;
                return true;
            }
            switch (_ra.TargetKind(target))
            {
                case "Vessel":
                    if (!Guid.TryParse(_ra.TargetVesselId(target), out var guid))
                    {
                        return false;
                    }
                    antenna.Aim = RaAimKind.Vessel;
                    antenna.AimNodeId = "vessel:" + guid;
                    return true;
                case "BodyLatLonAlt":
                    var name = _ra.TargetBodyName(target);
                    var body = FlightGlobals.Bodies?.Find(b => b != null && b.bodyName == name);
                    var altitude = _ra.TargetLatLonAlt(target).Altitude;
                    // RA stores a body-centre aim as the point one radius below the surface.
                    if (body == null || altitude == null || Math.Abs(altitude.Value + body.Radius) > 1.0)
                    {
                        return false;
                    }
                    antenna.Aim = RaAimKind.BodyCentre;
                    antenna.AimBodyIndex = FlightGlobals.Bodies!.IndexOf(body);
                    return true;
                default:
                    return false;
            }
        }

        // ── Turning an idle dish ──────────────────────────────────────────

        /// <summary>
        /// What turning this node's dishes could do, from its antennas as they stand
        /// now. A model is returned for every RealAntennas node, a craft with no
        /// steered dish included, since a node that can only receive is still the
        /// peer another node's dish is turned to.
        /// </summary>
        public IRetargetModel? RetargetModel(object? node, double ut)
        {
            var planned = Planned(node, ut);
            var nodeId = node is CommNode commNode && ResolveOwningVessel(commNode) is Vessel vessel ? "vessel:" + vessel.id : null;
            if (planned == null || nodeId == null || _retargets == null)
            {
                return null;
            }
            return new RaRetargetModel(
                nodeId,
                planned,
                id => _rosterAntennas.TryGetValue(id, out var antennas) ? antennas : null,
                id => AutoRetargetAllowed(id));
        }

        public bool AutoRetargetAllowed(string nodeId) =>
            _retargets != null && RaDishIds.VesselGuid(nodeId) is string guid && _retargets.Allowed(guid);

        /// <summary>
        /// Whether the peer could receive what a node sent it, from the antennas the
        /// last capture read: a peer with an omni can, one that is a ground station can,
        /// and a peer whose antennas are all dishes can only when one is aimed at the
        /// node. A peer nothing was read of is taken to receive.
        /// </summary>
        public bool PeerCanReceive(string peerId, string nodeId, double ut)
        {
            if (!_rosterAntennas.TryGetValue(peerId, out var antennas) || antennas.Count == 0)
            {
                return true;
            }
            foreach (var antenna in antennas)
            {
                if (!antenna.Steerable || antenna.Aim == RaAimKind.Untargeted
                    || (antenna.Aim == RaAimKind.Vessel && string.Equals(antenna.AimNodeId, nodeId, StringComparison.Ordinal)))
                {
                    return true;
                }
            }
            return false;
        }

        public string? TurnDish(string nodeId, string dishId, string peerId, double ut) =>
            _turner?.Invoke()?.Turn(nodeId, dishId, peerId, ut);

        public bool RestoreDish(string recordId, double ut) =>
            _turner?.Invoke()?.Restore(recordId, ut) ?? true;

        /// <summary>
        /// RA's occlusion geometry: the bare body radius, no multiplier (see
        /// <see cref="RaOcclusion"/>). Nothing live to read, unlike the stock
        /// backend whose multipliers are a per-save difficulty setting, so this
        /// is a constant.
        /// </summary>
        public override ICommsOcclusionModel OcclusionModel() => RaOcclusion.Model;

        /// <summary>
        /// RA's own grading of the live link (see <see cref="RaDegrade"/> for the
        /// rule, for why it grades the rate ladder rather than the dB margin this
        /// Uplink also publishes, and for why it is not shared with the stock
        /// backend that computes the same expression over a different quantity).
        /// </summary>
        public override ICommsDegradeModel DegradeModel() => RaDegrade.From(LinkState());

        /// <summary>
        /// A node's UNIQUE join key, matching CommNetBackend.NodeId (that
        /// backend's own doc comment carries the full rationale): the owning
        /// vessel's persistent id for a vessel node, since two craft can share
        /// a name and merging them into one node loses a link; the station's
        /// own name for a ground station, which RSS/RA fly a dozen of and which
        /// must stay distinguishable.
        ///
        /// <para>Internal rather than private so this Uplink's
        /// <c>realantennas.hopRates</c> capture keys its per-hop entries by
        /// exactly this derivation, which is what guarantees the client can join
        /// a rate onto the route <c>comms.path</c> already published.</para>
        /// </summary>
        internal static string NodeId(CommNode node)
        {
            if (node == null) return "unknown";
            var vessel = ResolveOwningVessel(node);
            if (vessel != null) return vessel.id.ToString();
            if (!string.IsNullOrEmpty(node.displayName)) return node.displayName;
            if (!string.IsNullOrEmpty(node.name)) return node.name;
            return node.isHome ? "home" : "node";
        }

        /// <summary>The human label, independent of the (now unique) id.</summary>
        private static string NodeDisplayName(CommNode node)
        {
            if (node == null) return "unknown";
            if (!string.IsNullOrEmpty(node.displayName)) return node.displayName;
            if (!string.IsNullOrEmpty(node.name)) return node.name;
            return node.isHome ? "home" : "node";
        }

        /// <summary>
        /// The vessel owning <paramref name="node"/>, recovered by
        /// reference-comparing against every known vessel's own CommNet node:
        /// stock <see cref="CommNode"/> has no vessel back-reference.
        /// </summary>
        private static Vessel? ResolveOwningVessel(CommNode node)
        {
            var vessels = FlightGlobals.Vessels;
            if (vessels == null) return null;
            foreach (var candidate in vessels)
            {
                var conn = candidate?.connection;
                if (conn != null && ReferenceEquals(conn.Comm, node))
                {
                    return candidate;
                }
            }
            return null;
        }

    }
}
