// GonogoKosUplink: GPLv3. See GonogoKosUplink.csproj's header comment for the
// licence/linkage rationale.
//
// The KSP/Unity/kOS-touching half of KosExtension. See KosExtension.cs's
// class doc comment for the full rationale: this file exists so
// GonogoKosUplink.Tests can Compile-Include KosExtension.cs's KSP-free half
// without ever needing kOS.dll/UnityEngine.dll reference assemblies (which
// don't exist in a headless/CI build), the GonogoKosUplink.Tests.csproj simply
// does not list this file. The production GonogoKosUplink.csproj compiles both
// halves together as usual (SDK-style wildcard globbing), so nothing here
// changes for a live-game build.

using System;
using System.Collections.Generic;
using System.Globalization;
using System.Linq;
using System.Reflection;
using System.Threading;
using kOS.Module;
using kOS.Safe.Compilation;
using kOS.Safe.Encapsulation;
using kOS.Safe.Execution;
using kOS.Safe.Persistence;
using kOS.Safe.Screen;
using SafeHouse = kOS.Safe.Utilities.SafeHouse;
using Sitrep.Contract;
using UnityEngine;
using Debug = UnityEngine.Debug;

namespace Gonogo.KosUplink
{
    public sealed partial class KosExtension
    {
        // Held so Register can attach the terminal poll once the manager
        // exists (the addon drives both the dispatcher drain and the
        // ~20 Hz terminal downlink on the main thread). KSP/Unity type, so
        // it lives in this half of the partial class.
        private KosMainThreadDispatcherAddon? _boundAddon;

        // kOSProcessor's private SharedObjects field, bound once the version guard
        // has checked its shape and the members a native run calls; null when it
        // has not, which refuses every kos.run.
        private FieldInfo? _sharedField;

        // CPUs whose run left its argument globals behind, with the CPU (a kOS
        // ICpu, held as object) and the names, removed once the CPU is back at
        // its prompt so they never show up in the operator's session.
        private readonly Dictionary<int, KeyValuePair<object, List<string>>> _globalsToClear = new Dictionary<int, KeyValuePair<object, List<string>>>();

        /// <summary>
        /// Implements the seam declared in KosExtension.cs: installs the real
        /// Debug.LogError sink and the real GameObject/addon binder for a
        /// production instance (the public parameterless ctor's path only: see
        /// the ctor's useProductionDefaults gate).
        /// </summary>
        partial void InstallProductionDefaults()
        {
            _bindDispatcherAddon = BindRealAddon;
            _logError = LogErrorToUnity;
        }

        // Named static helper (not an inline lambda) so ONLY this method's body
        // references UnityEngine: a headless test that never invokes it never
        // needs UnityEngine loaded.
        private static void LogErrorToUnity(string message) => Debug.LogError(message);

