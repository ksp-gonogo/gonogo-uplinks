using System;
using System.Collections.Generic;
using CommNet;
using Sitrep.Contract;

namespace Gonogo.RealAntennasUplink
{
    /// <summary>
    /// The GonogoRealAntennasUplink (comms-uplink-design.md §2.2, §4). A
    /// SEPARATE (non-bundled) uplink, discovered by the same
    /// <c>[SitrepUplink]</c> assembly scan as every other. It does three things:
    ///
    /// <list type="number">
    /// <item>When RealAntennas is loaded (the <see cref="RaReflection"/> probe,
    /// §4.2), it registers a higher-priority <c>"comms"</c> provider on the
    /// engine Kernel so <see cref="RaCommsBackend"/> WINS the exclusive comms
    /// election: geometry/connectivity via stock CommNet, hops enriched with RA
    /// data rate. Registering the provider IS the gate (§2.2): absent RA, no
    /// provider is registered and CommNet vanilla stays elected.</item>
    /// <item>It declares + sources the RA-ONLY channels
    /// (<c>comms.linkQuality</c>/<c>comms.dataRate</c>/<c>comms.linkMargin</c>)
    /// in its OWN manifest, bypassing the election entirely (§2.2). Data rate is
    /// read live off the RACommLink; margin/quality are RE-DERIVED by
    /// <see cref="RaLinkBudget"/> from RA's public antenna props (§4.3), never
    /// reflected off a live field.</item>
    /// <item>When RealAntennas is loaded, it claims the exclusive
    /// <c>"homeCommand"</c> capability with <see cref="RaHomeCommandProvider"/>:
    /// home is the ground station nearest KSP's space centre.</item>
    /// </list>
    ///
    /// <para>NO compile-time reference to RA's CC-BY-SA-4.0 assembly, every RA
    /// member is reached by reflection (§4.1/§4.2). Compile surface is
    /// <c>Sitrep.Contract</c> + stock KSP only.</para>
    /// </summary>
    [SitrepUplink("realantennas")]
    public sealed class RealAntennasUplink : ISitrepUplink
    {
        public const string LinkQualityTopic = RealAntennasManifest.LinkQualityTopic;
        public const string DataRateTopic = RealAntennasManifest.DataRateTopic;
        public const string LinkMarginTopic = RealAntennasManifest.LinkMarginTopic;
        public const string HopRatesTopic = RealAntennasManifest.HopRatesTopic;
        public const string AvailableTopic = RealAntennasManifest.AvailableTopic;
        public const string AntennasTopic = RealAntennasManifest.AntennasTopic;
        public const string ChainsTopic = RealAntennasManifest.ChainsTopic;
        public const string TargetCommand = RealAntennasManifest.TargetCommand;
        public const string TargetHomeCommand = RealAntennasManifest.TargetHomeCommand;
        public const string TargetChainCommand = RealAntennasManifest.TargetChainCommand;
        public const string RetargetingTopic = RealAntennasManifest.RetargetingTopic;
        public const string SetAutoRetargetCommand = RealAntennasManifest.SetAutoRetargetCommand;

        // Fallback link-budget inputs, used only when the live per-link read
        // returns null. RA exposes both per antenna: the receiver noise
        // temperature via RealAntenna.AMWTemp (tech-level driven, TL0 ~27000 K, TL9
        // ~200 K) and the required Eb/N0 via RealAntenna.RequiredCI
        // (= Encoder.RequiredEbN0). CaptureOnMain wires those in below and only
        // falls back to these constants (the pre-wiring display estimates) when a
        // read fails, the existing fail-soft posture.
        private const double DefaultReceiverNoiseTempKelvin = 200.0;
        private const double DefaultRequiredEbN0Db = 2.5;

        private RaReflection? _ra;

        /// <summary>
        /// Core's capability registry, held from <see cref="Register"/> so
        /// <see cref="CaptureOnMain"/> can ask which craft these channels are
        /// about. See <see cref="ScopedVessel"/> for why it is not KSP's answer.
        /// </summary>
        private Kernel? _kernel;

        /// <summary>
        /// The host, held from <see cref="Register"/> for its clock. See
        /// <see cref="UtOf"/>.
        /// </summary>
        private IUplinkHost? _host;

