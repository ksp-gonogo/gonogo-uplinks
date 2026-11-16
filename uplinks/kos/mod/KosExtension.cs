// GonogoKosUplink: GPLv3. See GonogoKosUplink.csproj's header comment for the
// licence/linkage rationale.

using System;
using System.Collections.Generic;
using System.Threading;
using Sitrep.Contract;

[assembly: System.Runtime.CompilerServices.InternalsVisibleTo("GonogoKosUplink.Tests")]

namespace Gonogo.KosUplink
{
    /// <summary>
    /// The kOS bridge Uplink: the <c>kos.processors</c> CPU listing, each
    /// CPU's live terminal, and scripts run on a CPU by path with
    /// <c>kos.run</c>, whose result a script hands back with
    /// <c>ADDONS:GONOGO:RETURN</c> (<c>KosGonogoAddon</c>).
    ///
    /// <para><b>Every kOS call runs on the KSP main thread</b>: CPU
    /// enumeration and every command route through <see cref="Dispatcher"/>.
    /// The engine's own capture-on-main / handle-on-Courier seam
    /// (<see cref="IUplinkHost.AddSampledSource"/>) carries the processor
    /// listing across to the Courier thread.</para>
    ///
    /// <para><b>File split:</b> this file is the KSP/Unity/kOS-FREE half,
    /// everything <c>GonogoKosUplink.Tests</c> Compile-Includes directly (mirrors
    /// <c>GonogoScansatUplink</c>/<c>GonogoScansatUplink.Tests</c>'s pure-logic
    /// split). The kOS/Unity-touching half (<c>Register</c>, the
    /// <c>kOSProcessor</c> reads, the real GameObject
    /// wiring) lives in the other half of this <c>partial class</c>,
    /// <see cref="KosExtension"/> in <c>KosExtension.Ksp.cs</c>, which the test
    /// project deliberately does not compile, a headless build has no
    /// kOS.dll/UnityEngine.dll reference assemblies to link against. The two
    /// halves meet at <see cref="InstallProductionDefaults"/>, a partial
    /// method: implemented (real kOS/Unity wiring) in the production
    /// assembly, silently a no-op when the implementing file isn't part of
    /// the compilation (the test build): the standard "optional partial
    /// method" behaviour, not a special-cased seam.</para>
    /// </summary>
    [SitrepUplink("kos")]
    public sealed partial class KosExtension : ISitrepUplink, IUplinkTimelineListener
    {
        // Bound in InstallProductionDefaults() (KosExtension.Ksp.cs) for a
        // production instance; a caller-supplied value (e.g. a test) is left
        // untouched: see the ctor's useProductionDefaults gate below. Never
        // readonly: the production path fills it in AFTER construction-time
        // field initialisers/params have run, from the same class's
        // KSP-touching half.
        private Action<MainThreadDispatcher> _bindDispatcherAddon;

        // Assigned only in RegisterKspBindings (KosExtension.Ksp.cs): the
        // headless test build never calls Register, so the compiler can't see
        // an assignment in THIS half and warns. Harmless; suppressed rather
        // than worked around, so the CI log stays clean without inventing a
        // fake assignment.
#pragma warning disable CS0649 // field is never assigned to in this compilation unit
        private IChannelPublisher? _processorsPublisher;

        // Health state (see ISitrepUplink.Health / KosHealth), mirroring
        // KerbcastUplink's volatile-field pattern exactly: _unavailableReason
        // is written once, in RegisterKspBindings (KosExtension.Ksp.cs), when
        // the kOS version guard fails; _sampledOnce/_lastProcessorCount are
        // written on the Courier thread by HandleProcessors below, every
        // kos.processors sample. Health() itself is polled on EVERY
        // system.uplinks sample and must stay cheap/non-blocking, hence
        // volatile reads of cached state rather than touching kOS directly.
        private volatile string? _unavailableReason;
        private volatile bool _sampledOnce;
        private int _lastProcessorCount = -1;

