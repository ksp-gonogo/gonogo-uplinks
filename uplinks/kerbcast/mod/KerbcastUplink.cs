using System;
using System.Collections.Generic;
using System.IO;
using System.Runtime.CompilerServices;
using System.Threading;
using GonogoKerbcastUplink;
using Sitrep.Contract;

namespace Gonogo.KerbcastUplink
{
    /// <summary>
    /// The GonogoKerbcastUplink: kerbcast's control plane as a first-class
    /// Uplink, discovered by the same <c>[SitrepUplink]</c> assembly scan as
    /// every other.
    ///
    /// <para><b>What this owns:</b> the camera inventory
    /// (<c>kerbcast.cameras</c>: identity, capabilities, and the derived
    /// docking-port association), the presence gate
    /// (<c>kerbcast.available</c>), the aim/zoom commands
    /// (<c>kerbcast.setFieldOfView</c>/<c>kerbcast.setPan</c>), and (the point
    /// of the exercise) a real, contract-reported health state that lands in
    /// <c>system.uplinks</c> alongside every other Uplink's.</para>
    ///
    /// <para><b>What this does not own: the video.</b> kerbcast's H.264 stream
    /// runs sidecar -> browser over WebRTC and stays there. A UT-indexed,
    /// keyframed telemetry channel is the wrong shape for encoded media, and
    /// the WebRTC path already works. The client's delay authority
    /// (<c>useViewClock()</c>) is what keeps that media aligned with telemetry;
    /// this uplink deliberately does not disturb that seam. Control rides
    /// Sitrep, media rides WebRTC: and because the control plane is Delayed
    /// like everything else, the two agree.</para>
    ///
    /// <para><b>Health is why this exists.</b> Before this uplink, "is my
    /// camera feed healthy" could only be answered by reading the browser's
    /// own <c>KerbcastDataSource.status</c>: a client-side read of a separate
    /// WebRTC connection, bypassing the mod contract entirely. That row was
    /// deleted in <c>45111e44</c> precisely because the Uplinks list is
    /// contract-only. Implementing <see cref="ISitrepUplink.Health"/> here is
    /// what earns the row back honestly: the mod itself reports whether
    /// kerbcast is installed, running, and seeing cameras, over the one Sitrep
    /// connection, exactly like every other Uplink. This is the first real
    /// <see cref="ISitrepUplink.Health"/> implementation in the repo.</para>
    ///
    /// <para>kerbcast is reached through Kerbcast.API: cameras through
    /// <see cref="IKerbcastApi"/> (<see cref="KerbcastApiAdapter"/>), and the
    /// command lock and world model through <see cref="IKerbcastGovernor"/>
    /// (<see cref="KerbcastGovernor"/>). Both are constructed only once the
    /// assembly is known to be loaded. Compile surface is <c>Sitrep.Contract</c>,
    /// stock KSP and Kerbcast.API.</para>
    /// </summary>
    [SitrepUplink("kerbcast")]
    public sealed class KerbcastUplink : ISitrepUplink, IUplinkSettingsDeclarer, IModSettingsSource, IModSettingsWriter
    {
        public const string AvailableTopic = KerbcastManifest.AvailableTopic;
        public const string CamerasTopic = KerbcastManifest.CamerasTopic;
        public const string SetFieldOfViewCommand = KerbcastManifest.SetFieldOfViewCommand;
        public const string SetPanCommand = KerbcastManifest.SetPanCommand;

        /// <summary>Real seconds between reads of the game's craft list into <see cref="_craftLabels"/>.</summary>
        private const double CraftLabelSeconds = 2.0;

        private IKerbcastApi? _kerbcast;
        private IKerbcastGovernor? _governor;
        private IUplinkHost? _host;
        private readonly CraftLabels _craftLabels = new CraftLabels();
        private double? _craftLabelsRead;
        private readonly KerbcastLensSites _lensSites = new KerbcastLensSites();
        private IChannelPublisher? _cameras;
        private readonly KerbcastModSettings _modSettings;

        // Health state, written by the MAIN-THREAD capture and read by Health()
        // on the Courier thread. Volatile int/string rather than touching KSP:
        // Health() is polled on EVERY system.uplinks sample and must be cheap
        // and non-blocking, and it must never touch a live Unity object off the
        // main thread (a Unity null-check off-thread is not safe).
        private volatile string? _unavailableReason;
        private volatile bool _coreActive;
        // Health() never reads the raw per-tick SidecarAlive() reading: it reads
        // the DEBOUNCED _sidecarConfirmedDead, kerbcast's own auto-restart (up
        // to 5 attempts, ~5s apart) makes a single false tick a transient, not
        // a fault. _sidecarDebouncer (main-thread-only, never touched off it) is
        // the state machine; _sidecarConfirmedDead is its published, volatile
        // Courier-thread-readable output. See SidecarDeathDebouncer's own doc.
        private volatile bool _sidecarConfirmedDead;
        private readonly SidecarDeathDebouncer _sidecarDebouncer = new SidecarDeathDebouncer();
        private volatile bool _inFlight;
        private volatile bool _coreMissingSettled;
        private readonly FlightCoreWatch _coreWatch = new FlightCoreWatch();
        private int _cameraCount = -1;
        private volatile KerbcastReach _reach = KerbcastReach.Unknown;