        private IChannelPublisher? _linkQuality;
        private IChannelPublisher? _dataRate;
        private IChannelPublisher? _linkMargin;
        private IChannelPublisher? _hopRates;
        private IChannelPublisher? _antennas;
        private IChannelPublisher? _chains;
        private IChannelPublisher? _retargeting;

        /// <summary>The dishes on loan and the crafts opted out of dish turning: the process's own register, saved with the game.</summary>
        private readonly RaRetargetRegister _retargets = RaChainScenario.Retargets;

        /// <summary>Turns another craft's idle dish and puts it back, built at Register beside targeting.</summary>
        private RaDishTurner? _turner;

        /// <summary>Targeting's reflection + KSP half, built at Register once RA is confirmed present.</summary>
        private RaTargeting? _targeting;

        /// <summary>The fallback-chain walk and its read-back, built at Register beside targeting.</summary>
        private RaChains? _chainWalk;

        public UplinkManifest Manifest { get; } = RealAntennasManifest.Build();

        /// <summary>Mandatory health self-report (see <see cref="ISitrepUplink.Health"/>):
        /// Unavailable when the RealAntennas assembly is absent (the uplink went inert at
        /// Register: <see cref="_ra"/> stays null/unavailable), else Healthy.</summary>
        public UplinkHealth Health() =>
            _ra != null && _ra.IsAvailable
                ? UplinkHealth.Healthy
                : new UplinkHealth(UplinkHealthState.Unavailable, "RealAntennas assembly not loaded");

        public void Register(IUplinkHost host)
        {
            _kernel = host.Kernel;
            _host = host;
            _ra = RaReflection.Probe();
            if (_ra == null || !_ra.IsAvailable)
            {
                // RA not installed: go inert. The exclusive comms capability
                // keeps CommNet vanilla; the RA-only channels simply never emit.
                host.SetAvailability(Availability.Unavailable("RealAntennas assembly not loaded"));
                return;
            }

            // Register the RA comms provider directly on the Kernel (Kernel lives
            // in Sitrep.Contract: no engine reference needed). The bundled comms
            // core uplink OWNS the "comms" capability descriptor and declares it
            // in the two-pass discovery's capability pass (see
            // CommsCoreUplink.DeclareCapabilities / IUplinkCapabilityDeclarer),
            // which runs before ANY uplink's Register, so by the time this line
            // executes the capability is guaranteed present regardless of the
            // order the assembly scan discovered RA vs. the comms core. The
            // try/catch is now pure defence-in-depth (a genuinely absent comms
            // core, which cannot happen in a correctly bundled install): a throw
            // is surfaced, not swallowed, and RA still emits its own private
            // channels rather than taking itself down.
            try
            {
                host.Kernel.RegisterProvider(new ProviderRegistration
                {
                    Capability = "comms",
                    Id = "realantennas",
                    Priority = 100.0,
                    Factory = _ => new RaCommsBackend(_ra, host.Kernel, _retargets, () => _turner),
                });
            }
            catch (Exception ex)
            {
                Console.Error.WriteLine("[RealAntennasUplink] could not register comms provider: " + ex.Message);
            }

            // Every RA ground station is home for comms, so stock's claimant, which
            // wants exactly one flagged station, names none of them. The capability is
            // declared in the comms core's capability pass, like "comms" above.
            try
            {
                host.Kernel.RegisterProvider(RaHomeCommandProvider.Registration(new RaSpaceCentre().Read));
            }
            catch (Exception ex)
            {
                Console.Error.WriteLine("[RealAntennasUplink] could not register home-command provider: " + ex.Message);
            }

            // Bare-boolean presence gate: true while RA is loaded. Same shape as
            // any Uplink's <domain>.available, and what the RA client augments'
            // `requires` resolves against.
            host.AddChannelSource(AvailableTopic, _ => _ra != null && _ra.IsAvailable);

            _linkQuality = host.Publisher(LinkQualityTopic);
            _dataRate = host.Publisher(DataRateTopic);
            _linkMargin = host.Publisher(LinkMarginTopic);
            _hopRates = host.Publisher(HopRatesTopic);
            _antennas = host.Publisher(AntennasTopic);
            _chains = host.Publisher(ChainsTopic);
            _retargeting = host.Publisher(RetargetingTopic);

            host.AddSampledSource(CaptureOnMain, HandleOnCourier, LinkQualityTopic, DataRateTopic, LinkMarginTopic, HopRatesTopic);

            // Its own sampled source rather than a sixth topic on the one above:
            // the antenna walk reads every antenna on the craft and the mode
            // table beside it, and there is no reason to pay for that on a tick
            // where only a data rate was subscribed.
            _targeting = new RaTargeting(_ra, _retargets);
            host.AddSampledSource(CaptureAntennasOnMain, HandleAntennasOnCourier, AntennasTopic);

            // UNGATED, and it must be. This capture's effect is the retargeting,
            // not its return value: the gated overload skips the capture entirely
            // on a tick where nothing is subscribed, so a gated walk would be a
            // fallback that only worked while a client happened to have the chain
            // channel open. That is the failure the gated overload's own doc
            // comment describes, and here it would be total: an operator would
            // believe they had a fallback and the craft would sit dark.
            _turner = new RaDishTurner(_ra, _targeting, _retargets, RaChainScenario.Chains);
            _chainWalk = new RaChains(_ra, _targeting, RaChainScenario.Chains, _retargets);
            host.AddSampledSource(CaptureChainsOnMain, HandleChainsOnCourier);
            host.AddSampledSource(CaptureRetargetingOnMain, HandleRetargetingOnCourier, RetargetingTopic);

            host.AddCommandHandler<RealAntennasTargetArgs, CommandResult>(
                TargetCommand, args => _targeting.Target(ScopedVessel(), args));
            host.AddCommandHandler<RealAntennasAntennaArgs, CommandResult>(
                TargetHomeCommand, args => _targeting.TargetHome(ScopedVessel(), args));
            host.AddCommandHandler<RealAntennasTargetChainArgs, CommandResult>(
                TargetChainCommand, args => _chainWalk.SetChain(ScopedVessel(), args));
            host.AddCommandHandler<RealAntennasSetAutoRetargetArgs, CommandResult>(
                SetAutoRetargetCommand, SetAutoRetarget);
        }