        // Interactive terminal-over-Uplink: the kos.terminal.<coreId> screen
        // downlink + single-owner keystroke/resize/open/close commands that
        // replace the standalone telnet proxy. Null until Register wires them.
#pragma warning disable CS0169 // field is never read in this compilation unit (RegisterKspBindings is the only reader)
        private IDynamicChannelSource? _terminalSource;
#pragma warning restore CS0169
        private KosTerminalManager? _terminalManager;
#pragma warning restore CS0649

        // kos.run: start a script by path and answer on kos.run.<coreId> when
        // it returns, fails or ends. _runManager is pure bookkeeping,
        // constructed unconditionally so headless tests can wire a recording
        // publisher via WireRunForTests without needing KosExtension.Register
        // at all. _runSource (the actual wire publisher) is assigned only in
        // RegisterKspBindings, same "assigned in the other half" story as
        // _terminalSource above.
        private readonly KosRunManager _runManager = new KosRunManager();

        /// <summary>
        /// Disarms every pending <c>kos.run</c>: a load or revert destroys the
        /// processors the scripts were running on, so their results never print.
        /// </summary>
        public void OnTimelineReset(bool saveChanged) => _runManager.Reset();

        /// <summary>
        /// Whether a CPU's interpreter is back at its prompt with nothing queued
        /// to type, so a run armed on it has ended. Wired to kOS in
        /// <c>RegisterKspBindings</c>; null in headless tests that do not need it.
        /// </summary>
        internal Func<int, bool>? CpuIsIdle { get; set; }

        /// <summary>Ends armed runs whose CPU has returned to its prompt without printing a block. Driven from the main-thread update.</summary>
        internal void PollRuns()
        {
            var idle = CpuIsIdle;
            if (idle != null)
            {
                _runManager.PollIdle(idle);
            }
        }
#pragma warning disable CS0169 // field is never read in this compilation unit (RegisterKspBindings is the only reader)
        private IDynamicChannelSource? _runSource;
#pragma warning restore CS0169

        // Error sink for the command main-thread path. Kept as a delegate (not
        // a direct UnityEngine.Debug call) so the KSP-free half of this class
        // never references UnityEngine at compile time. Defaults to a no-op;
        // InstallProductionDefaults() swaps in Debug.LogError for a production
        // instance.
        private Action<string> _logError = _ => { };

        public MainThreadDispatcher Dispatcher { get; }

        public KosExtension() : this(null, null)
        {
        }

        internal KosExtension(MainThreadDispatcher? dispatcher, Action<MainThreadDispatcher>? bindDispatcherAddon)
        {
            // Only the true default path (the public parameterless ctor,
            // i.e. real production construction) picks up the real kOS/Unity
            // wiring. A caller that supplies either argument explicitly (every
            // headless test) keeps exactly what it passed. The real defaults
            // sit behind InstallProductionDefaults() rather than in `??`
            // expressions here, so this constructor itself stays KSP-free.
            bool useProductionDefaults = dispatcher == null && bindDispatcherAddon == null;

            Dispatcher = dispatcher ?? new MainThreadDispatcher(
                ex => _logError("[Gonogo.KosUplink] dispatched action threw: " + ex));
            _bindDispatcherAddon = bindDispatcherAddon ?? (_ => { });

            if (useProductionDefaults)
            {
                InstallProductionDefaults();
            }
        }

        /// <summary>
        /// KSP-touching production wiring seam. Implemented in
        /// <c>KosExtension.Ksp.cs</c> (installs the real Debug.LogError sink
        /// and the real GameObject/addon binder):
        /// that file is excluded from the headless test build, so there this
        /// partial method has no implementing declaration and every call
        /// below compiles away to nothing (standard C# optional-partial-method
        /// behaviour), leaving the KSP-free placeholders in place.
        /// </summary>
        partial void InstallProductionDefaults();

        /// <summary>
        /// <see cref="ISitrepUplink.Register"/>. The interface member itself
        /// must exist in this KSP-free half, <c>UplinkDiscovery</c>'s
        /// reflection scan (exercised headlessly by
        /// <c>KosExtensionDiscoveryTests</c>) requires a fully-implemented
        /// <see cref="ISitrepUplink"/> even though it never calls
        /// <see cref="Register"/>: so it forwards, unconditionally, to
        /// <see cref="RegisterKspBindings"/>: the real kOS/Unity wiring in
        /// <c>KosExtension.Ksp.cs</c>, a silent no-op here when that file
        /// isn't part of the compilation (the headless test build).
        /// </summary>
        public void Register(IUplinkHost host)
        {
            RegisterKspBindings(host);
        }

