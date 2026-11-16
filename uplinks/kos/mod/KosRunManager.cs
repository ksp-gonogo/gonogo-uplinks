// GonogoKosUplink: GPLv3. See GonogoKosUplink.csproj's header comment for the
// licence/linkage rationale.

using System;
using System.Collections.Generic;
using Sitrep.Contract;

namespace Gonogo.KosUplink
{
    /// <summary>
    /// Pure, KSP/kOS-free bookkeeping for the <c>kos.run</c> command's
    /// request/response correlation: see <c>kos-uplink-full-migration.md</c>.
    /// A kOS CPU's interpreter is a single-threaded REPL (only one command
    /// can be "in flight" at a time, guarded by <c>IsWaitingForCommand()</c>
    /// at the KSP-touching call site), so this only ever needs to track one
    /// armed request per CPU, not a general request table.
    ///
    /// <para><b>Wiring:</b> the KSP-touching <c>Run(KosRunArgs)</c> command
    /// handler (<c>KosExtension.Ksp.cs</c>) calls <see cref="TryArm"/> after
    /// confirming the CPU is idle and before typing the command; the
    /// KSP-free <c>KosExtension.OnPrint</c>: already resolving the emitting
    /// CPU once per completed <see cref="KosComputeBlock"/>, for the
    /// <c>kos.compute.*</c> fanout: routes a completed block to
    /// <see cref="Complete"/> instead of the compute fanout whenever
    /// <see cref="IsArmed"/> is true for that CPU. This class never touches
    /// a kOS/Unity type directly, so it is fully unit-testable headlessly
    /// (mirrors <c>KosTerminalManager</c>'s KSP-free/KSP-touching split).</para>
    ///
    /// <para><b>Ending a run:</b> a run ends when a <c>[KOSDATA]</c> or
    /// <c>[KOSERROR]</c> block completes (<see cref="Complete"/>), when the
    /// CPU's interpreter is back at its prompt with nothing queued to type
    /// (<see cref="PollIdle"/>, for a script that prints no block), or when
    /// the caller abandons it (<see cref="CancelRun"/>).</para>
    /// </summary>
    public sealed class KosRunManager
    {
        // coreId -> the single armed request's RequestId. Presence in this
        // dictionary IS "armed", there is no separate flag.
        private readonly Dictionary<int, string> _pending = new Dictionary<int, string>();
        private readonly object _gate = new object();

        /*
         * Consecutive idle polls seen for each armed CPU. The typed command sits
         * in kOS's input queue until the interpreter consumes it, so a CPU can
         * read as idle for a poll or two right after typing; requiring several in
         * a row keeps that window from ending a run that has not started.
         */
        private readonly Dictionary<int, int> _idlePolls = new Dictionary<int, int>();

        /// <summary>Consecutive idle polls that end a run with no block.</summary>
        internal const int IdlePollsToEnd = 3;

        private Action<int, KosRunResult>? _publish;

        /// <summary>
        /// Wire the publish sink: called once from
        /// <c>KosExtension.Ksp.cs</c>'s <c>RegisterKspBindings</c> with a
        /// delegate that publishes onto <c>kos.run.&lt;coreId&gt;</c>. Tests
        /// wire their own recording delegate directly, bypassing
        /// <c>KosExtension</c> entirely: this class needs no KosExtension
        /// instance to be tested.
        /// </summary>
        public void SetPublisher(Action<int, KosRunResult> publish) => _publish = publish;

        /// <summary>
        /// Arm a pending run for <paramref name="coreId"/>. Returns false,
        /// caller should reject the command (mirrors <c>ModeUnavailable</c>,
        /// the same "reject, never silently clobber" posture as
        /// <c>KosTerminalManager.Open</c>'s lease conflict): when a run is
        /// already in flight for this CPU, or <paramref name="requestId"/> is
        /// empty. The client's own per-CPU FIFO queue (mirroring
        /// <c>KosComputeSession</c>) is expected to prevent this in the
        /// steady state.
        /// </summary>
        public bool TryArm(int coreId, string requestId)
        {
            if (string.IsNullOrEmpty(requestId))
            {
                return false;
            }
            lock (_gate)
            {
                if (_pending.ContainsKey(coreId))
                {
                    return false;
                }
                _pending[coreId] = requestId;
                _idlePolls.Remove(coreId);
                return true;
            }
        }

