using System;
using System.Collections.Generic;
using System.Linq;
using GonogoKerbalismUplink;
using Sitrep.Contract;

namespace Gonogo.KerbalismUplink
{
    /// <summary>
    /// The KerbalismUplink (Domain "kerbalism"): emits space weather, life
    /// support, per-kerbal survival state and the Kerbalism feature flags for the
    /// active vessel, all by reflection over Kerbalism (KerbalismReflection, zero
    /// compile-time link, presence-safe). Presence-gated (kerbalism.available),
    /// mandatory Health(), delay-gated per Topic (presence/features TrueNow, the
    /// vessel telemetry Delayed). Also declares the five File Manager commands
    /// (<see cref="KerbalismFileCommandProvider"/>) and <c>kerbalism.repair</c>.
    /// Commands and providers are registered whether or not Kerbalism has
    /// loaded, since the host takes both once, before a late-loading Kerbalism
    /// may exist; each answers per call from the live presence probe.
    /// </summary>
    [SitrepUplink("kerbalism")]
    public sealed class KerbalismUplink : ISitrepUplink, IModSettingsSource
    {
        private const string AvailableTopic = "kerbalism.available";
        private const string FeaturesTopic = "kerbalism.features";
        private const string SpaceWeatherTopic = "kerbalism.spaceweather";
        private const string LifeSupportTopic = "kerbalism.lifesupport";
        private const string CrewTopic = "kerbalism.crew";
        private const string ProfileTopic = "kerbalism.profile";
        private const string ReliabilityTopic = "kerbalism.reliability";
        private const string ReliabilityPartsTopic = "kerbalism.reliabilityParts";

        private readonly KerbalismReflection _k = new();

        /// <summary>
        /// The elected "science" backend, held rather than constructed per factory
        /// call because it is fed by this Uplink's own main-thread capture: see
        /// <see cref="RegisterScience"/>.
        /// </summary>
        private readonly KerbalismScienceBackend _science = new();

        /// <summary>
        /// The live-Drive actuation seam for the File Manager commands (see
        /// <see cref="RegisterFileManagerCommands"/>). Built in
        /// <see cref="Register"/> rather than the constructor because it needs
        /// the host's Kernel to resolve which craft it is acting on, and the
        /// Kernel does not exist until then.
        /// </summary>
        private IKerbalismFileActuator? _fileActuator;

        /// <summary>
        /// Core's capability registry, held from <see cref="Register"/> so the
        /// main-thread captures can ask which craft they are about. See
        /// <see cref="ScopedVessel"/>.
        /// </summary>
        private Kernel? _kernel;

        /// <summary>
        /// The currency-delay science hook: a presence-gated Harmony postfix on Kerbalism's own
        /// RetrieveScience, handing each retrieved increment to the currency-delay core's
        /// source-agnostic DelayedScienceSink. Held so <see cref="Register"/> attaches it once.
        /// </summary>
        private readonly KerbalismScienceHook _scienceHook = new();

        /// <summary>The same reads, for every other craft: see <see cref="KerbalismFleetChannels"/>.</summary>
        private readonly KerbalismFleetChannels _fleet;

        private IChannelPublisher? _spaceWeather;
        private IChannelPublisher? _lifeSupport;
        private IChannelPublisher? _crew;
        private IChannelPublisher? _reliability;
        private IChannelPublisher? _reliabilityParts;

        /// <summary>Built once on first use; see <see cref="Profile"/>.</summary>
        private ProfileRaw? _profile;

        public UplinkManifest Manifest { get; }

        private readonly KerbalismModSettings _modSettings;