        /// <summary>
        /// MAIN THREAD: <c>realantennas.vessel.setAutoRetarget</c>. Records whether a
        /// craft may have a dish turned on its own. Opting a craft out while a dish of
        /// it is on loan puts the dish back at once, before the answer is given, so the
        /// operator who turned it off is not left with the dish still on a borrowed aim.
        /// </summary>
        private CommandResult SetAutoRetarget(RealAntennasSetAutoRetargetArgs? args)
        {
            if (args == null || !Guid.TryParse(args.Vessel, out var guid))
            {
                return CommandResult.Fail(CommandErrorCode.Range, "A craft is named by its id, as system.vessels gives it.");
            }
            var id = guid.ToString();
            var known = false;
            foreach (var vessel in FlightGlobals.Vessels ?? new List<Vessel>())
            {
                if (vessel != null && string.Equals(vessel.id.ToString(), id, StringComparison.OrdinalIgnoreCase))
                {
                    known = true;
                    break;
                }
            }
            if (!known)
            {
                return CommandResult.Fail(CommandErrorCode.NotFound, "No craft with that id is in the game.");
            }
            _retargets.SetAllowed(id, args.Allow);
            if (!args.Allow)
            {
                foreach (var loan in new List<RaRetargetRegister.Borrow>(_retargets.Open))
                {
                    if (string.Equals(loan.VesselId, id, StringComparison.OrdinalIgnoreCase))
                    {
                        _turner?.Restore(loan.Id, UtOf(null));
                    }
                }
            }
            return CommandResult.Ok();
        }