        /// <summary>
        /// The whole <c>kos.run</c> dispatch sequence: arm, type, and disarm
        /// again if the typing did not happen. <paramref name="type"/> returns
        /// false when the CPU could not be typed into at all (no terminal
        /// window), which is not a run the caller can ever get a result for:
        /// arming is undone so the next <c>kos.run</c> to that CPU still gets
        /// through, and the operator is told the press did nothing instead of
        /// waiting out the client's round-trip timeout.
        ///
        /// <para>The arm has to come first because a trivial one-tick script
        /// can complete its <c>[KOSDATA]</c> block synchronously inside the
        /// typing call (<c>OnPrint</c> runs inline inside kOS's print), so the
        /// manager must already be expecting the result before any character
        /// reaches the interpreter. That ordering is why the undo is needed:
        /// there is no way to check the window first and arm afterwards.</para>
        ///
        /// <para>Lives here rather than in the KSP-touching caller so it can be
        /// tested headlessly: <c>KosExtension.Ksp.cs</c> is excluded from this
        /// Uplink's test project, so a refusal written there could not be
        /// covered at all.</para>
        /// </summary>
        public CommandResult ArmAndType(int coreId, string requestId, Func<bool> type)
        {
            if (!TryArm(coreId, requestId))
            {
                // Another kos.run is already in flight for this CPU. The
                // client's own per-CPU serialization (mirroring
                // KosComputeSession's FIFO queue) is expected to prevent this
                // in the steady state: reject rather than silently clobbering
                // the earlier request's correlation.
                return CommandResult.Fail(KosErrorCodes.CpuBusy);
            }

            if (!type())
            {
                Cancel(coreId);
                return CommandResult.Fail(KosErrorCodes.NoTerminal);
            }

            return CommandResult.Ok();
        }

        /// <summary>True while a run is armed (in flight) for <paramref name="coreId"/>.</summary>
        public bool IsArmed(int coreId) { lock (_gate) { return _pending.ContainsKey(coreId); } }

        /// <summary>True while any CPU has an armed run, widens OnPrint's subscription gate so accumulation isn't starved when nobody subscribes to kos.compute.* (see the migration plan's "Subscription-gate fix").</summary>
        public bool HasAnyArmed() { lock (_gate) { return _pending.Count > 0; } }

        /// <summary>
        /// Called when a <see cref="KosComputeBlock"/> completes for
        /// <paramref name="coreId"/>'s screen while a run is armed for that
        /// CPU (caller must check <see cref="IsArmed"/> first, this is a
        /// no-op, not an error, when nothing is armed, so a stray completed
        /// block after eviction/cancellation is harmless). Publishes the
        /// correlated <see cref="KosRunResult"/> and disarms.
        /// </summary>
        public void Complete(int coreId, KosComputeBlock block)
        {
            string? requestId;
            lock (_gate)
            {
                if (!_pending.TryGetValue(coreId, out requestId))
                {
                    return;
                }
                _pending.Remove(coreId);
                _idlePolls.Remove(coreId);
            }

            var result = new KosRunResult
            {
                CoreId = coreId,
                RequestId = requestId,
                Fields = block.IsError ? null : ToFieldMap(block.Fields),
                Error = block.IsError ? block.ErrorMessage : null,
            };
            _publish?.Invoke(coreId, result);
        }