        public KerbalismUplink()
        {
            _fleet = new KerbalismFleetChannels(_k, CaptureVessel);
            _modSettings = new KerbalismModSettings(
                () => _k.IsAvailable ? null : "Kerbalism is not installed",
                _k.Features,
                () => HighLogic.CurrentGame != null,
                _k.ReliabilityPreferences);

            Manifest = new UplinkManifest
            {
                Id = "kerbalism",
                Version = UplinkBuildVersion.Value,
                // Null when the generated const is empty so the loader degrades to the
                // two-way check; a real sha256-... once the release build bakes it.
                Name = Provenance.Name,
                Author = Provenance.Author,
                Repo = Provenance.Repo,
                ExpectedClientHash = string.IsNullOrEmpty(ExpectedClientHash.Value) ? null : ExpectedClientHash.Value,
                // DevPath is null unless a dev build supplied one: the loader prefers it,
                // so a released DLL carrying one points every user at another machine.
                ClientSource = new UplinkClientSource
                {
                    Url = ClientSource.Url,
                    DevPath = string.IsNullOrEmpty(ClientSource.DevPath) ? null : ClientSource.DevPath,
                },
                Channels = new List<ChannelDeclaration>
                {
                    TrueNow(AvailableTopic, SampleKind.Discrete),
                    TrueNow(FeaturesTopic, SampleKind.Discrete),
                    Static(ProfileTopic, SampleKind.Discrete),
                    Delayed(SpaceWeatherTopic, SampleKind.Continuous),
                    Delayed(LifeSupportTopic, SampleKind.Continuous),
                    Delayed(CrewTopic, SampleKind.Continuous),
                    Delayed(ReliabilityTopic, SampleKind.Discrete),
                    Delayed(ReliabilityPartsTopic, SampleKind.Continuous),
                },
                Commands = KerbalismCommandCatalog.All(),
                ErrorCodes = ErrorCodeCatalog.Of(typeof(KerbalismErrorCodes)),
            };
        }

        private static ChannelDeclaration TrueNow(string topic, SampleKind kind) => new()
        {
            Topic = topic,
            Kind = kind,
            Delivery = Delivery.LossyLatest,
            Emission = new EmissionPolicy(keyframeIntervalUt: 30, quantum: EmissionQuantum.Absolute(0)),
            Delay = DelayRole.TrueNow,
        };

        /// <summary>
        /// A ground-side fact that never changes within a session (swapping the
        /// Kerbalism profile is a KSP restart). Keyframed occasionally so a late
        /// or rejoining subscriber still gets it, and sampled at most once a
        /// minute so a static payload costs nothing to carry.
        /// </summary>
        private static ChannelDeclaration Static(string topic, SampleKind kind) => new()
        {
            Topic = topic,
            Kind = kind,
            Delivery = Delivery.LossyLatest,
            Emission = new EmissionPolicy(
                keyframeIntervalUt: 300,
                quantum: EmissionQuantum.Absolute(0),
                minSampleIntervalUt: 60),
            Delay = DelayRole.TrueNow,
        };

        private static ChannelDeclaration Delayed(string topic, SampleKind kind) => new()
        {
            Topic = topic,
            Kind = kind,
            Delivery = Delivery.LossyLatest,
            Emission = new EmissionPolicy(keyframeIntervalUt: 30, quantum: EmissionQuantum.Absolute(0)),
            Delay = DelayRole.Delayed,
        };

        public void Register(IUplinkHost host)
        {
            _kernel = host.Kernel;
            _fileActuator = new KerbalismFileActuator(_k, host.Kernel);

            // Ground-side facts (presence + feature flags): pull-style, Courier-thread,
            // no live-KSP read beyond the cheap reflection cache.
            host.AddChannelSource(AvailableTopic, _ => _k.IsAvailable);
            host.AddChannelSource(FeaturesTopic, _ =>
                _k.IsAvailable ? KerbalismCapture.BuildFeatures(_k.Features()) : null);
            host.AddChannelSource(ProfileTopic, _ =>
                _k.IsAvailable ? KerbalismCapture.BuildProfile(Profile()) : null);

            _spaceWeather = host.Publisher(SpaceWeatherTopic);
            _lifeSupport = host.Publisher(LifeSupportTopic);
            _crew = host.Publisher(CrewTopic);
            _reliability = host.Publisher(ReliabilityTopic);
            _reliabilityParts = host.Publisher(ReliabilityPartsTopic);

            // The rest of the fleet on the same reads, one namespace per craft
            // and gated per craft (see KerbalismFleetChannels). Registered
            // unconditionally alongside the active-vessel channels: its capture
            // does nothing at all until a client subscribes to a specific craft.
            _fleet.RegisterInto(host);

            // Vessel telemetry: capture live Kerbalism on the main thread, publish off it.
            host.AddSampledSource(
                CaptureOnMain,
                HandleOnCourier,
                SpaceWeatherTopic,
                LifeSupportTopic,
                CrewTopic);

            RegisterScience(host);
            RegisterIsru(host);
            RegisterFileManagerCommands(host, _fileActuator);
            RegisterReliability(host);
        }