        partial void RegisterKspBindings(IUplinkHost host)
        {
            _bindDispatcherAddon(Dispatcher);

            KosGuardResult guard;
            try
            {
                guard = KosVersionGuard.Probe(typeof(kOSProcessor).Assembly, typeof(ScreenBuffer).Assembly);
            }
            catch (Exception ex)
            {
                guard = KosGuardResult.Fail($"kOS version-guard probe threw: {ex.Message}");
            }

            if (!guard.IsAvailable)
            {
                host.SetAvailability(Availability.Unavailable(guard.Reason ?? "kOS unavailable"));
                // Mirrors KerbcastUplink's _unavailableReason: wins over
                // every other Health() state (see KosHealth.Evaluate) since
                // the uplink never samples past this point.
                _unavailableReason = guard.Reason ?? "kOS unavailable";
                // Still publish an empty CPU list so the client can render a
                // definite "no kOS" rather than a hang. Always empty on this
                // path, so the element type is nominal, kept as the same
                // flattened shape HandleProcessors publishes on the
                // kOS-available path (KosProcessorInfoBuilder), never the raw
                // POCO, so a reader of this file doesn't mistake it for a
                // second raw-POCO publish site.
                host.AddChannelSource(KosChannels.ProcessorsTopic, _ => new List<Dictionary<string, object?>>());
                return;
            }

            // kos.processors: capture AllInstances() on the main thread, hand
            // the plain list to the Courier to publish (spec §2/§5).
            _processorsPublisher = host.Publisher(KosChannels.ProcessorsTopic);
            host.AddSampledSource(
                CaptureProcessors,
                HandleProcessors,
                KosChannels.ProcessorsTopic);

            _sharedField = guard.NativeRunAvailable ? KosVersionGuard.SharedObjectsField(typeof(kOSProcessor)) : null;
            if (_sharedField == null)
            {
                var missing = new List<string>(KosVersionGuard.MissingNativeRunMembers(typeof(ScreenBuffer).Assembly.GetTypes()));
                if (missing.Count == 0)
                {
                    missing.Add("kOSProcessor." + KosVersionGuard.SharedFieldName);
                }
                Debug.Log("[Gonogo.KosUplink] this kOS lacks what a native run needs, so kos.run is refused: " + string.Join(", ", missing));
            }
            KosGonogoAddon.Sink = (coreId, fields) => OnScriptReturn(coreId, fields);
            try
            {
                KosGonogoAddon.Register();
            }
            catch (Exception ex)
            {
                Debug.LogError("[Gonogo.KosUplink] could not add ADDONS:GONOGO to kOS, so a script cannot hand a result back: " + ex);
            }

            // Interactive terminal: kos.terminal.<coreId> ReliableOrdered
            // screen downlink + single-owner keystroke/resize/open/close.
            // The mod reads the CPU screen in-process, no telnet/node-pty
            // anywhere in the path.
            _terminalSource = host.RegisterDynamicNamespace(KosChannels.TerminalPrefix, TerminalNamespace());

            _terminalManager = new KosTerminalManager(
                knownCoreIds: CurrentCoreIds,
                isSubscribed: coreId => host.IsAnyTopicSubscribed(KosChannels.TerminalTopic(coreId)),
                // Flattened here, at the actual publish boundary, via
                // KosTerminalFrameBuilder: KosTerminalManager itself stays
                // typed in terms of the KosTerminalFrame POCO (its own tests
                // assert on that shape), only the wire-facing value handed to
                // Publish is a self-flattened Dictionary<string, object?>. See
                // KosTerminalFrameBuilder's doc comment for why JsonWriter no
                // longer needs a hardcoded case for the raw POCO.
                publish: (coreId, frame, ut) =>
                    _terminalSource?.Publisher(KosChannels.TerminalSubTopic(coreId)).Publish(
                        KosTerminalFrameBuilder.Build(frame.CoreId, frame.Chunk, frame.FullRepaint), ut),
                createScreen: coreId => new KosProcessorScreen(coreId, FindProcessor),
                nowUt: host.NowUt);

            // Gap A (adversarial review): the full-repaint reseed decision
            // must come from a genuinely per-subscription-transition,
            // thread-safe signal (fired on the Courier thread for EVERY
            // individual session subscribe), not a main-thread poll of a
            // subscriber count sampled once per ~20Hz tick; see
            // KosTerminalManager.NotifySubscribed's doc comment.
            _terminalSource.OnSubscribed(topic =>
            {
                if (KosChannels.TryParseTerminalCoreId(topic, out var terminalCoreId))
                {
                    _terminalManager?.NotifySubscribed(terminalCoreId);
                }
            });

            // Drive the ~20 Hz downlink poll from the same main-thread addon
            // that drains the dispatcher (headless tests call Poll() directly).
            if (_boundAddon != null)
            {
                var terminalPoll = _terminalManager.Poll;
                _boundAddon.Poll = dt =>
                {
                    terminalPoll(dt);
                    PollRuns();
                    ClearRunGlobals();
                };
            }

            host.AddCommandHandler<KosTerminalOpenArgs, CommandResult>(KosChannels.TerminalOpenCommand, TerminalOpen);
            host.AddCommandHandler<KosKeystrokeArgs, CommandResult>(KosChannels.KeystrokeCommand, Keystroke);
            host.AddCommandHandler<KosTerminalResizeArgs, CommandResult>(KosChannels.TerminalResizeCommand, TerminalResize);
            host.AddCommandHandler<KosTerminalCloseArgs, CommandResult>(KosChannels.TerminalCloseCommand, TerminalClose);

            // kos.run, general-purpose ad-hoc RPC (replaces the standalone
            // telnet proxy's executeScript path, see
            // kos-uplink-full-migration.md). ReliableOrdered: a lost result
            // frame would strand the caller's promise until its own client-
            // side timeout, same posture as the terminal downlink.
            _runSource = host.RegisterDynamicNamespace(KosChannels.RunPrefix, RunNamespace());
            // Flattened here, at the actual publish boundary, via
            // KosRunResultBuilder: KosRunManager itself stays typed in terms
            // of the KosRunResult POCO (its own tests assert on that shape),
            // only the wire-facing value handed to Publish is a
            // self-flattened Dictionary<string, object?>. Fields is already a
            // Dictionary<string, object?> and passes through unchanged. See
            // KosRunResultBuilder's doc comment for why JsonWriter needs no
            // hardcoded case for the raw POCO.
            _runManager.SetPublisher((coreId, result) =>
                _runSource?.Publisher(KosChannels.RunSubTopic(coreId)).Publish(
                    KosRunResultBuilder.Build(result.CoreId, result.RequestId, result.Fields, result.Error, result.Ended),
                    host.NowUt()));
            CpuIsIdle = IsCpuIdle;
            host.AddCommandHandler<KosRunArgs, CommandResult>(KosChannels.RunCommand, Run);
            host.AddCommandHandler<KosCancelArgs, CommandResult>(KosChannels.CancelCommand, Cancel);
            host.AddCommandHandler<KosFilesListArgs, CommandResult>(KosChannels.FilesListCommand, FilesList);
            _filesPublish = (coreId, requestId, fields, error) =>
                _runSource?.Publisher(KosChannels.RunSubTopic(coreId)).Publish(
                    KosRunResultBuilder.Build(coreId, requestId, fields, error),
                    host.NowUt());
        }