        public UplinkManifest Manifest { get; } = KerbcastManifest.Build();

        public KerbcastUplink()
        {
            _modSettings = new KerbcastModSettings(
                ThrottleUnavailable,
                () => _kerbcast?.ReadThrottle(),
                on => _kerbcast != null && _kerbcast.WriteThrottle(on));
        }

        /// <summary>Declares the setting that has Kerbcast follow Gonogo's address, when Kerbcast is installed to follow it.</summary>
        public void DeclareSettings(IUplinkSettings settings)
        {
            if (!KerbcastBinding.IsKerbcastLoaded())
            {
                return;
            }

            new KerbcastFollowGonogoSetting(
                new KerbcastBindAddress(KerbcastSettingsPath(false), KerbcastSettingsPath(true)),
                message => UnityEngine.Debug.LogWarning("[Gonogo.KerbcastUplink] " + message)).Declare(settings);
        }

        /// <summary>Kerbcast's shipped settings, or the player's override beside them that its updates leave alone.</summary>
        private static string KerbcastSettingsPath(bool playerOverride) =>
            playerOverride
                ? Path.Combine(KSPUtil.ApplicationRootPath, "GameData", "Kerbcast", "PluginData", "settings.cfg")
                : Path.Combine(KSPUtil.ApplicationRootPath, "GameData", "Kerbcast", "settings.cfg");

        public IReadOnlyList<ModSetting> ListModSettings() => _modSettings.ListModSettings();

        public ModSettingValue ReadModSetting(string id) => _modSettings.ReadModSetting(id);

        public CommandResult WriteModSetting(string id, ModSettingValue value) => _modSettings.WriteModSetting(id, value);

        /// <summary>Why the throttle cannot be reached: Kerbcast absent, a Kerbcast without it, or no save to hold it.</summary>
        private string? ThrottleUnavailable()
        {
            var kerbcast = _kerbcast;
            return kerbcast == null
                ? _unavailableReason ?? "Kerbcast is not loaded"
                : kerbcast.ThrottleUnavailable();
        }

        public void Register(IUplinkHost host)
        {
            RegisterLensNamespace(host);

            var binding = KerbcastBinding.Bind(
                KerbcastBinding.IsKerbcastLoaded(), () => new KerbcastApiAdapter());
            if (binding.Api == null)
            {
                GoInert(host, binding.Reason ?? "kerbcast unavailable");
                return;
            }
            _kerbcast = binding.Api;
            _host = host;
            _governor = NewGovernor(_craftLabels, () => host.Kernel);
            GameEvents.onGameStateLoad.Add(OnGameStateLoad);

            host.AddChannelSource(AvailableTopic, _ => true);
            _cameras = host.Publisher(CamerasTopic);

            // The UNGATED AddSampledSource overload, deliberately. The gated
            // overload skips the capture when nobody is subscribed to the
            // topic, which would make Health() report a stale camera count
            // (or none at all) whenever no camera widget happens to be on the
            // dashboard. The whole point of a MANDATORY healthcheck is that it
            // answers even when nothing is watching, so this capture runs every
            // tick. It stays cheap: kerbcast's camera list is a handful of
            // entries and the docking read is a short module scan per camera.
            host.AddSampledSource(CaptureOnMain, HandleOnCourier);

            host.AddCommandHandler<KerbcastSetFieldOfViewArgs, CommandResult>(
                SetFieldOfViewCommand, HandleSetFieldOfView);
            host.AddCommandHandler<KerbcastSetPanArgs, CommandResult>(
                SetPanCommand, HandleSetPan);
        }

        [MethodImpl(MethodImplOptions.NoInlining)]
        private static IKerbcastGovernor NewGovernor(CraftLabels labels, Func<Kernel?> kernel) =>
            new KerbcastGovernor(
                () => Kerbcast.Api.KerbcastApi.Instance,
                Kerbcast.Api.KerbcastApi.Supports,
                labels,
                kernel);

        private void OnGameStateLoad(ConfigNode node) => _governor?.OnGameLoaded();