        /// <summary>The kOS/Unity-touching body of <see cref="Register"/>: see <c>KosExtension.Ksp.cs</c>.</summary>
        partial void RegisterKspBindings(IUplinkHost host);

        /// <summary>
        /// Every kOS channel and command needs a CPU, and a CPU needs a part
        /// this career has researched: core's part-module evaluator names the
        /// cheapest node carrying one, read off the installed parts, so a tree
        /// that moves the kOS parts is answered by its own placement.
        /// </summary>
        internal static CommandRequirement[] NeedsProcessor => new[]
        {
            new CommandRequirement { Kind = "part-module-researched", Quantity = "kOSProcessor" },
        };

        private UplinkManifest? _manifest;

        public UplinkManifest Manifest => _manifest ??= BuildManifest();

        private UplinkManifest BuildManifest() => new UplinkManifest
        {
            Id = "kos",
            Version = UplinkBuildVersion.Value,
            // Null when the generated const is empty so the loader degrades to the two-way
            // check. It is a real sha256-...: baked from the bundle the app's own build emits
            // (packages/app/scripts/bake-uplink-hash.ts → ExpectedClientHash.g.cs) and held
            // current by bakedClientHash.test.ts, because a hash that has fallen behind its
            // client source is a refusal on every load rather than a stale artifact.
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
                // CPU listing: vessel-derived (which CPUs exist), rides the
                // delay clock like every other vessel-sourced channel.
                new ChannelDeclaration
                {
                    Topic = KosChannels.ProcessorsTopic,
                    Kind = SampleKind.Discrete,
                    Delivery = Delivery.LossyLatest,
                    Emission = new EmissionPolicy(keyframeIntervalUt: 30, quantum: EmissionQuantum.Absolute(0)),
                    Delay = DelayRole.Delayed,
                    Requires = NeedsProcessor,
                },
                // P2: kos.file. The kos.terminal.<coreId> screen downlink is a
                // ReliableOrdered dynamic namespace registered in Register (like
                // the compute feed), not a static manifest channel.
            },
            Commands = new List<CommandDeclaration>
            {
                // All five ride gonogo's SignalDelay to the craft, declared on
                // their args types in this Uplink's contract slice rather than
                // here, so the client reads the same answer
                // (SitrepCommandAttribute.Delay). Keystrokes, open and close
                // are genuine remote input, with the lease-token and idle guards
                // re-checked at delivery on the main thread.
                new CommandDeclaration { Command = KosChannels.TerminalOpenCommand, Subject = KosChannels.TerminalPrefix + "{args.CoreId}", Requires = NeedsProcessor },
                new CommandDeclaration { Command = KosChannels.KeystrokeCommand, Subject = KosChannels.TerminalPrefix + "{args.CoreId}", Requires = NeedsProcessor },
                // Resize delays with the rest, which costs a converging
                // terminal: the mod keeps diffing its cursor-addressed screen at
                // the old width for a light-time round trip, so xterm draws
                // those diffs at the wrong column until the new width lands. The
                // alternative, applying it instantly, would let one console
                // reflow a terminal another console is reading in real time, and
                // a resize is an order like any other.
                new CommandDeclaration { Command = KosChannels.TerminalResizeCommand, Subject = KosChannels.TerminalPrefix + "{args.CoreId}", Requires = NeedsProcessor },
                new CommandDeclaration { Command = KosChannels.TerminalCloseCommand, Subject = KosChannels.TerminalPrefix + "{args.CoreId}", Requires = NeedsProcessor },
                // kos.run, general-purpose ad-hoc RPC. Single-in-flight-per-CPU:
                // a second kos.run for a CPU that already has one in flight is
                // rejected (KosRunManager.TryArm), mirroring the idle-prompt
                // guard every other CPU-targeted command re-checks at delivery
                // on the main thread.
                new CommandDeclaration { Command = KosChannels.RunCommand, Subject = KosChannels.RunPrefix + "{args.CoreId}", Requires = NeedsProcessor },
                // kos.files.list: a volume's file list read in-process, answered on
                // the same per-CPU result channel as kos.run.
                // kos.cancel: abandons the run a client stopped waiting for.
                new CommandDeclaration { Command = KosChannels.CancelCommand, Subject = KosChannels.RunPrefix + "{args.CoreId}", Requires = NeedsProcessor },
                new CommandDeclaration { Command = KosChannels.FilesListCommand, Subject = KosChannels.RunPrefix + "{args.CoreId}", Requires = NeedsProcessor },
            },
            ErrorCodes = ErrorCodeCatalog.Of(typeof(KosErrorCodes)),
            Namespaces = new[]
            {
                new NamespaceDeclaration { Prefix = KosChannels.TerminalPrefix, Template = TerminalNamespace() },
                new NamespaceDeclaration { Prefix = KosChannels.RunPrefix, Template = RunNamespace() },
            },
        };