        private Action<int, string, Dictionary<string, object?>?, string?>? _filesPublish;

        /// <summary>
        /// <c>kos.files.list</c> command handler: reads the Archive (<c>0:</c>)
        /// or the CPU's own drive (<c>1:</c>) straight from the processor's
        /// volumes and answers on <c>kos.run.&lt;coreId&gt;</c>, so nothing is
        /// typed into the CPU's terminal. Only the top level of the volume is
        /// listed.
        /// The Archive is refused with <c>noConnection</c> when kOS itself would
        /// refuse it, so a craft with no link home cannot list it.
        ///
        /// <para><b>Unverified against live KSP</b>: this file has no
        /// reference DLLs to build against in a headless environment.</para>
        /// </summary>
        private CommandResult FilesList(KosFilesListArgs args)
        {
            if (args == null || string.IsNullOrEmpty(args.RequestId))
            {
                return CommandResult.Fail(CommandErrorCode.NotFound);
            }

            return RunOnMainThread(() =>
            {
                var proc = FindProcessor(args.CoreId);
                if (proc == null)
                {
                    return CommandResult.Fail(CommandErrorCode.NotFound);
                }

                var refusal = KosFileListing.Refusal(args.Volume, ArchiveReachable(proc));
                if (refusal != null)
                {
                    return refusal;
                }

                kOS.Safe.Persistence.Volume? volume =
                    args.Volume == "0:" ? (kOS.Safe.Persistence.Volume)proc.Archive
                    : args.Volume == "1:" ? (kOS.Safe.Persistence.Volume)proc.HardDisk
                    : null;
                if (volume == null)
                {
                    return CommandResult.Fail(CommandErrorCode.NotFound);
                }

                try
                {
                    var files = new List<KosListedFile>();
                    foreach (var item in volume.Root.List().Values)
                    {
                        files.Add(new KosListedFile(
                            item.Name,
                            item.Size,
                            item is kOS.Safe.VolumeDirectory ? true : item is kOS.Safe.Persistence.VolumeFile ? (bool?)false : null));
                    }
                    _filesPublish?.Invoke(args.CoreId, args.RequestId, KosFileListing.Fields(args.Volume, files), null);
                }
                catch (Exception e)
                {
                    _filesPublish?.Invoke(args.CoreId, args.RequestId, null, "could not read " + args.Volume + ": " + e.Message);
                }
                return CommandResult.Ok();
            });
        }