        private const int ScienceHookAttempts = 5;
        private const long ScienceHookRetryMs = 2000;
        private static readonly System.Diagnostics.Stopwatch ScienceHookClock = System.Diagnostics.Stopwatch.StartNew();
        private int _scienceHookAttempts;
        private long _nextScienceHookMs;

        /// <summary>
        /// Attaches the currency-delay science hook once Kerbalism is found, which
        /// may be well after <see cref="Register"/>. Kerbalism credits science
        /// through a pooled, vessel-less buffer the stock currency interceptor can't
        /// see, so this presence-gated Harmony postfix is the only way that science
        /// gets delayed. The hook forwards to whatever the "delayedScience"
        /// capability elects, resolved through the Kernel; if the core scenario
        /// isn't active the forward is a silent no-op. Called from the main-thread
        /// capture, retried a few times on a short interval, then left alone.
        /// </summary>
        private void AttachScienceHookWhenAvailable()
        {
            if (_kernel == null || _scienceHook.Attached || _scienceHookAttempts >= ScienceHookAttempts) return;
            if (!_k.IsAvailable) return;
            var now = ScienceHookClock.ElapsedMilliseconds;
            if (now < _nextScienceHookMs) return;
            _nextScienceHookMs = now + ScienceHookRetryMs;
            _scienceHookAttempts++;
            try
            {
                _scienceHook.TryAttach(_kernel);
            }
            catch (Exception ex)
            {
                Console.Error.WriteLine("[KerbalismUplink] could not attach currency-delay science hook: " + ex.Message);
            }
        }

        /// <summary>
        /// The two reliability topics and the repair command, on Kerbalism's own
        /// reliability reader.
        ///
        /// <para>The capture is gated on subscriptions to either topic, so the
        /// per-module walk costs nothing while no client is looking, and it
        /// returns nothing while Kerbalism is definitely not
        /// breaking parts (<see cref="KerbalismReliabilityBackend.Capture"/>): a
        /// save with failures switched off publishes no reliability at all rather
        /// than a craft full of clean parts.</para>
        /// </summary>
        private void RegisterReliability(IUplinkHost host)
        {
            var reliability = new KerbalismReliabilityBackend(_k, host.Kernel);
            host.AddSampledSource(
                snapshot => snapshot == null || reliability.Capture() is not { } capture
                    ? null
                    : new ReliabilitySample(snapshot.Ut, capture),
                HandleReliabilityOnCourier,
                ReliabilityTopic,
                ReliabilityPartsTopic);
            host.AddCommandHandler<KerbalismRepairPartArgs, CommandResult<KerbalismRepairOutcome>>(
                KerbalismCommandCatalog.RepairCommand,
                args => reliability.Repair(args?.PartId ?? "", args?.CrewName ?? ""));
        }

        /// <summary>COURIER-THREAD handle: publish both reliability payloads at the capture's UT. No KSP access.</summary>
        private void HandleReliabilityOnCourier(object? captured)
        {
            if (captured is not ReliabilitySample sample) return;
            _reliability?.Publish(KerbalismCapture.BuildReliabilitySummary(sample.Capture.Summary), sample.Ut);
            _reliabilityParts?.Publish(KerbalismCapture.BuildReliabilityParts(sample.Capture.Parts), sample.Ut);
        }

        private sealed class ReliabilitySample
        {
            public readonly double Ut;
            public readonly KerbalismReliabilityCapture Capture;

            public ReliabilitySample(double ut, KerbalismReliabilityCapture capture)
            {
                Ut = ut;
                Capture = capture;
            }
        }