        /// <summary>
        /// MAIN THREAD: the <c>realantennas.retargeting</c> value. Every craft that is
        /// opted out, has a dish on loan, or has had one: published whole each time,
        /// because the channel is LossyLatest and a craft whose loan has ended must
        /// leave the wire rather than stay on it.
        /// </summary>
        internal object? CaptureRetargetingOnMain(KspSnapshot? snapshot)
        {
            var ut = UtOf(snapshot);
            var vessels = new Dictionary<string, RealAntennasVesselRetargeting>(StringComparer.OrdinalIgnoreCase);
            RealAntennasVesselRetargeting EntryOf(string id)
            {
                if (!vessels.TryGetValue(id, out var entry))
                {
                    entry = new RealAntennasVesselRetargeting
                    {
                        VesselId = id,
                        Allowed = _retargets.Allowed(id),
                        Meta = new PayloadMeta { Source = "vessel:" + id },
                    };
                    vessels[id] = entry;
                }
                return entry;
            }
            foreach (var id in _retargets.OptedOut)
            {
                EntryOf(id);
            }
            foreach (var loan in _retargets.Open)
            {
                EntryOf(loan.VesselId).Borrowed = new RealAntennasBorrowedDish
                {
                    DishId = loan.DishId,
                    PeerId = loan.PeerId,
                    DishName = loan.DishName,
                    SinceUt = loan.TurnedUt,
                    PreviousAim = loan.PreviousLabel,
                };
            }
            foreach (var pair in _retargets.LastEnded)
            {
                EntryOf(pair.Key).Last = new RealAntennasLastBorrow
                {
                    PeerId = pair.Value.PeerId,
                    TurnedUt = pair.Value.TurnedUt,
                    EndedUt = pair.Value.SettledUt,
                    Outcome = pair.Value.Outcome.ToString().ToLowerInvariant(),
                };
            }
            return new RaRetargetingCapture { Ut = ut, Vessels = new List<RealAntennasVesselRetargeting>(vessels.Values) };
        }

        internal void HandleRetargetingOnCourier(object? captured)
        {
            if (captured is not RaRetargetingCapture capture)
            {
                return;
            }
            _retargeting?.Publish(RaWire.Retargeting(capture.Vessels), capture.Ut);
        }

        /// <summary>
        /// MAIN-THREAD capture for <c>realantennas.antennaChains</c>, and the
        /// tick the fallback walk runs on.
        ///
        /// <para>The walk goes FIRST, so the value published beside it describes
        /// the state the craft is now in rather than the one it was in before this
        /// tick moved it. An operator watching a chain advance would otherwise see
        /// every entry one tick late, which on a delayed channel is indistinguishable
        /// from the chain being slow.</para>
        /// </summary>
        internal object? CaptureChainsOnMain(KspSnapshot? snapshot)
        {
            if (_chainWalk == null)
            {
                return null;
            }

            var ut = UtOf(snapshot);
            _turner?.Evaluate(ut);
            _chainWalk.Evaluate(ut);
            return new RaChainCapture
            {
                Ut = ut,
                Chains = _chainWalk.ReadChains(ScopedVessel(), ut),
            };
        }

        /// <summary>
        /// COURIER-THREAD handle for <c>realantennas.antennaChains</c>: the
        /// flattened array. An empty array is PUBLISHED rather than withheld, for
        /// the same reason the antenna list is: the channel is LossyLatest, so
        /// withholding would leave the previous craft's chains on the wire.
        /// </summary>
        internal void HandleChainsOnCourier(object? captured)
        {
            if (captured is not RaChainCapture capture)
            {
                return;
            }
            _chains?.Publish(RaWire.Chains(capture.Chains), capture.Ut);
        }

        /// <summary>
        /// MAIN-THREAD capture for <c>realantennas.antennas</c>. The vessel is
        /// resolved once and the whole list is read from it, so no two entries can
        /// describe different craft.
        /// </summary>
        internal object? CaptureAntennasOnMain(KspSnapshot? snapshot)
        {
            if (_targeting == null)
            {
                return null;
            }
            return new RaAntennaCapture
            {
                Ut = UtOf(snapshot),
                Antennas = _targeting.ReadAntennas(ScopedVessel()),
            };
        }

        /// <summary>
        /// COURIER-THREAD handle for <c>realantennas.antennas</c>: the flattened
        /// array. An empty array is PUBLISHED rather than withheld, because the
        /// channel is LossyLatest: withholding it on a craft with no antennas
        /// would leave the previous craft's list standing on the wire.
        /// </summary>
        internal void HandleAntennasOnCourier(object? captured)
        {
            if (captured is not RaAntennaCapture capture)
            {
                return;
            }
            _antennas?.Publish(RaWire.Antennas(capture.Antennas), capture.Ut);
        }

