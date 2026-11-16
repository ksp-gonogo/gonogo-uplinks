// GonogoKosUplink: GPLv3. See GonogoKosUplink.csproj's header comment for the
// licence/linkage rationale.

using System;
using System.Collections.Generic;
using Sitrep.Contract;

namespace Gonogo.KosUplink
{
    /// <summary>
    /// Pure, KSP/kOS-free bookkeeping for the <c>kos.run</c> command's
    /// request/response correlation. A kOS CPU runs one program at a time, so
    /// this only ever tracks one armed request per CPU, not a general request
    /// table.
    ///
    /// <para><b>Ending a run:</b> a run ends when its script hands back a
    /// value with <c>ADDONS:GONOGO:RETURN</c> (<see cref="Complete"/>), when
    /// kOS stops it on an error (<see cref="Fail"/>), when the program it
    /// started has finished and the CPU is back at its prompt
    /// (<see cref="PollIdle"/>), or when the caller abandons it
    /// (<see cref="CancelRun"/>).</para>
    /// </summary>
    public sealed class KosRunManager
    {
        // coreId -> the single armed request's RequestId. Presence in this
        // dictionary IS "armed", there is no separate flag.
        private readonly Dictionary<int, string> _pending = new Dictionary<int, string>();
        private readonly object _gate = new object();

        /*
         * Consecutive idle polls seen for each armed CPU. A started program is
         * compiled on a worker thread before it runs, so requiring several idle
         * polls in a row keeps a slow compile from ending a run that has not
         * started.
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
        /// The whole <c>kos.run</c> dispatch sequence: arm, start, and disarm
        /// again when the start was refused. <paramref name="start"/> returns
        /// null once the program is started, or the refusal to answer with.
        ///
        /// <para>The arm has to come first because a script can return or fail
        /// before <paramref name="start"/> returns, so the manager must already
        /// be expecting the result. That ordering is why the undo is needed.</para>
        ///
        /// <para>Lives here rather than in the KSP-touching caller so it can be
        /// tested headlessly: <c>KosExtension.Ksp.cs</c> is excluded from this
        /// Uplink's test project.</para>
        /// </summary>
        public CommandResult ArmAndStart(int coreId, string requestId, Func<CommandResult?> start)
        {
            if (!TryArm(coreId, requestId))
            {
                // Another kos.run is already in flight for this CPU: reject
                // rather than clobbering the earlier request's correlation.
                return CommandResult.Fail(KosErrorCodes.CpuBusy);
            }

            CommandResult? refusal;
            try
            {
                refusal = start();
            }
            catch
            {
                Cancel(coreId);
                throw;
            }
            if (refusal != null)
            {
                Cancel(coreId);
                return refusal;
            }

            return CommandResult.Ok();
        }

        /// <summary>True while a run is armed (in flight) for <paramref name="coreId"/>.</summary>
        public bool IsArmed(int coreId) { lock (_gate) { return _pending.ContainsKey(coreId); } }

        /// <summary>
        /// Ends the run armed for <paramref name="coreId"/> with the
        /// <paramref name="fields"/> its script handed back. Returns false, and
        /// publishes nothing, when no run is armed for that CPU.
        /// </summary>
        public bool Complete(int coreId, Dictionary<string, object?> fields)
        {
            string? requestId;
            lock (_gate)
            {
                if (!_pending.TryGetValue(coreId, out requestId))
                {
                    return false;
                }
                _pending.Remove(coreId);
                _idlePolls.Remove(coreId);
            }
            _publish?.Invoke(coreId, new KosRunResult { CoreId = coreId, RequestId = requestId, Fields = fields });
            return true;
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
        /// to the abandoned request. Also how <see cref="ArmAndStart"/> undoes
        /// an arm whose start was refused.
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
        /// at its prompt. Called from the main-thread update, so a script that
        /// hands nothing back still frees its CPU.
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
        /// processors a run was started on, so none of the armed requests can
        /// ever complete.
        /// </summary>
        public void Reset() { lock (_gate) { _pending.Clear(); _idlePolls.Clear(); } }
    }
}