        /// <summary>
        /// Which craft each CPU is aboard, keyed by <c>KOSCoreId</c> as a string
        /// because that is the form a topic segment arrives in.
        ///
        /// <para>Written whole on the main thread by <see cref="CaptureProcessors"/>
        /// and swapped in by reference; read on the Courier thread by
        /// <see cref="VesselIdForCore"/>. Never mutated in place, so a reader
        /// always sees one complete pass rather than a half-updated map, and no
        /// lock is needed on a path that runs per topic.</para>
        /// </summary>
        private Dictionary<string, string> _coreVessels = new Dictionary<string, string>(StringComparer.Ordinal);

        /// <summary>
        /// The vessel a kOS topic's <c>coreId</c> segment belongs to, or null
        /// when the last main-thread pass did not see that CPU.
        ///
        /// <para>Null routes the topic to the active craft, which is where every
        /// kOS topic sat before this existed. The alternative, handing back the
        /// coreId itself, would mint <c>trackingStation.vessel.&lt;coreId&gt;</c>: a node no
        /// delay is ever written for, which is a quieter wrong answer than the
        /// one being fixed.</para>
        /// </summary>
        internal string? VesselIdForCore(string coreId) =>
            Volatile.Read(ref _coreVessels).TryGetValue(coreId, out var vesselId) ? vesselId : null;

        // The two per-CPU namespaces. Declared here, in the half that needs no
        // game, so the manifest lists them and the engine registers them before
        // Register runs. Each is keyed by coreId, not by craft, so routing needs
        // the map CaptureProcessors maintains: without the resolver the coreId
        // would be read as a vessel id and address a node nothing writes a delay for.

        /// <summary>
        /// kos.terminal.&lt;coreId&gt;. Reliable-ordered because the screen is a diff
        /// stream and a dropped frame corrupts the buffer; delayed because the
        /// screen is vessel telemetry. A late subscriber's catch-up must land on a
        /// self-contained full repaint, never a bare incremental diff, so the
        /// keyframe test reads the flattened dictionary that is actually published.
        /// </summary>
        private ChannelDeclaration TerminalNamespace() => new ChannelDeclaration
        {
            Kind = SampleKind.Event,
            Delivery = Delivery.ReliableOrdered,
            Emission = new EmissionPolicy(keyframeIntervalUt: 3600, quantum: EmissionQuantum.Absolute(0)),
            Delay = DelayRole.Delayed,
            PerVesselNode = true,
            VesselIdForKey = VesselIdForCore,
            IsKeyframe = value => value is IDictionary<string, object?> d
                && d.TryGetValue("fullRepaint", out var fr) && fr is bool isFullRepaint && isFullRepaint,
            Requires = NeedsProcessor,
        };

        /// <summary>kos.run.&lt;coreId&gt;, the ad-hoc RPC result; reliable-ordered because a lost result strands the caller's promise until its own timeout.</summary>
        private ChannelDeclaration RunNamespace() => new ChannelDeclaration
        {
            Kind = SampleKind.Event,
            Delivery = Delivery.ReliableOrdered,
            Emission = new EmissionPolicy(keyframeIntervalUt: 3600, quantum: EmissionQuantum.Absolute(0)),
            Delay = DelayRole.Delayed,
            PerVesselNode = true,
            VesselIdForKey = VesselIdForCore,
            Requires = NeedsProcessor,
        };