        /// <summary>
        /// Register Kerbalism as the "isru" provider, above the stock vanilla backend
        /// so it wins when Kerbalism is installed. Registered unconditionally and
        /// answered through <see cref="KerbalismProviders"/>, the same as science
        /// below, with the same two-pass guarantee: the capability is
        /// owned and declared by IsruCoreUplink (bundled core) in the pre-Register
        /// pass, so it exists here regardless of assembly-scan order.
        ///
        /// <para>Unlike science, this provider needs no capture source of its own:
        /// IsruCoreUplink calls the elected backend from its main-thread capture, so
        /// the reads are already on the right thread and the factory can simply
        /// construct rather than hand back a fed instance.</para>
        /// </summary>
        private void RegisterIsru(IUplinkHost host)
        {
            try
            {
                KerbalismProviders.RegisterIsru(host.Kernel, () => _k.IsAvailable, new KerbalismIsruBackend(_k, host.Kernel));
            }
            catch (Exception ex)
            {
                Console.Error.WriteLine("[KerbalismUplink] could not register isru provider: " + ex.Message);
            }
        }

        /// <summary>
        /// Wire the five File Manager commands to <see cref="KerbalismFileCommandProvider"/>'s
        /// KSP-free handlers, each closed over <see cref="_fileActuator"/> (the
        /// live Drive) and the science backend's latest capture (the
        /// pre-filter snapshot; see <see cref="KerbalismScienceBackend.Latest"/>).
        /// Called from <see cref="Register"/> after <see cref="RegisterScience"/>
        /// has already wired the capture that feeds that snapshot. Registered
        /// whether or not Kerbalism has loaded: until it has, the snapshot is
        /// empty and every verb refuses with ScienceNotModelled.
        ///
        /// <para>The verbs here read that snapshot on the Courier thread, so it
        /// has to be true whether or not anything is watching a science channel.
        /// That is why the capture feeding it is registered ungated: the gated
        /// overload would skip it in an unwatched session, leaving the pre-filter
        /// empty and every verb refusing with ModeUnavailable, which asserts
        /// Kerbalism is not modelling science about an install that is.</para>
        /// </summary>
        private void RegisterFileManagerCommands(IUplinkHost host, IKerbalismFileActuator actuator)
        {
            host.AddCommandHandler<KerbalismSubjectFlagArgs, CommandResult>(
                KerbalismFileCommandProvider.SendCommand,
                args => KerbalismFileCommandProvider.HandleSend(actuator, _science.Latest, args));
            host.AddCommandHandler<KerbalismSubjectActionArgs, CommandResult>(
                KerbalismFileCommandProvider.DeleteCommand,
                args => KerbalismFileCommandProvider.HandleDelete(actuator, _science.Latest, args));
            host.AddCommandHandler<KerbalismSubjectFlagArgs, CommandResult>(
                KerbalismFileCommandProvider.AnalyzeCommand,
                args => KerbalismFileCommandProvider.HandleAnalyze(actuator, _science.Latest, args));
            host.AddCommandHandler<KerbalismSubjectActionArgs, CommandResult>(
                KerbalismFileCommandProvider.DumpCommand,
                args => KerbalismFileCommandProvider.HandleDump(actuator, _science.Latest, args));
            host.AddCommandHandler<KerbalismSubjectActionArgs, CommandResult>(
                KerbalismFileCommandProvider.MoveToLabCommand,
                args => KerbalismFileCommandProvider.HandleMoveToLab(actuator, _science.Latest, args));
        }