        /// <summary>Current CPU <c>KOSCoreId</c>s (main thread): the terminal manager's discovery set.</summary>
        private static IReadOnlyList<int> CurrentCoreIds()
        {
            var ids = new List<int>();
            foreach (var p in kOSProcessor.AllInstances())
            {
                if (p != null)
                {
                    ids.Add(p.KOSCoreId);
                }
            }
            return ids;
        }

        /// <summary>MAIN-THREAD capture: read <c>AllInstances()</c> into a plain, KSP-handle-free list.</summary>
        internal object? CaptureProcessors(KspSnapshot? snapshot)
        {
            var list = new List<KosProcessorInfo>();
            // Rebuilt whole rather than patched: a CPU that has gone (craft
            // unloaded, part destroyed) must LEAVE the map, and a map that only
            // ever gains entries would keep routing its topics at a craft that
            // is no longer carrying it.
            var observedVessels = new List<KeyValuePair<string, string?>>();
            foreach (var p in kOSProcessor.AllInstances())
            {
                if (p == null)
                {
                    continue;
                }
                var vesselId = p.part?.vessel?.id;
                observedVessels.Add(new KeyValuePair<string, string?>(
                    p.KOSCoreId.ToString(CultureInfo.InvariantCulture),
                    vesselId != null && vesselId != Guid.Empty ? vesselId.Value.ToString() : null));
                list.Add(new KosProcessorInfo
                {
                    CoreId = p.KOSCoreId,
                    Tag = string.IsNullOrEmpty(p.Tag) ? null : p.Tag,
                    HasBooted = p.HasBooted,
                    BootFilePath = p.BootFilePath?.ToString(),
                    ProcessorMode = p.ProcessorMode.ToString(),
                    PartName = p.part?.partInfo?.title,
                });
            }
            // Published before the snapshot guard below: the routing map is
            // useful whether or not there is a game clock to stamp a payload
            // with, and returning early without swapping it would leave routing
            // reading a pass older than the one just walked.
            Volatile.Write(ref _coreVessels, KosCoreVesselMap.Next(Volatile.Read(ref _coreVessels), observedVessels));
            // Carry the capture UT alongside the list (mirrors
            // CommsCoreUplink.CommsCapture.Ut). Publishing at the real UT (not a
            // hardcoded 0.0) keeps this Delayed channel on the same UT-indexed
            // timeline as every other vessel-sourced channel, so its periodic
            // keyframe cadence and the server reveal gate both work; a fixed 0.0
            // froze the emitter's keyframe clock and made a "Delayed" channel
            // reveal as if TrueNow.
            //
            // No snapshot means no game clock to stamp, and there is no
            // honest substitute: a 0.0 would re-arm exactly the frozen
            // keyframe clock described above, on a fallback nothing
            // downstream can see. Return null instead, which HandleProcessors
            // already ignores (its `is ProcessorsCapture` pattern), so the
            // tick publishes nothing and the last good frame stands rather
            // than a real list arriving under a fabricated timestamp.
            if (snapshot == null)
            {
                return null;
            }
            return new ProcessorsCapture { Ut = snapshot.Ut, List = list };
        }

        /// <summary>The most arguments a <c>kos.run</c> may pass, so the started line stays bounded.</summary>
        internal const int MaxRunArgs = 32;

        private const string PathGlobal = "gonogo_run_path";
        private const string ArgGlobalPrefix = "gonogo_run_arg";

        /// <summary>
        /// <c>kos.run</c> command handler: starts the script at
        /// <see cref="KosRunArgs.Path"/> on the CPU as a program, the way kOS's
        /// own boot sequence starts a boot script. The path and the arguments go
        /// in as kOS globals, and the line compiled to start the program is built
        /// only from fixed text and those globals' names, so nothing the caller
        /// sent is ever compiled. The run ends when the script calls
        /// <c>ADDONS:GONOGO:RETURN</c>, when kOS stops it on an error, or when
        /// the program finishes.
        /// </summary>
        private CommandResult Run(KosRunArgs args)
        {
            if (args == null || string.IsNullOrEmpty(args.RequestId) || string.IsNullOrEmpty(args.Path))
            {
                return CommandResult.Fail(CommandErrorCode.NotFound);
            }
            var runArgs = args.Args ?? new List<object?>();
            if (runArgs.Count > MaxRunArgs)
            {
                return CommandResult.Fail(CommandErrorCode.Range);
            }
            foreach (var value in runArgs)
            {
                if (!(value is double || value is bool || value is string))
                {
                    return CommandResult.Fail(CommandErrorCode.Range);
                }
            }

            return RunOnMainThread(() => RunOnCpu(args, runArgs));
        }