        // ----------------------------------------------------------------
        // Interactive terminal commands: dispatched on the Courier thread,
        // marshalled to the KSP main thread (same drop-not-run discipline as
        // Exec). The KosTerminalManager holds the lease + screen state; every
        // call here runs on the main thread so no locking is needed. None of
        // this touches kOS/Unity types directly (KosTerminalManager doesn't
        // either): it's all KSP-free.
        // ----------------------------------------------------------------

        private CommandResult TerminalOpen(KosTerminalOpenArgs args)
        {
            if (args == null)
            {
                return CommandResult.Fail(CommandErrorCode.NotFound);
            }
            return RunOnMainThread(() =>
                _terminalManager?.Open(args.CoreId, args.LeaseToken) ?? CommandResult.Fail(CommandErrorCode.ModeUnavailable));
        }

        private CommandResult Keystroke(KosKeystrokeArgs args)
        {
            if (args == null)
            {
                return CommandResult.Fail(CommandErrorCode.NotFound);
            }
            return RunOnMainThread(() =>
                _terminalManager?.Keystroke(args.CoreId, args.LeaseToken, args.Chars) ?? CommandResult.Fail(CommandErrorCode.ModeUnavailable));
        }

        private CommandResult TerminalResize(KosTerminalResizeArgs args)
        {
            if (args == null)
            {
                return CommandResult.Fail(CommandErrorCode.NotFound);
            }
            return RunOnMainThread(() =>
                _terminalManager?.Resize(args.CoreId, args.LeaseToken, args.Cols, args.Rows) ?? CommandResult.Fail(CommandErrorCode.ModeUnavailable));
        }

        private CommandResult TerminalClose(KosTerminalCloseArgs args)
        {
            if (args == null)
            {
                return CommandResult.Fail(CommandErrorCode.NotFound);
            }
            return RunOnMainThread(() =>
                _terminalManager?.Close(args.CoreId, args.LeaseToken) ?? CommandResult.Fail(CommandErrorCode.ModeUnavailable));
        }

        /// <summary>
        /// Test-only: arm a <c>kos.run</c> request and/or wire a recording
        /// publisher directly against <see cref="_runManager"/>, bypassing the
        /// KSP-touching <c>Run</c> command handler (<c>KosExtension.Ksp.cs</c>)
        /// entirely, that handler's own guard (idle-prompt check, kOS type
        /// access) can't run headlessly. Pair with <see cref="OnScriptReturn"/>
        /// to exercise a script handing its result back.
        /// </summary>
        internal void WireRunForTests(Action<int, KosRunResult> publish)
        {
            _runManager.SetPublisher(publish);
        }

        /// <summary>
        /// A script on <paramref name="coreId"/> called
        /// <c>ADDONS:GONOGO:RETURN</c> with <paramref name="fields"/>: the run
        /// armed on that CPU ends with them. Returns false when no run was
        /// armed there, so the value had nowhere to go.
        /// </summary>
        internal bool OnScriptReturn(int coreId, Dictionary<string, object?> fields) =>
            _runManager.Complete(coreId, fields);

        /// <summary>Test-only: arm a run directly, bypassing the KSP-touching Run command handler.</summary>
        internal bool ArmRunForTests(int coreId, string requestId) => _runManager.TryArm(coreId, requestId);

        // ----------------------------------------------------------------
        // kos.processors
        // ----------------------------------------------------------------