        /// <summary>
        /// Register Kerbalism as the "science" provider, above the stock vanilla
        /// backend so it wins when Kerbalism is installed. Registered
        /// unconditionally and answered through <see cref="KerbalismProviders"/>,
        /// the same as isru above, with the same two-pass guarantee: the capability is owned and declared by ScienceCoreUplink
        /// (bundled core) in the pre-Register pass, so it exists here regardless of
        /// assembly-scan order.
        ///
        /// <para>Unlike isru, this provider is stateful: its reads run on the
        /// Courier thread and Kerbalism's science lives in PartModules that must be
        /// read on the main thread, so it is fed by its own capture-on-main source
        /// below and the same instance has to be both fed and elected. Hence one
        /// instance closed over by the factory, rather than a factory that
        /// constructs.</para>
        ///
        /// <para>The capture is gated on <c>"science."</c> subscriptions, so a
        /// vessel-wide drive/module walk costs nothing while no client is looking at
        /// science. The gate is a pure early-out: a late subscriber still gets the
        /// current value the ordinary way.</para>
        /// </summary>
        private void RegisterScience(IUplinkHost host)
        {
            try
            {
                KerbalismProviders.RegisterScience(host.Kernel, () => _k.IsAvailable, _science);
            }
            catch (Exception ex)
            {
                Console.Error.WriteLine("[KerbalismUplink] could not register science provider: " + ex.Message);
                return;
            }

            /*
             * UNGATED deliberately, and it must stay that way. The gated
             * overload skips the capture entirely while nothing under the
             * prefix is watched, which is safe only when a capture's whole
             * effect is its return value. This one's is not: the Courier
             * handler stashes into the science backend, and the five File
             * Manager verbs read that stash as their pre-filter. Gated, an
             * unwatched session left the stash empty and every verb refused
             * with ModeUnavailable, which asserts Kerbalism is not modelling
             * science about an install that is.
             *
             * The channels cost nothing extra for this: the engine samples a
             * channel source only when it is subscribed, so the publish side
             * is still demand-driven. What the ungating buys is a stash that
             * is true whether or not anyone happens to be watching.
             */
            host.AddSampledSource(CaptureScienceOnMain, HandleScienceOnCourier);

            _science.UseRunActuator(new KerbalismRunActuator(_k, host.Kernel));
        }

        /// <summary>
        /// The craft these channels are about, from core's <c>activeVessel</c>
        /// capability rather than from KSP.
        ///
        /// <para>Life support is the reason this one matters most. KSP's answer
        /// during an EVA is the kerbal, whose suit carries minutes of oxygen, so
        /// <c>kerbalism.lifesupport</c> and <c>kerbalism.crew</c> would swap the
        /// ship's days of margin for a suit's countdown and the operator would
        /// read it as the ship's. Null when core does not publish the capability,
        /// which stops the channels emitting rather than emitting the suit's
        /// numbers.</para>
        ///
        /// <para>Queried per call, as <see cref="IActiveVessel"/> requires: the
        /// answer changes on a vessel switch, a dock, an undock, and on both ends
        /// of an EVA.</para>
        /// </summary>
        private Vessel? ScopedVessel() => _kernel.ReportedVessel() as Vessel;

        /// <summary>MAIN-THREAD capture: read live Kerbalism science into a plain bundle (no KSP handles cross threads).</summary>
        private object? CaptureScienceOnMain(KspSnapshot? snapshot)
        {
            AttachScienceHookWhenAvailable();
            var v = ScopedVessel();
            if (v == null || !_k.IsAvailable) return null;
            return _k.Science(v);
        }

        /// <summary>COURIER-THREAD handle: hand the capture to the elected backend, which maps it per channel. No KSP access.</summary>
        private void HandleScienceOnCourier(object? captured)
        {
            if (captured is ScienceRaw raw) _science.Stash(raw);
        }

        /// <summary>
        /// MAIN-THREAD capture: read live Kerbalism into a plain bundle (no KSP
        /// handles cross threads). No snapshot means no capture: every reading in
        /// the bundle is published at the snapshot's UT, and a substituted zero
        /// stamps the whole thing at the epoch, which dates a live reading to
        /// before the save began.
        /// </summary>
        private object? CaptureOnMain(KspSnapshot? snapshot) =>
            snapshot == null ? null : CaptureVessel(ScopedVessel(), snapshot.Ut);