        /// <summary>
        /// Declares the namespace the lens commands name as Subject. Registered even
        /// when kerbcast is absent, since a command whose Subject resolves to nothing
        /// takes the whole Uplink offline.
        /// </summary>
        private void RegisterLensNamespace(IUplinkHost host)
        {
            host.RegisterDynamicNamespace(KerbcastLensSites.Prefix, new ChannelDeclaration
            {
                Kind = SampleKind.Discrete,
                Delivery = Delivery.LossyLatest,
                Delay = DelayRole.Delayed,
                Emission = new EmissionPolicy(keyframeIntervalUt: 30, quantum: EmissionQuantum.Absolute(0)),
                PerLensNode = true,
                LensSiteForKey = _lensSites.SiteFor,
            });
        }

        /// <summary>
        /// kerbcast absent or unreadable: report why, and register inert sources
        /// so <c>kerbcast.available:false</c> still reaches the client. That
        /// false is load-bearing, it is what lets a client augment gated on
        /// <c>requires: "kerbcast"</c> compose its slot without kerbcast rather
        /// than waiting forever on a topic that never arrives. (A sibling Uplink
        /// with no presence gate to feed registers nothing here instead.)
        /// </summary>
        private void GoInert(IUplinkHost host, string reason)
        {
            _unavailableReason = reason;
            host.SetAvailability(Availability.Unavailable(reason));
            host.AddChannelSource(AvailableTopic, _ => false);
            host.AddChannelSource(CamerasTopic, _ => new List<object>());
        }

        /// <summary>
        /// MAIN-THREAD capture: reads kerbcast's live camera views and the stock
        /// KSP parts behind them. Returns plain data only, no live Part or
        /// kerbcast handle escapes to the Courier thread.
        /// </summary>
        internal object? CaptureOnMain(KspSnapshot? snapshot)
        {
            // No snapshot, no UT. The publish UT is what the reveal buffer gates
            // on, so a sample stamped 0 is older than every edge and goes straight
            // past the signal delay: live data on a delayed link, with nothing
            // saying so. A tick we cannot date is skipped, the same fail-soft this
            // method already uses when kerbcast is absent.
            if (snapshot == null)
            {
                return null;
            }

            var kerbcast = _kerbcast;
            if (kerbcast == null)
            {
                return null;
            }

            var capture = new CameraCapture { Ut = snapshot.Ut };

            var coreActive = kerbcast.IsActive();
            _coreActive = coreActive;
            _reach = kerbcast.Reach();

            // Read here on the main thread; Health() only sees the cached flags.
            var inFlight = HighLogic.LoadedSceneIsFlight;
            _inFlight = inFlight;
            _coreWatch.Observe(inFlight, coreActive, UnityEngine.Time.realtimeSinceStartup);
            _coreMissingSettled = _coreWatch.Settled;

            // Only an active flight says anything about the sidecar: outside one
            // it is legitimately absent, and a streak of those reads must not
            // carry into the next flight.
            if (inFlight && coreActive)
            {
                _sidecarDebouncer.Observe(kerbcast.SidecarAlive());
            }
            else
            {
                _sidecarDebouncer.Reset();
            }
            _sidecarConfirmedDead = _sidecarDebouncer.ConfirmedDead;

            var now = UnityEngine.Time.realtimeSinceStartup;
            if (coreActive)
            {
                LearnCraftLabels(now);
                _governor?.Tick(snapshot.Ut, now);
            }

            var reported = ActiveVesselId();
            if (!coreActive || reported == null)
            {
                _lensSites.Clear();
                // Definitive empty rather than "no value": kerbcast.cameras is
                // LossyLatest, so publishing nothing would leave the previous
                // vessel's camera list stale on the wire after a scene change,
                // the same trap RaLinkDown documents for comms.
                Volatile.Write(ref _cameraCount, 0);
                capture.Entries = new List<object?>();
                return capture;
            }

            var loaded = new List<KeyValuePair<string, IReadOnlyList<KerbcastView>>>();
            foreach (var craft in FlightGlobals.VesselsLoaded)
            {
                loaded.Add(new KeyValuePair<string, IReadOnlyList<KerbcastView>>(
                    "vessel:" + craft.id, kerbcast.CamerasFor(craft.id)));
            }
            _lensSites.Replace(loaded);

            var vesselId = "vessel:" + reported.Value;
            var views = kerbcast.CamerasFor(reported.Value);
            var entries = new List<object?>(views.Count);

            foreach (var view in views)
            {
                var docking = DockingCameraFacts.FromView(view);
                entries.Add(KerbcastCameraEntryBuilder.Build(view, docking, vesselId));
            }

            Volatile.Write(ref _cameraCount, entries.Count);
            capture.Entries = entries;
            return capture;
        }

