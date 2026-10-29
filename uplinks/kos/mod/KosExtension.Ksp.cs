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
using System.Threading;
using kOS.Module;
using kOS.Safe.Screen;
using Sitrep.Contract;
using UnityEngine;

namespace Gonogo.KosUplink
{
    public sealed partial class KosExtension
    {
        // Held so Register can attach the terminal poll once the manager
        // exists (the addon drives both the dispatcher drain and the
        // ~20 Hz terminal downlink on the main thread). KSP/Unity type, so
        // it lives in this half of the partial class.
        private KosMainThreadDispatcherAddon? _boundAddon;

        /// <summary>
        /// Implements the seam declared in KosExtension.cs: installs the real
        /// Debug.LogError sink, the real GameObject/addon binder, and the real
        /// kOSProcessor-reverse-map CoreIdResolver for a production instance
        /// (the public parameterless ctor's path only: see the ctor's
        /// useProductionDefaults gate).
        /// </summary>
        partial void InstallProductionDefaults()
        {
            _bindDispatcherAddon = BindRealAddon;
            _logError = LogErrorToUnity;
            CoreIdResolver = ResolveCoreId;
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

            // kos.compute.<id>.<field>: dynamic namespace fed by the Print
            // postfix (or the snapshot-scrape fallback when the postfix target
            // is absent). Every compute value is DELAYED (comms authority,
            // script PRINT downlink is vessel telemetry, spec §4.4).
            _computeSource = host.RegisterDynamicNamespace(KosChannels.ComputePrefix, ComputeNamespace());

            // Subscription short-circuit source for OnPrint: every kerboscript
            // PRINT flows through the postfix, but if nobody is subscribed under
            // kos.compute.* the whole capture (resolve + accumulate + publish)
            // must be skipped so a terminal-only session burns no GC on the main
            // thread (adversarial-review I1). Reads the engine's thread-safe
            // subscribed-topics mirror.
            _computeSubscribed = () => host.IsAnyTopicSubscribed(KosChannels.ComputePrefix);

            // The instant every compute publish is stamped with. Same seam and
            // same reason as the terminal downlink below and the processor
            // capture above: a Delayed channel is revealed and keyframed
            // against its stamp, so it has to be the game's clock rather than
            // a constant.
            _nowUt = host.NowUt;

            if (guard.ComputePostfixAvailable)
            {
                KosComputeHarmony.Sink = OnPrint;
                try
                {
                    KosComputeHarmony.Install();
                }
                catch (Exception ex)
                {
                    // Fall back to the snapshot-scrape path (not wired in P1,
                    // see the known-gap note in the report). Never crash the
                    // engine on a patch failure.
                    Debug.LogError("[Gonogo.KosUplink] compute Print-postfix install failed: " + ex);
                    KosComputeHarmony.Sink = null;
                }
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
                _boundAddon.Poll = _terminalManager.Poll;
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
                    KosRunResultBuilder.Build(result.CoreId, result.RequestId, result.Fields, result.Error),
                    host.NowUt()));
            host.AddCommandHandler<KosRunArgs, CommandResult>(KosChannels.RunCommand, Run);
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

                /*
                 * The condition kOS's own volume manager refuses the Archive on
                 * (ConnectivityVolumeManager.CheckRange): on the launchpad, or with a
                 * link home. The manager itself is private to the processor.
                 */
                var vessel = proc.vessel;
                var archiveReachable = vessel != null
                    && (vessel.situation == Vessel.Situations.PRELAUNCH
                        || kOS.Communication.ConnectivityManager.HasConnectionToHome(vessel));
                var refusal = KosFileListing.Refusal(args.Volume, archiveReachable);
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

        /// <summary>
        /// Reverse map from the postfix's <c>ScreenBuffer</c>/interpreter to
        /// the owning CPU's <c>KOSCoreId</c> (spec §4.2:
        /// <c>AllInstances().First(p =&gt; p.GetScreen() == __instance)</c>).
        /// Returns -1 when no CPU owns the screen (should not happen for a
        /// script print, but fail-soft). Called only on block completion; never
        /// per <c>PRINT</c> fragment: so its <c>AllInstances()</c> allocation
        /// is off the hot path.
        /// </summary>
        private static int ResolveCoreId(object screen)
        {
            foreach (var p in kOSProcessor.AllInstances())
            {
                if (p != null && ReferenceEquals(p.GetScreen(), screen))
                {
                    return p.KOSCoreId;
                }
            }
            return -1;
        }