        /// <summary>
        /// MAIN-THREAD capture of one craft, active or not. Every read here
        /// answers for an unloaded vessel as well as a loaded one: Kerbalism's
        /// resource cache walks proto part snapshots when the parts are gone,
        /// its habitat info has an unloaded mode of its own, and the per-kerbal
        /// rule accumulators are advanced by the vessel's own background turn.
        ///
        /// <para>The one exception is the process list, which lives on the part
        /// modules KSP discards on unload, so it is left null rather than empty
        /// for a background craft: see <c>KerbalismLifeSupport.Processes</c> for
        /// why the difference is load-bearing.</para>
        ///
        /// <para><see cref="KerbalismCaptured.AsOfUt"/> carries when Kerbalism
        /// last recomputed all this, which for a background craft is not now:
        /// unloaded vessels take their turns one per tick, in rotation.</para>
        /// </summary>
        internal KerbalismCaptured? CaptureVessel(Vessel v, double ut)
        {
            if (v == null || !_k.IsAvailable) return null;

            double? R(string res) => _k.ApiResource("ResourceAmount", v, res);
            double? Cap(string res) => _k.ApiResource("ResourceCapacity", v, res);
            double? Rate(string res) => _k.ApiResource("ResourceAverageRate", v, res);

            var profile = Profile();
            // One rate per resource the LOADED PROFILE mentions, not per name we
            // picked. `ResourceAverageRate` needs a name to ask about, so
            // something must enumerate; the only honest enumerator is the profile
            // itself, and it is the same list kerbalism.profile publishes so the
            // two cannot drift.
            var s = KerbalismCapture.BuildSnapshot(
                name => _k.Api(name, v),
                name => _k.ApiBool(name, v),
                R,
                Cap,
                KerbalismCapture.ResourceNames(profile),
                Rate);

            var modifierCtx = _k.BeginModifierContext(v);
            List<ProcessRaw>? processes = null;
            if (v.loaded)
            {
                processes = new List<ProcessRaw>(_k.Processes(v));
                ApplyProcessEnvModifiers(_k, processes, profile, v, modifierCtx);
            }

            var sinceEval = _k.SecondsSinceLastEvaluation(v);

            var crew = new List<KerbalRulesRaw>(_k.CrewRules(v));
            _k.FillRuleVarianceFactors(v, profile.Rules, crew);

            return new KerbalismCaptured
            {
                Ut = ut,
                Snapshot = s,
                Processes = processes,
                Crew = crew,
                RuleConstants = _k.RuleConstants(),
                Solar = _k.Solar(v),
                StormEjectionSpeed = _k.StormEjectionSpeed(),
                RuleEnvModifiers = RuleEnvModifiers(profile, v, modifierCtx),
                AsOfUt = sinceEval.HasValue ? ut - sinceEval.Value : (double?)null,
                Rules = profile.Rules,
                RuleInputAmounts = KerbalismCapture.RuleInputAmounts(profile, R),
            };
        }

        /// <summary>
        /// Joins each captured process instance onto its profile Process definition
        /// by the pseudo-resource token (entry.Resource), then evaluates Kerbalism's
        /// live modifier product over that definition's modifiers minus the join
        /// token itself (already accounted for via Capacity; see
        /// KerbalismProcessEntry.EnvModifier's doc comment for why it must be
        /// excluded). Mutates each ProcessRaw in place.
        ///
        /// <para>Static and internal because the ISRU backend needs the identical
        /// join: its converter rates are the same processes scaled by the same live
        /// product, and two copies of this would drift into two different numbers for
        /// one part.</para>
        /// </summary>
        internal static void ApplyProcessEnvModifiers(
            KerbalismReflection k,
            List<ProcessRaw> processes,
            ProfileRaw profile,
            Vessel v,
            KerbalismReflection.ModifierContext? ctx)
        {
            if (processes.Count == 0) return;
            var byModifierToken = new Dictionary<string, ProcessDefRaw>(StringComparer.Ordinal);
            foreach (var def in profile.Processes)
                foreach (var token in def.Modifiers)
                    byModifierToken[token] = def;

            foreach (var p in processes)
            {
                if (string.IsNullOrEmpty(p.Resource) || !byModifierToken.TryGetValue(p.Resource, out var def)) continue;
                var filtered = def.Modifiers.Where(m => m != p.Resource).ToList();
                p.EnvModifier = k.EvaluateModifiers(ctx, v, filtered);
            }
        }