        /// <summary>
        /// COURIER-THREAD handle: flatten the captured list through
        /// <see cref="KosProcessorInfoBuilder"/> and publish. Touches no kOS
        /// API. The flatten happens here, at the actual publish boundary,
        /// rather than inside <c>CaptureProcessors</c>: <see cref="ProcessorsCapture.List"/>
        /// stays a typed <c>List&lt;KosProcessorInfo&gt;</c> so the capture
        /// step itself stays simple to read/test; only the wire-facing value
        /// this method hands to <see cref="IChannelPublisher.Publish"/> is a
        /// self-flattened <c>Dictionary&lt;string, object?&gt;</c> per CPU:
        /// see <see cref="KosProcessorInfoBuilder"/>'s own doc comment for why
        /// JsonWriter needs no hardcoded case for the raw POCO.
        /// </summary>
        internal void HandleProcessors(object? captured)
        {
            if (captured is ProcessorsCapture capture)
            {
                var flattened = new List<Dictionary<string, object?>>(capture.List.Count);
                foreach (var p in capture.List)
                {
                    flattened.Add(KosProcessorInfoBuilder.Build(p.CoreId, p.Tag, p.HasBooted, p.BootFilePath, p.ProcessorMode, p.PartName));
                }
                _processorsPublisher?.Publish(flattened, capture.Ut);

                // Health bookkeeping (see ISitrepUplink.Health / KosHealth):
                // cache the CPU count this sample saw, same seam as the
                // publish above, so Health() never re-reads kOS itself.
                Volatile.Write(ref _lastProcessorCount, capture.List.Count);
                _sampledOnce = true;
            }
        }

        /// <summary>
        /// The mandatory healthcheck (see <see cref="ISitrepUplink.Health"/>):
        /// polled on the Courier thread every <c>system.uplinks</c> sample, so
        /// it only ever reads cached volatile state written above by the
        /// main-thread-fed processor capture. Never touches kOS/Unity
        /// directly. The state machine itself is <see cref="KosHealth"/>,
        /// see that type's doc comment for the divergence from the original
        /// "no active CPU selected" design framing (a client-side concept
        /// this mod-side interface cannot observe).
        /// </summary>
        public UplinkHealth Health() => KosHealth.Evaluate(
            _unavailableReason, _sampledOnce, Volatile.Read(ref _lastProcessorCount));

        /// <summary>Plain cross-thread payload bundle: no live kOS references (mirrors CommsCoreUplink.CommsCapture).</summary>
        private sealed class ProcessorsCapture
        {
            // Only CaptureProcessors (KosExtension.Ksp.cs) constructs one of
            // these with a real Ut: the headless test build never calls it,
            // hence the compiler-visible "never assigned" warning here.
#pragma warning disable CS0649
            public double Ut;
#pragma warning restore CS0649
            public List<KosProcessorInfo> List = new List<KosProcessorInfo>();
        }

        // ----------------------------------------------------------------
        // Commands: dispatched on the Courier thread, marshalled to main
        // ----------------------------------------------------------------

        /// <summary>Bounded wait for a main-thread kOS call to complete before the Courier gives up (F2 backstop analogue). Instance field so headless tests can shorten it.</summary>
        internal TimeSpan CommandMainThreadTimeout { get; set; } = TimeSpan.FromSeconds(5);