        /*
         * The kOS objects a run needs travel as object through every lambda here:
         * a captured local becomes a field of a compiler-generated class, and a
         * kOS-typed field in this assembly is what KSP cannot load before kOS.
         */
        private CommandResult RunOnCpu(KosRunArgs args, List<object?> runArgs)
        {
            var proc = FindProcessor(args.CoreId);
            if (proc == null)
            {
                return CommandResult.Fail(CommandErrorCode.NotFound);
            }
            if (_sharedField == null || !(_sharedField.GetValue(proc) is kOS.SharedObjects shared) || shared.Cpu == null)
            {
                return CommandResult.Fail(KosErrorCodes.RunUnsupported);
            }
            if (!IsCpuIdle(args.CoreId) || !(proc.GetScreen() is IInterpreter interp) || !interp.IsAtStartOfCommand())
            {
                return CommandResult.Fail(KosErrorCodes.CpuBusy);
            }

            CaptureRunErrors(proc);
            object procRef = proc;
            object sharedRef = shared;
            return _runManager.ArmAndStart(
                args.CoreId,
                args.RequestId,
                () => StartScript(procRef, sharedRef, args, runArgs));
        }

        /// <summary>
        /// Resolves the script, copies it to the CPU's drive when asked, and
        /// starts it. Returns null once the program is started, or the refusal
        /// to answer with; nothing has run when it refuses.
        /// </summary>
        private CommandResult? StartScript(object procRef, object sharedRef, KosRunArgs args, List<object?> runArgs)
        {
            var proc = (kOSProcessor)procRef;
            var shared = (kOS.SharedObjects)sharedRef;
            GlobalPath path;
            Volume volume;
            try
            {
                path = shared.VolumeMgr.GlobalPathFromObject(new StringValue(args.Path));
                volume = shared.VolumeMgr.GetVolumeFromPath(path);
            }
            catch (Exception)
            {
                return CommandResult.Fail(KosErrorCodes.ScriptNotFound);
            }
            if (volume is Archive && !ArchiveReachable(proc))
            {
                return CommandResult.Fail(CommandErrorCode.NoConnection);
            }
            if (!(volume?.Open(path) is VolumeFile file))
            {
                return CommandResult.Fail(KosErrorCodes.ScriptNotFound);
            }

            if (args.CopyToLocal && !(volume is Harddisk))
            {
                var local = proc.HardDisk;
                if (local == null)
                {
                    return CommandResult.Fail(KosErrorCodes.NoRoom);
                }
                var content = file.ReadAll();
                var root = shared.VolumeMgr.GlobalPathFromObject(local);
                var localPath = GlobalPath.FromVolumePath(VolumePath.FromString("/" + file.Name), root.VolumeId);
                if (!local.IsRoomFor(localPath, content) || local.SaveFile(localPath, content, true) == null)
                {
                    return CommandResult.Fail(KosErrorCodes.NoRoom);
                }
                path = localPath;
            }

            var cpu = shared.Cpu;
            var globals = new List<string> { PathGlobal };
            cpu.SetGlobal("$" + PathGlobal, new StringValue(path.ToString()));
            var line = new System.Text.StringBuilder("RUNPATH(").Append(PathGlobal);
            for (var i = 0; i < runArgs.Count; i++)
            {
                var name = ArgGlobalPrefix + i.ToString(CultureInfo.InvariantCulture);
                cpu.SetGlobal("$" + name, Structure.FromPrimitiveWithAssert(runArgs[i]!));
                globals.Add(name);
                line.Append(", ").Append(name);
            }
            line.Append(").");
            _globalsToClear[args.CoreId] = new KeyValuePair<object, List<string>>(cpu, globals);

            proc.GetScreen()?.Print("[gonogo] run " + path + Describe(runArgs));

            var text = line.ToString();
            var options = new CompilerOptions
            {
                LoadProgramsInSameAddressSpace = true,
                FuncManager = shared.FunctionManager,
                BindManager = shared.BindingMgr,
                AllowClobberBuiltins = SafeHouse.Config.AllowClobberBuiltIns,
                IsCalledFromRun = false,
            };
            shared.ScriptHandler.ClearContext("program");
            cpu.SwitchToProgramContext();
            cpu.YieldProgram(YieldFinishedCompile.RunScript(StartLinePath(), 1, text, "program", options));
            return null;
        }