        /// <summary>
        /// Live modifier product per rule name, over each rule's full modifier
        /// list (rules have no pseudo-resource join token to exclude, unlike
        /// processes). See KerbalismLifeSupport.RuleEnvModifiers' doc comment for
        /// why this rides the live lifesupport capture rather than the static
        /// profile channel.
        /// </summary>
        private Dictionary<string, double> RuleEnvModifiers(
            ProfileRaw profile, Vessel v, KerbalismReflection.ModifierContext? ctx)
        {
            var result = new Dictionary<string, double>(StringComparer.Ordinal);
            foreach (var rule in profile.Rules)
            {
                var k = _k.EvaluateModifiers(ctx, v, rule.Modifiers);
                if (k.HasValue) result[rule.Name] = k.Value;
            }
            return result;
        }

        /// <summary>
        /// The loaded profile, read once. `Profile.rules`/`.processes`/`.supplies`
        /// are static and do not change after load, so rebuilding this per sample
        /// would be the one way to make a static Topic expensive.
        /// </summary>
        private ProfileRaw Profile() => _profile ??= _k.Profile();

        /// <summary>COURIER-THREAD handle: publish the captured value trees. No KSP access.</summary>
        private void HandleOnCourier(object? captured)
        {
            if (captured is not KerbalismCaptured c) return;
            _spaceWeather?.Publish(
                KerbalismCapture.BuildSpaceWeather(c.Snapshot, c.Solar.Stars, c.Solar.Storms, c.StormEjectionSpeed), c.Ut);
            _lifeSupport?.Publish(
                KerbalismCapture.BuildLifeSupport(c.Snapshot, c.Processes, c.Snapshot.Rates, c.RuleEnvModifiers, c.AsOfUt),
                c.Ut);
            _crew?.Publish(
                KerbalismCapture.BuildCrew(c.Crew, c.RuleConstants, c.AsOfUt, c.DeathClocks()), c.Ut);
        }

        public IReadOnlyList<ModSetting> ListModSettings() => _modSettings.ListModSettings();

        public ModSettingValue ReadModSetting(string id) => _modSettings.ReadModSetting(id);

        public UplinkHealth Health()
        {
            if (!_k.IsAvailable)
            {
                return new UplinkHealth(UplinkHealthState.Unavailable, "Kerbalism assembly not loaded");
            }
            return UplinkHealth.Healthy;
        }

        /// <summary>Plain cross-thread bundle: no live KSP references.</summary>
        internal sealed class KerbalismCaptured
        {
            public double Ut;
            public KerbalismSnapshot Snapshot;

            /// <summary>Null for a background craft, whose part modules KSP has discarded: absent, not empty.</summary>
            public List<ProcessRaw>? Processes;
            public List<KerbalRulesRaw> Crew = new();
            public IReadOnlyDictionary<string, RuleConstants> RuleConstants = new Dictionary<string, RuleConstants>();
            public SolarRaw Solar = new();
            public double? StormEjectionSpeed;
            public IReadOnlyDictionary<string, double> RuleEnvModifiers = new Dictionary<string, double>();

            /// <summary>When Kerbalism last recomputed this, null when unreadable, never the read time standing in.</summary>
            public double? AsOfUt;

            /// <summary>The loaded profile's rule definitions, carried so the deadline can be derived off-thread.</summary>
            public List<RuleDefRaw> Rules = new();

            /// <summary>Units held of each rule input resource: the death clock's first stage.</summary>
            public IReadOnlyDictionary<string, double> RuleInputAmounts = new Dictionary<string, double>();

            /// <summary>
            /// Kerbal name -> soonest fatal deadline in seconds, null where not
            /// derivable. Derived rather than read, so it is computed once on the
            /// Courier thread by <see cref="DeathClocks"/> and shared by every
            /// publisher of this bundle.
            /// </summary>
            public IReadOnlyDictionary<string, double?> DeathClocks()
            {
                var map = new Dictionary<string, double?>(Crew.Count, StringComparer.Ordinal);
                foreach (var k in Crew)
                {
                    if (k == null || string.IsNullOrEmpty(k.Name)) continue;
                    map[k.Name] = KerbalismDeathClock.SoonestFatalSeconds(
                        k, Rules, RuleEnvModifiers, RuleInputAmounts, Snapshot.Rates);
                }
                return map;
            }
        }
    }
}