        /// <summary>
        /// Marshals <paramref name="work"/> onto the main-thread dispatcher and
        /// blocks the Courier thread until it completes or
        /// <see cref="CommandMainThreadTimeout"/> elapses, which answers with the
        /// <see cref="FaultCode.MainThreadTimeout"/> fault. An exception from
        /// <paramref name="work"/> answers with <see cref="FaultCode.CommandUnavailable"/>:
        /// nothing was decided, and the command stays available.
        ///
        /// <para><b>Timeout is drop-not-run</b> (adversarial-review M1, mirroring
        /// the engine's F2/F3 fix): the naive <c>using var done</c> form had two
        /// faults when the dispatcher drained the action after the 5s wait
        /// expired: (1) the deferred action's <c>Set()</c> hit an already-
        /// disposed handle (a spurious <see cref="ObjectDisposedException"/>),
        /// and (2) the kOS <c>RUNPATH</c> mutation still executed, seconds after
        /// the client was told the command timed out, so a
        /// client retry double-fired the script. Here the waiter marks the job
        /// <see cref="MainThreadJob.Abandoned"/> on timeout and does not dispose
        /// the handle; the dispatcher then drops an abandoned job (never runs
        /// <paramref name="work"/>) and disposes the handle itself. Exactly one
        /// side disposes, and no <c>Set()</c> ever lands on a disposed handle.</para>
        /// </summary>
        internal CommandResult RunOnMainThread(Func<CommandResult> work)
        {
            // Reentrancy guard (kos-uplink-gap self-deadlock). In production the
            // ChannelEngine is built executeCommandsOnMainThread:true, so it has
            // ALREADY marshalled this command handler onto the KSP main thread
            // (drained by GonogoAddon.Update -> ChannelEngine.RunPendingCommands)
            // before the handler body runs. Dispatcher.Drain runs on that SAME
            // Unity main thread (KosMainThreadDispatcherAddon.Update). So when we
            // reach here we are frequently ALREADY on the dispatcher's drain
            // thread: and Dispatch-and-block would park that thread inside
            // Done.Wait, where it can never reach the Drain that would run
            // `work`. The whole main thread wedges; the engine's own 4s backstop
            // fires first and the client sees a timeout while the
            // kOS side effect (starting a script) is abandoned and never runs,
            // exactly the live kos.run failure. When already on the drain thread,
            // run inline: no second hop, no block, no deadlock. The Courier-thread
            // / headless path (Dispatch + bounded wait below) is unchanged.
            if (Dispatcher.IsOnDrainThread)
            {
                try
                {
                    return work();
                }
                catch (Exception ex)
                {
                    _logError("[Gonogo.KosUplink] command main-thread work threw: " + ex);
                    throw new CommandFaultException(FaultCode.CommandUnavailable, "the command's main-thread work threw: " + ex.Message);
                }
            }

            var job = new MainThreadJob();
            Dispatcher.Dispatch(() =>
            {
                // Drop if the waiter already timed out: running the kOS mutation
                // now would fire RUNPATH after the client got Timeout (M1). The
                // waiter left disposal of the handle to us on that path.
                if (job.Abandoned)
                {
                    job.Done.Dispose();
                    return;
                }

                try
                {
                    job.Result = work();
                }
                catch (Exception ex)
                {
                    _logError("[Gonogo.KosUplink] command main-thread work threw: " + ex);
                    job.Error = ex;
                }
                finally
                {
                    job.Done.Set();
                    // If the waiter abandoned this job WHILE work ran (flag flipped
                    // after the top-of-action check), nobody will observe the
                    // result or dispose the handle: so this side owns disposal.
                    if (job.Abandoned)
                    {
                        job.Done.Dispose();
                    }
                }
            });

            if (!job.Done.Wait(CommandMainThreadTimeout))
            {
                // Do NOT dispose here, the dispatcher may still dequeue this job
                // and would Set()/Dispose() it; a Set() on a disposed handle
                // throws. The abandoned flag routes both the drop and the
                // disposal to whichever side drains the job.
                job.Abandoned = true;
                throw new CommandFaultException(
                    FaultCode.MainThreadTimeout,
                    "the game's main thread did not run the command within " + CommandMainThreadTimeout.TotalSeconds + "s");
            }

            try
            {
                if (job.Error != null)
                {
                    throw new CommandFaultException(FaultCode.CommandUnavailable, "the command's main-thread work threw: " + job.Error.Message);
                }
                return job.Result ?? throw new CommandFaultException(FaultCode.CommandUnavailable, "the command's main-thread work returned no result");
            }
            finally
            {
                // Completed path: the dispatcher's Set() has already returned and
                // the action left Abandoned false, so nothing else touches Done.
                job.Done.Dispose();
            }
        }

        /// <summary>
        /// One <see cref="RunOnMainThread"/> marshaled call. Mirrors the engine's
        /// <c>MainThreadCommand</c>: the <see cref="Abandoned"/> flag (set by the
        /// waiter on timeout) is the sole signal that routes both "drop the work"
        /// and "who disposes <see cref="Done"/>" between the waiter and the
        /// dispatcher, so the handle is disposed exactly once and never
        /// <c>Set()</c>-after-dispose.
        /// </summary>
        private sealed class MainThreadJob
        {
            public readonly ManualResetEventSlim Done = new ManualResetEventSlim(false);
            public volatile bool Abandoned;
            public CommandResult? Result;
            public Exception? Error;
        }
    }
}