        /// <summary>
        /// <c>kos.run</c> command handler, the general-purpose replacement
        /// for the standalone telnet proxy's ad-hoc <c>executeScript</c> RPC
        /// (see <c>kos-uplink-full-migration.md</c>). The only way to run
        /// anything on a CPU: it types the caller's own literal
        /// <see cref="KosRunArgs.Command"/> text and arms
        /// <see cref="_runManager"/> so <see cref="KosExtension.OnPrint"/>
        /// routes the resulting completed block back to
        /// <c>kos.run.&lt;coreId&gt;</c> instead of the compute fanout.
        ///
        /// <para><b>Unverified against live KSP</b>: this file has no
        /// reference DLLs to build against in a headless environment (see the
        /// migration plan's "What's left"). Only a real kOS smoke test proves
        /// <see cref="TypeCommand"/>'s multi-line handling is correct.</para>
        /// </summary>
        private CommandResult Run(KosRunArgs args)
        {
            if (args == null || string.IsNullOrEmpty(args.RequestId) || string.IsNullOrEmpty(args.Command))
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

                // Guard: never type into a booting or busy prompt (spec §4(a)).
                if (!proc.HasBooted || !(proc.GetScreen() is IInterpreter interp) || !interp.IsWaitingForCommand())
                {
                    return CommandResult.Fail(KosErrorCodes.CpuBusy);
                }

                // Arming, typing, and disarming again when there was no window
                // to type into all live in KosRunManager.ArmAndType, which is
                // KSP-free and therefore testable: see its doc comment for the
                // ordering and for why an untyped run must be left unarmed.
                return _runManager.ArmAndType(
                    args.CoreId,
                    args.RequestId,
                    () => TypeCommand(proc, args.Command));
            });
        }

        /// <summary>
        /// Types <paramref name="command"/>: potentially several kerboscript
        /// statements separated by <c>\n</c> (the shape
        /// <c>packages/app/src/dataSources/kosWrapper.ts</c>'s managed-sync
        /// wrapper already builds for the telnet path), into
        /// <paramref name="proc"/>'s interpreter via the pinned 4-arg
        /// <c>ProcessOneInputChar</c> overload (spec §7, <c>forceQueue: true</c>
        /// preserving order against the interpreter's async pace). Every
        /// embedded <c>\n</c> is converted to an Enter press (<c>\r</c> via
        /// <c>ProcessOneInputChar</c>) so each statement submits to the REPL
        /// in turn, the same way a human pasting multi-line input would; a
        /// final Enter is appended when <paramref name="command"/> doesn't
        /// already end with one. A stray <c>\r</c> in the input is dropped
        /// (never double-submits): <c>Command</c> is caller-built kerboscript
        /// text, not raw keyboard bytes, so CRLF normalisation is the mod's
        /// job, not the caller's.
        ///
        /// <para>Returns false when the CPU has no terminal window and nothing
        /// could be typed at all. That is the same condition
        /// <see cref="KosProcessorScreen.TypeChars"/> already reports as a
        /// failure on the <c>kos.keystroke</c> path, and the caller turns it
        /// into the same refusal rather than acking a run that never
        /// happened.</para>
        /// </summary>
        private static bool TypeCommand(kOSProcessor proc, string command)
        {
            var window = proc.GetWindow();
            if (window == null)
            {
                return false;
            }
            foreach (var ch in command)
            {
                if (ch == '\r')
                {
                    continue;
                }
                window.ProcessOneInputChar(ch == '\n' ? '\r' : ch, null, true, true);
            }
            if (command.Length == 0 || command[command.Length - 1] != '\n')
            {
                window.ProcessOneInputChar('\r', null, true, true);
            }
            return true;
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
            // Held so Register can attach the terminal poll once the manager
            // exists (the addon drives both the dispatcher drain and the
            // ~20 Hz terminal downlink on the main thread).
            _boundAddon = addon;
        }
    }
}