        /// <summary>The volume id the started line is compiled under; no CPU has a volume by that name.</summary>
        internal const string StartLineVolume = "gonogo";

        /*
         * The started line is compiled under a path on a volume that does not
         * exist, so when kOS shows where an error happened it finds no source to
         * quote rather than quoting a line of some real file.
         */
        private static GlobalPath StartLinePath() => GlobalPath.FromVolumePath(VolumePath.FromString("/run"), StartLineVolume);

        private static string Describe(List<object?> runArgs)
        {
            var sb = new System.Text.StringBuilder();
            foreach (var value in runArgs)
            {
                sb.Append(' ').Append(value is bool b ? (b ? "true" : "false")
                    : value is double d ? d.ToString(CultureInfo.InvariantCulture)
                    : value);
            }
            return sb.ToString();
        }

        /// <summary>
        /// Removes the argument globals a finished run left behind, once its CPU
        /// is back at its prompt. Runs on the main thread.
        /// </summary>
        private void ClearRunGlobals()
        {
            if (_globalsToClear.Count == 0)
            {
                return;
            }
            List<int>? cleared = null;
            foreach (var kv in _globalsToClear)
            {
                if (_runManager.IsArmed(kv.Key) || !IsCpuIdle(kv.Key))
                {
                    continue;
                }
                try
                {
                    foreach (var name in kv.Value.Value)
                    {
                        ((ICpu)kv.Value.Key).RemoveVariable("$" + name);
                    }
                }
                catch (Exception ex)
                {
                    Debug.LogError("[Gonogo.KosUplink] could not clear a run's globals on CPU " + kv.Key + ": " + ex.Message);
                }
                (cleared ??= new List<int>()).Add(kv.Key);
            }
            if (cleared != null)
            {
                foreach (var coreId in cleared)
                {
                    _globalsToClear.Remove(coreId);
                }
            }
        }

        /// <summary>
        /// The condition kOS's own volume manager refuses the Archive on
        /// (<c>ConnectivityVolumeManager.CheckRange</c>): reachable on the
        /// launchpad, or with a link home.
        /// </summary>
        private static bool ArchiveReachable(kOSProcessor proc)
        {
            var vessel = proc.vessel;
            return vessel != null
                && (vessel.situation == Vessel.Situations.PRELAUNCH
                    || kOS.Communication.ConnectivityManager.HasConnectionToHome(vessel));
        }

        /// <summary>
        /// Wraps <paramref name="proc"/>'s kOS logger, once per CPU, so an error
        /// kOS stops a program on ends the run armed on that CPU with kOS's own
        /// message. kOS builds a new logger whenever it rebuilds the CPU's shared
        /// objects, so the check runs before every run rather than once at load.
        /// The wrapper forwards every call unchanged.
        /// </summary>
        private void CaptureRunErrors(kOSProcessor proc)
        {
            if (_sharedField == null || _loggerProxyFailed)
            {
                return;
            }
            try
            {
                if (!(_sharedField.GetValue(proc) is kOS.SharedObjects shared) || shared.Logger == null)
                {
                    return;
                }
                if (_loggerProxyFactory == null)
                {
                    _loggerProxyFactory = KosForwardingProxy.Factory(
                        typeof(kOS.Safe.ILogger),
                        typeof(kOS.Safe.ILogger).GetMethod(nameof(kOS.Safe.ILogger.Log), new[] { typeof(Exception) })!,
                        out _loggerProxyType);
                }
                if (shared.Logger.GetType() == _loggerProxyType)
                {
                    return;
                }
                var coreId = proc.KOSCoreId;
                object cpu = shared.Cpu;
                shared.Logger = (kOS.Safe.ILogger)_loggerProxyFactory(shared.Logger, args =>
                {
                    try
                    {
                        if (args.Length == 1 && args[0] is Exception e)
                        {
                            _runManager.Fail(coreId, DescribeError(e, cpu));
                        }
                    }
                    catch (Exception)
                    {
                        // The run bookkeeping must never take kOS's own error reporting down with it.
                    }
                });
            }
            catch (Exception ex)
            {
                _loggerProxyFailed = true;
                Debug.LogError("[Gonogo.KosUplink] could not watch kOS CPUs for script errors, so a run that stops on an error ends without its message: " + ex);
            }
        }