        /// <summary>The craft every active-vessel channel reports, the one a kerbal on EVA left; null with no flight.</summary>
        private Guid? ActiveVesselId()
        {
            string? id;
            try
            {
                id = _host?.Kernel?.Query<IActiveVessel>(ActiveVesselCapability.Id).ReportedId;
            }
            catch (Exception)
            {
                return null;
            }
            return Guid.TryParse(id, out var guid) && guid != Guid.Empty ? guid : (Guid?)null;
        }

        /* Names and types only, never position, so a craft the game has since lost still lists under its name. */
        private void LearnCraftLabels(double now)
        {
            if (_craftLabelsRead.HasValue && now - _craftLabelsRead.Value < CraftLabelSeconds)
            {
                return;
            }
            _craftLabelsRead = now;
            var saved = HighLogic.CurrentGame?.flightState?.protoVessels;
            if (saved != null)
            {
                foreach (var proto in saved)
                {
                    if (proto != null)
                    {
                        _craftLabels.Learn(proto.persistentId, new CraftLabel(proto.vesselName, proto.vesselType.ToString()));
                    }
                }
            }
            var live = FlightGlobals.Vessels;
            if (live != null)
            {
                foreach (var vessel in live)
                {
                    if (vessel != null)
                    {
                        _craftLabels.Learn(vessel.persistentId, new CraftLabel(vessel.vesselName, vessel.vesselType.ToString()));
                    }
                }
            }
        }

        /// <summary>COURIER-THREAD handle: publish the captured inventory.</summary>
        internal void HandleOnCourier(object? captured)
        {
            if (captured is not CameraCapture capture || capture.Entries == null)
            {
                return;
            }
            _cameras?.Publish(capture.Entries, capture.Ut);
        }

        /// <summary>
        /// The mandatory healthcheck: polled on the Courier thread every
        /// <c>system.uplinks</c> sample, so it only ever reads cached volatile
        /// state written by the main-thread capture. Never touches KSP or
        /// kerbcast directly.
        ///
        /// <para>The states are meaningfully different, which is the point:
        /// "not installed" is an install problem, "idle" is the normal state
        /// outside a flight, "core not running" in a flight means kerbcast
        /// refused to start, "sidecar not alive" is a
        /// process problem (the video sidecar died: see
        /// <see cref="SidecarDeathDebouncer"/>), and "no cameras" is a craft
        /// problem (you didn't put a camera on it). An operator staring at a
        /// black feed can tell those apart at a glance.</para>
        /// </summary>
        public UplinkHealth Health() => KerbcastHealth.Evaluate(
            _unavailableReason, _inFlight, _coreActive, _coreMissingSettled, !_sidecarConfirmedDead, Volatile.Read(ref _cameraCount), _reach);

        /// <summary>
        /// MAIN-THREAD command: zoom a camera. Runs on the actuator thread the
        /// engine dispatches commands on, after the Courier's delay.
        /// </summary>
        internal CommandResult HandleSetFieldOfView(KerbcastSetFieldOfViewArgs? args)
        {
            var kerbcast = _kerbcast;
            if (args == null)
            {
                return CommandResult.Fail(CommandErrorCode.Range);
            }
            if (kerbcast == null)
            {
                return CommandResult.Fail(CommandErrorCode.ModeUnavailable);
            }
            if (!TryCameraId(args.CameraId, out var cameraId) || !KerbcastLensSites.Agrees(args.LensKey, args.CameraId))
            {
                return CommandResult.Fail(CommandErrorCode.Range);
            }
            return KerbcastAimOutcome.For(kerbcast.SetFov(cameraId, (float)args.FieldOfView));
        }

        /// <summary>MAIN-THREAD command: aim a camera (absolute degrees).</summary>
        internal CommandResult HandleSetPan(KerbcastSetPanArgs? args)
        {
            var kerbcast = _kerbcast;
            if (args == null)
            {
                return CommandResult.Fail(CommandErrorCode.Range);
            }
            if (kerbcast == null)
            {
                return CommandResult.Fail(CommandErrorCode.ModeUnavailable);
            }
            if (!TryCameraId(args.CameraId, out var cameraId) || !KerbcastLensSites.Agrees(args.LensKey, args.CameraId))
            {
                return CommandResult.Fail(CommandErrorCode.Range);
            }
            return KerbcastAimOutcome.For(kerbcast.SetPan(cameraId, (float)args.Yaw, (float)args.Pitch));
        }

        // The wire carries cameraId as a JSON number (long on the contract);
        // kerbcast's handle is a uint. Reject anything that isn't representable
        // rather than wrapping it into a different camera's id.
        private static bool TryCameraId(long value, out uint cameraId)
        {
            if (value < 0 || value > uint.MaxValue)
            {
                cameraId = 0;
                return false;
            }
            cameraId = (uint)value;
            return true;
        }

        private sealed class CameraCapture
        {
            public double Ut;
            public List<object?>? Entries;
        }
    }
}