        /// <summary>
        /// The craft these channels are about, from core's <c>activeVessel</c>
        /// capability rather than from KSP.
        ///
        /// <para>While a kerbal is outside, KSP's answer is the kerbal: one part,
        /// no antenna, and a <c>connection</c> whose control path is the EVA
        /// suit's. Every RA channel would then describe the suit while
        /// <c>comms.path</c> beside it, which core scopes, describes the ship.
        /// Null when core does not publish the capability, so the channels report
        /// a link they could not see rather than the wrong craft's.</para>
        /// </summary>
        private Vessel? ScopedVessel() => _kernel.ReportedVessel() as Vessel;

        /// <summary>
        /// The instant to stamp a capture with: the snapshot's own, or the live
        /// clock on a tick that carries no snapshot.
        ///
        /// <para>It used to coalesce to <c>0.0</c>, which is year 1 day 1 and
        /// therefore a real instant: a reading stamped with it says it came from
        /// the start of the game rather than from a time nobody measured. A null
        /// <c>_host</c> is a wiring fault rather than a tick without a snapshot,
        /// because a capture cannot run before <see cref="Register"/> sets it, so
        /// this throws rather than substituting an instant of its own.</para>
        /// </summary>
        private double UtOf(KspSnapshot? snapshot) => snapshot?.Ut ?? _host!.NowUt();

        /// <summary>
        /// MAIN-THREAD capture: reads the RA link off the live control path.
        ///
        /// <para>The vessel is resolved ONCE here and threaded through every
        /// helper below. Five separate resolutions on one tick could disagree
        /// with each other across a vessel switch, and would give the hop rates a
        /// different subject from the margin computed beside them.</para>
        /// </summary>
        internal object? CaptureOnMain(KspSnapshot? snapshot)
        {
            if (_ra == null)
            {
                return null;
            }

            var vessel = ScopedVessel();
            var capture = new RaCapture { Ut = UtOf(snapshot), Source = Source(vessel) };

            // Per-hop forward rates for realantennas.hopRates: built from the FULL
            // ControlPath (not just the primary link), keyed by the same node ids
            // comms.path carries so the client can join a rate onto every hop the
            // core schedule renders. Independent of the link-budget block below, so
            // it is computed unconditionally: an empty list on a down link clears
            // any stale rates rather than leaving the last-good ones on the wire.
            capture.HopRates = BuildHopRates(vessel);

            // Authoritative link state comes from CommNet connectivity, NOT from
            // the geometry-only budget below. A geometric margin ignores occlusion
            // and out-of-cone relays, so it can read a healthy positive margin for
            // a link that is actually DOWN (bug: comms.linkMargin reported
            // closesLink:true, 49 dB, while comms.connectivity correctly reported
            // connected:false). Because these channels are LossyLatest, returning
            // null on a down link would leave the last-good positive margin stale
            // on the wire, which is exactly the observed failure. So when the link
            // is not actually connected we PUBLISH a definitive link-down state
            // (closesLink:false, zero throughput) rather than emit nothing.
            var link = PrimaryControlLink(vessel);
            if (!IsConnected(vessel) || link == null)
            {
                capture.LinkMargin = RaLinkDown.LinkMargin(capture.Source);
                capture.LinkQuality = RaLinkDown.LinkQuality(capture.Source);
                capture.DataRate = RaLinkDown.DataRate(capture.Source);
                return capture;
            }

            var fwd = _ra.ForwardDataRate(link);
            var rev = _ra.ReverseDataRate(link);
            // Typed absence over a sentinel: only publish comms.dataRate when
            // BOTH directions read. CommsDataRate's Up/DownBitsPerSec are
            // non-nullable doubles (a per-field null would be a wire-shape change
            // and a contract Major/Minor bump), so a half-read has no way to say
            // "this side is missing" in the payload: filling it with `?? 0.0`
            // gives a false "no throughput" reading indistinguishable from a
            // genuinely idle link. Emitting nothing
            // (payload-level typed absence) when either side is missing is the
            // honest choice: the channel simply reports no value that tick rather
            // than a fabricated zero.
            //
            // Orientation-aware up/down. RA's FwdDataRate is the rate in the link's
            // stored a->b direction, and RA assigns a/b by NODE INDEX, not by
            // vessel-vs-home role (Precompute's MakeLink is called with a=Nodes[x],
            // b=Nodes[y], x<=y). So a fixed "Down = Fwd" is a coin-flip per link,
            // so it is swapped for roughly half of them. RaLinkDirection resolves
            // it the way RA's own MaxDataRateToHome does: Fwd is the downlink
            // (vessel->home) only when link.a is the active vessel's own comm
            // node. Falls back to the Down=Fwd mapping when the vessel node
            // cannot be identified, which is the coin-flip again but only for
            // the cases nothing can resolve.
            if (fwd != null && rev != null)
            {
                var (up, down) = RaLinkDirection.Resolve(ForwardIsDownlink(vessel, link), fwd.Value, rev.Value);
                capture.DataRate = new CommsDataRate
                {
                    UpBitsPerSec = up,
                    DownBitsPerSec = down,
                    Meta = new PayloadMeta { Source = capture.Source },
                };
            }