        /// <summary>
        /// Ends the run armed for <paramref name="coreId"/> with
        /// <paramref name="message"/> as its error: kOS stopped the script on an
        /// error before it returned. A no-op when nothing is armed for that CPU,
        /// since kOS reports errors from the operator's own typed commands the
        /// same way.
        /// </summary>
        public void Fail(int coreId, string message)
        {
            string? requestId;
            lock (_gate)
            {
                if (!_pending.TryGetValue(coreId, out requestId))
                {
                    return;
                }
                _pending.Remove(coreId);
                _idlePolls.Remove(coreId);
            }
            _publish?.Invoke(coreId, new KosRunResult { CoreId = coreId, RequestId = requestId, Error = message });
        }

        /// <summary>
        /// Disarm <paramref name="coreId"/> Without publishing: for a CPU
        /// going away (reboot/unload) mid-run, so a later unrelated block
        /// from a freshly-booted CPU with the same id isn't mis-attributed
        /// to the abandoned request. Also how <see cref="ArmAndType"/> undoes
        /// an arm whose typing never reached the CPU.
        /// </summary>
        public void Cancel(int coreId) { lock (_gate) { _pending.Remove(coreId); _idlePolls.Remove(coreId); } }

        /// <summary>
        /// Disarms <paramref name="coreId"/> without publishing, but only while
        /// <paramref name="requestId"/> is still the run it is armed for. Returns
        /// true when it was, which is also the caller's cue to stop whatever the
        /// CPU is still running; false when the run had already ended or a newer
        /// one is armed, so a late cancel never touches someone else's run.
        /// </summary>
        public bool CancelRun(int coreId, string requestId)
        {
            lock (_gate)
            {
                if (!_pending.TryGetValue(coreId, out var armed) || armed != requestId)
                {
                    return false;
                }
                _pending.Remove(coreId);
                _idlePolls.Remove(coreId);
                return true;
            }
        }

        /// <summary>
        /// Ends every armed run whose CPU has been idle for
        /// <see cref="IdlePollsToEnd"/> consecutive calls, publishing a result
        /// with no fields and no error and <see cref="KosRunResult.Ended"/> set.
        /// <paramref name="isIdle"/> answers whether a CPU's interpreter is back
        /// at its prompt with nothing left to type. Called from the main-thread
        /// update, so a script that never prints a block still frees its CPU.
        /// </summary>
        public void PollIdle(Func<int, bool> isIdle)
        {
            List<KeyValuePair<int, string>>? ended = null;
            lock (_gate)
            {
                if (_pending.Count == 0)
                {
                    return;
                }
                foreach (var kv in _pending)
                {
                    if (!isIdle(kv.Key))
                    {
                        _idlePolls.Remove(kv.Key);
                        continue;
                    }
                    _idlePolls.TryGetValue(kv.Key, out var seen);
                    seen++;
                    if (seen < IdlePollsToEnd)
                    {
                        _idlePolls[kv.Key] = seen;
                        continue;
                    }
                    (ended ??= new List<KeyValuePair<int, string>>()).Add(kv);
                }
                if (ended != null)
                {
                    foreach (var kv in ended)
                    {
                        _pending.Remove(kv.Key);
                        _idlePolls.Remove(kv.Key);
                    }
                }
            }
            if (ended == null)
            {
                return;
            }
            foreach (var kv in ended)
            {
                _publish?.Invoke(kv.Key, new KosRunResult { CoreId = kv.Key, RequestId = kv.Value, Ended = true });
            }
        }

        /// <summary>
        /// Disarms every CPU without publishing. A load or revert destroys the
        /// processors a run was typed into, so none of the armed requests can
        /// ever complete.
        /// </summary>
        public void Reset() { lock (_gate) { _pending.Clear(); _idlePolls.Clear(); } }

        private static Dictionary<string, object?> ToFieldMap(IReadOnlyDictionary<string, object> fields)
        {
            var map = new Dictionary<string, object?>(fields.Count);
            foreach (var kv in fields)
            {
                map[kv.Key] = kv.Value;
            }
            return map;
        }
    }
}