        private Func<object, Action<object?[]>, object>? _loggerProxyFactory;
        private Type? _loggerProxyType;
        private bool _loggerProxyFailed;

        /// <summary>
        /// The error as an operator reads it: kOS's own message, followed by the
        /// script and line it stopped at when the CPU can say. Read before kOS
        /// unwinds the program, while the call trace still points at the line.
        /// </summary>
        internal static string DescribeError(Exception e, object? cpu)
        {
            var message = string.IsNullOrEmpty(e.Message) ? e.GetType().Name : e.Message.Trim();
            var location = ErrorLocation(cpu);
            return location == null ? message : message + " (" + location + ")";
        }

        private static string? ErrorLocation(object? cpu)
        {
            if (!(cpu is kOS.Safe.Execution.ICpu kosCpu))
            {
                return null;
            }
            try
            {
                var trace = kosCpu.GetCallTrace();
                if (trace == null || trace.Count == 0)
                {
                    return null;
                }
                var opcode = kosCpu.GetOpcodeAt(trace[0]);
                if (opcode == null || opcode is kOS.Safe.Compilation.OpcodeEOF || opcode.SourcePath == null
                    || opcode.SourcePath is kOS.Safe.Execution.InternalPath
                    || Equals(opcode.SourcePath.VolumeId, StartLineVolume) || opcode.SourceLine <= 0)
                {
                    return null;
                }
                return opcode.SourcePath + " line " + opcode.SourceLine;
            }
            catch (Exception)
            {
                return null;
            }
        }

        /// <summary>
        /// True when the CPU's interpreter is waiting for a command and kOS's
        /// input queue holds nothing still to be typed into it.
        /// </summary>
        private static bool IsCpuIdle(int coreId)
        {
            var proc = FindProcessor(coreId);
            return proc != null
                && proc.HasBooted
                && proc.GetScreen() is IInterpreter interp
                && interp.IsWaitingForCommand()
                && proc.GetScreen().CharInputQueue.Count == 0;
        }

        /// <summary>
        /// <c>kos.cancel</c> command handler: disarms the named run and, only
        /// when it was still the run the CPU is armed for, presses kOS's own
        /// break key (the Ctrl-C of the terminal, which ends the program the
        /// interpreter is running). A run that has already ended is left alone.
        /// </summary>
        private CommandResult Cancel(KosCancelArgs args)
        {
            if (args == null || string.IsNullOrEmpty(args.RequestId))
            {
                return CommandResult.Fail(CommandErrorCode.NotFound);
            }

            return RunOnMainThread(() =>
            {
                if (_runManager.CancelRun(args.CoreId, args.RequestId)
                    && FindProcessor(args.CoreId)?.GetScreen() is IInterpreter interp)
                {
                    interp.SpecialKey(KosTerminalManager.KosBreakKey);
                }
                return CommandResult.Ok();
            });
        }

        private static kOSProcessor? FindProcessor(int coreId)
        {
            return kOSProcessor.AllInstances().FirstOrDefault(p => p != null && p.KOSCoreId == coreId);
        }

        private void BindRealAddon(MainThreadDispatcher dispatcher)
        {
            var go = new GameObject("Gonogo.KosUplink.Dispatcher");
            UnityEngine.Object.DontDestroyOnLoad(go);
            var addon = go.AddComponent<KosMainThreadDispatcherAddon>();
            addon.Dispatcher = dispatcher;
            dispatcher.ClaimDrainThread();
            // Held so Register can attach the terminal poll once the manager
            // exists (the addon drives both the dispatcher drain and the
            // ~20 Hz terminal downlink on the main thread).
            _boundAddon = addon;
        }
    }
}