            // Re-derive margin/quality from RA's public antenna props (§4.3).
            var tx = _ra.ForwardTxAntenna(link);
            var rx = _ra.ForwardRxAntenna(link);
            if (link.a != null && link.b != null && tx != null && rx != null)
            {
                double distance = (link.a.precisePosition - link.b.precisePosition).magnitude;
                double? txPower = _ra.TxPower(tx);
                double? txGain = _ra.Gain(tx);
                double? rxGain = _ra.Gain(rx);
                double? freq = _ra.Frequency(tx);
                double? symbolRate = _ra.SymbolRate(tx);

                // RA's own per-link numbers, replacing the hardcoded estimates:
                // the receiver noise temperature off the RX antenna's AMWTemp, and
                // the required Eb/N0 off its RequiredCI
                // (= Encoder.RequiredEbN0). Both fail soft to the constants when a
                // read returns null, so a moved RA surface degrades the margin's
                // FIDELITY rather than breaking it. The re-derivation is still
                // best-effort (it does not reproduce RA's negotiated-modulation
                // tie-break), and the absolute margin wants live-RA confirmation
                // before the fallbacks are removed.
                if (txPower != null && txGain != null && rxGain != null && freq != null && symbolRate != null)
                {
                    double noiseTempKelvin = _ra.NoiseTemperatureKelvin(rx) ?? DefaultReceiverNoiseTempKelvin;
                    double requiredEbN0Db = _ra.RequiredEbN0Db(rx) ?? DefaultRequiredEbN0Db;
                    double pr = RaLinkBudget.ReceivedPowerDbm(txPower.Value, txGain.Value, rxGain.Value, distance, freq.Value);
                    double margin = RaLinkBudget.LinkMarginDb(pr, noiseTempKelvin, symbolRate.Value, requiredEbN0Db);

                    // Typed absence over a non-finite sentinel: LinkMarginDb
                    // returns double.NegativeInfinity for a non-positive symbol
                    // rate (and NaN is possible from degenerate inputs). A
                    // non-finite double is not valid JSON on the wire, so instead
                    // of publishing it we leave BOTH margin and quality unset
                    // (payload-level typed absence: the derived quality is
                    // meaningless when the margin it comes from is invalid). net48
                    // has no double.IsFinite, hence the explicit NaN/Infinity test.
                    if (!double.IsNaN(margin) && !double.IsInfinity(margin))
                    {
                        var meta = new PayloadMeta { Source = capture.Source };
                        capture.LinkMargin = new CommsLinkMargin
                        {
                            DecibelMargin = margin,
                            // We only reach this branch when CommNet reports the
                            // link connected, so the link DOES close, the
                            // authoritative state wins over the geometry-only
                            // margin sign (which can disagree, e.g. a marginal but
                            // negotiated link).
                            ClosesLink = true,
                            Meta = meta,
                        };
                        capture.LinkQuality = new CommsLinkQuality
                        {
                            Value = RaLinkBudget.NormaliseQuality(margin),
                            Meta = meta,
                        };
                    }
                }
            }

            return capture;
        }

        /// <summary>
        /// COURIER-THREAD handle: publish only the payloads we could compute (typed
        /// absence otherwise), each flattened to its wire dictionary on the way out.
        ///
        /// <para>The flatten is what lets these three types live in this Uplink's own
        /// contract slice rather than in core. Core's serializer carries no case per
        /// type, so <see cref="RaWire"/> writes the wire dictionary itself;
        /// publishing the POCO raw from here reaches the serializer's default branch
        /// and drops the frame.</para>
        /// </summary>
        internal void HandleOnCourier(object? captured)
        {
            if (captured is not RaCapture capture)
            {
                return;
            }
            if (capture.DataRate != null) _dataRate?.Publish(RaWire.DataRate(capture.DataRate), capture.Ut);
            if (capture.LinkMargin != null) _linkMargin?.Publish(RaWire.LinkMargin(capture.LinkMargin), capture.Ut);
            if (capture.LinkQuality != null) _linkQuality?.Publish(RaWire.LinkQuality(capture.LinkQuality), capture.Ut);
            if (capture.HopRates != null) _hopRates?.Publish(RaWire.HopRates(capture.HopRates), capture.Ut);
        }

        /// <summary>
        /// MAIN-THREAD: the reported vessel's per-hop forward rates, one entry per hop
        /// whose <c>ForwardDataRate</c> reads (typed absence otherwise, never a 0
        /// entry), keyed by <see cref="RaCommsBackend.NodeId"/> so the ids match
        /// <c>comms.path</c> hop for hop. Empty when there is no control path.
        /// </summary>
        private List<RealAntennasHopRate> BuildHopRates(Vessel? vessel)
        {
            var rates = new List<RealAntennasHopRate>();
            var path = vessel?.connection?.ControlPath;
            if (_ra == null || path == null)
            {
                return rates;
            }
            foreach (var link in path)
            {
                if (link?.a == null || link.b == null)
                {
                    continue;
                }
                var rate = _ra.ForwardDataRate(link);
                if (rate == null)
                {
                    continue;
                }
                rates.Add(new RealAntennasHopRate
                {
                    FromNodeId = RaCommsBackend.NodeId(link.a),
                    ToNodeId = RaCommsBackend.NodeId(link.b),
                    BitsPerSec = rate.Value,
                });
            }
            return rates;
        }

        /// <summary>Whether the reported vessel currently has a working comms link (CommNet authority).</summary>
        private static bool IsConnected(Vessel? vessel)
        {
            var conn = vessel?.connection;
            return conn != null && conn.IsConnected;
        }

        /// <summary>The first hop of the reported vessel's control path (the vessel's own link), or null.</summary>
        private static CommLink? PrimaryControlLink(Vessel? vessel)
        {
            var path = vessel?.connection?.ControlPath;
            if (path == null)
            {
                return null;
            }
            foreach (var link in path)
            {
                return link; // first hop
            }
            return null;
        }

        /// <summary>
        /// Whether a link's FORWARD direction (its stored <c>a -&gt; b</c>) is the
        /// operator's DOWNLINK (vessel -&gt; home). True when <c>link.a</c> is the
        /// reported vessel's own comm node, so <c>a -&gt; b</c> runs away from the
        /// vessel toward home. Falls back to true, the plain Down=Fwd mapping,
        /// when the vessel node cannot be identified: a coin-flip for that link
        /// rather than a confident swap.
        /// </summary>
        private static bool ForwardIsDownlink(Vessel? vessel, CommLink link)
        {
            var vesselNode = vessel?.connection?.Comm;
            return vesselNode == null || ReferenceEquals(link.a, vesselNode);
        }

        private static string Source(Vessel? vessel) =>
            vessel != null ? "vessel:" + vessel.id : "game";

        private sealed class RaCapture
        {
            public double Ut;
            public string Source = "";
            public CommsDataRate? DataRate;
            public CommsLinkMargin? LinkMargin;
            public CommsLinkQuality? LinkQuality;
            public List<RealAntennasHopRate>? HopRates;
        }

        private sealed class RaAntennaCapture
        {
            public double Ut;
            public List<RealAntennasAntennaState> Antennas = new List<RealAntennasAntennaState>();
        }

        private sealed class RaRetargetingCapture
        {
            public double Ut;
            public List<RealAntennasVesselRetargeting> Vessels = new List<RealAntennasVesselRetargeting>();
        }

        private sealed class RaChainCapture
        {
            public double Ut;
            public List<RealAntennasAntennaChain> Chains = new List<RealAntennasAntennaChain>();
        }
    }
}
