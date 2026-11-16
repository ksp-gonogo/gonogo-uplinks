import type { CommandResult, TelemetryClient } from "@ksp-gonogo/sitrep-sdk";
import { magnitudeOf, safeRandomUuid } from "@ksp-gonogo/sitrep-sdk";
import type {
  KosProcessorInfo,
  KosCancelArgs,
  KosRunArgs,
  KosRunResult,
} from "../__generated__/contract.js";
import { KosScriptError } from "../shared/KosScriptError.js";
import type { KosData, KosScriptArg } from "../shared/kos-data.js";
import type { KosFileCall } from "./kosFiles.js";

/**
 * `KosDataSource.executeScript`'s Uplink implementation: dispatches the
 * script's path and arguments via the `kos.run` command and resolves with the
 * correlated `kos.run.<coreId>` result.
 *
 * The `kos.processors` push channel it subscribes to for tagname → coreId
 * resolution doubles as the app's CPU-discovery feed: `onProcessorsChanged`
 * surfaces the processor list (which carries each CPU's `tag`) to the
 * screen-side registry. The subscription is standing, established the
 * moment a `TelemetryClient` is adopted (`adopt`, driven eagerly by the
 * `KosCpuDiscovery` mount) and held for that client's lifetime, so
 * discovery works whenever a sitrep stream is mounted, not only while a
 * `kos.run` dispatch is pending.
 *
 * Follows the same wire pattern end to end: dispatch → ack → wait for the
 * correlated channel frame → resolve/reject, as plain, non-hook code
 * driving a `TelemetryClient` handed in by the caller, `KosDataSource` is
 * a plain class, not a React component.
 */

const PROCESSORS_TOPIC = "kos.processors";
/** How long a call waits for `kos.processors` to name its CPU before refusing, in milliseconds. */
const DEFAULT_CPU_WAIT_MS = 3000;
const COMMS_DELAY_TOPIC = "comms.delay";

/**
 * How long a CPU gets to run a script once the signal has done its travelling.
 * The wait for an answer is this plus the command's round trip, so a delayed
 * craft is never given up on while its answer is still on the way.
 */
const DEFAULT_TIMEOUT_MS = 30_000;

interface QueuedRun {
  script: string;
  args: KosScriptArg[];
  /** Set for a file command, which the game answers without typing anything. */
  file?: KosFileCall;
  /** Aborting it drops the call, see `KosUplinkCpuQueue.cancel`. */
  signal?: AbortSignal;
  resolve: (data: KosData) => void;
  reject: (err: Error) => void;
}

interface InFlightRun {
  requestId: string;
  call: QueuedRun;
  timer: ReturnType<typeof setTimeout>;
  /** The wait this call was given, which the timeout message reports. */
  waitMs: number;
}

/**
 * Per-CPU FIFO in front of `kos.run` dispatches to a single `coreId`. A kOS
 * CPU's REPL is single-threaded (only one command may be in flight) so
 * calls to the same core are serialised here; calls to different cores get
 * their own queue and run in parallel.
 */
class KosUplinkCpuQueue {
  private queue: QueuedRun[] = [];
  private inFlight: InFlightRun | null = null;
  private readonly unsubscribe: () => void;

  constructor(
    private readonly client: TelemetryClient,
    private readonly coreId: number,
    private readonly timeoutMs: () => number,
  ) {
    this.unsubscribe = client.subscribe(`kos.run.${coreId}`, (payload) => {
      const result = asRunResult(payload);
      if (result) this.handleResult(result);
    });
  }

  enqueue(script: string, args: KosScriptArg[]): Promise<KosData> {
    return new Promise<KosData>((resolve, reject) => {
      this.queue.push({ script, args, resolve, reject });
      this.drain();
    });
  }

  /** Queue a file command behind any run already waiting. */
  enqueueFile(file: KosFileCall, signal?: AbortSignal): Promise<KosData> {
    return new Promise<KosData>((resolve, reject) => {
      if (signal?.aborted) {
        reject(cancelled(file));
        return;
      }
      const call: QueuedRun = {
        script: "",
        args: [],
        file,
        signal,
        resolve,
        reject,
      };
      signal?.addEventListener("abort", () => this.cancel(call), {
        once: true,
      });
      this.queue.push(call);
      this.drain();
    });
  }

  /**
   * Drops a call that was cancelled: one still waiting is removed, one in
   * flight stops holding the CPU's queue (a late result for it is ignored).
   */
  private cancel(call: QueuedRun): void {
    const error = cancelled(call.file);
    const queued = this.queue.indexOf(call);
    if (queued !== -1) {
      this.queue.splice(queued, 1);
      call.reject(error);
      return;
    }
    if (this.inFlight?.call !== call) return;
    clearTimeout(this.inFlight.timer);
    this.inFlight = null;
    call.reject(error);
    this.drain();
  }

  /** Reject every queued/in-flight call and drop the channel subscription. */
  dispose(reason: string): void {
    this.unsubscribe();
    if (this.inFlight) {
      clearTimeout(this.inFlight.timer);
      this.inFlight.call.reject(new Error(reason));
      this.inFlight = null;
    }
    for (const call of this.queue) call.reject(new Error(reason));
    this.queue = [];
  }

  private drain(): void {
    if (this.inFlight) return;
    let next = this.queue.shift();
    // A call cancelled while it waited is rejected, never sent.
    while (next?.signal?.aborted) {
      next.reject(cancelled(next.file));
      next = this.queue.shift();
    }
    if (!next) return;
    const requestId = safeRandomUuid();
    const waitMs = this.timeoutMs();
    const timer = setTimeout(() => {
      this.onTimeout(requestId);
    }, waitMs);
    this.inFlight = { requestId, call: next, timer, waitMs };

    const command = next.file?.command ?? "kos.run";
    const { result } =
      next.file === undefined
        ? this.client.dispatch("kos.run", {
            coreId: this.coreId,
            requestId,
            path: next.script,
            args: next.args,
            copyToLocal: false,
          } satisfies KosRunArgs)
        : this.client.dispatch(next.file.command, {
            coreId: this.coreId,
            requestId,
            ...next.file.args,
          });

    result
      .then((ack) => {
        const r = asCommandResult(ack);
        if (r && r.success === false) {
          this.settleFailure(
            requestId,
            new Error(
              `${command}: command rejected for CPU ${this.coreId} (errorCode ${r.errorCode})`,
            ),
          );
        }
        // success:true carries no payload of its own, the real result
        // arrives asynchronously on kos.run.<coreId>, handled below.
      })
      .catch((err: unknown) => {
        this.settleFailure(
          requestId,
          err instanceof Error ? err : new Error(String(err)),
        );
      });
  }

  private handleResult(payload: KosRunResult): void {
    // Correlate by requestId: a foreign/stale id (a duplicate, the sticky
    // replay of some earlier call, or a result meant for a call we already
    // timed out) must not settle the CURRENT in-flight call.
    if (!this.inFlight || this.inFlight.requestId !== payload.requestId) {
      return;
    }
    const { call, timer } = this.inFlight;
    clearTimeout(timer);
    this.inFlight = null;
    if (payload.error != null && call.file !== undefined) {
      // A file command runs no script, so its error is never a script fault.
      call.reject(new Error(`${call.file.command}: ${payload.error}`));
    } else if (payload.error != null) {
      // kOS stopped the script on an error: KosScriptError so callers can
      // tell a script fault from a transport error.
      call.reject(new KosScriptError(payload.error));
    } else if (payload.ended === true) {
      // The program finished without handing anything back: a finished run
      // with nothing to report, not a fault.
      call.resolve({});
    } else if (payload.fields == null) {
      // Unless `ended` says so, `KosRunResult`'s contract is that exactly one
      // of fields/error is non-null, so a frame with neither is one we cannot
      // read. Note `== null`: JsonWriter writes an absent value as JSON null
      // and KEEPS the key, so the strict form would let a null straight
      // through. A plain Error, not a KosScriptError, because nothing here is
      // the script author's fault.
      call.reject(
        new Error(
          `kos.run: CPU ${this.coreId} reported neither an error nor a field map, so the result could not be read`,
        ),
      );
    } else {
      call.resolve(payload.fields as KosData);
    }
    this.drain();
  }

  private onTimeout(requestId: string): void {
    if (!this.inFlight || this.inFlight.requestId !== requestId) return;
    const { call, waitMs } = this.inFlight;
    this.inFlight = null;
    // A file command never arms the CPU, so only a run has anything to cancel.
    // The mod frees the CPU for the next run and stops the program it is still on.
    if (call.file === undefined) {
      this.client
        .dispatch("kos.cancel", {
          coreId: this.coreId,
          requestId,
        } satisfies KosCancelArgs)
        .result.catch(() => {});
    }
    call.reject(
      new Error(
        `${call.file?.command ?? "kos.run"}: CPU ${this.coreId} did not respond within ${waitMs}ms`,
      ),
    );
    this.drain();
  }

  private settleFailure(requestId: string, err: Error): void {
    if (!this.inFlight || this.inFlight.requestId !== requestId) return;
    const { call, timer } = this.inFlight;
    clearTimeout(timer);
    this.inFlight = null;
    call.reject(err);
    this.drain();
  }
}

/**
 * Owns the tagname → coreId lookup (via the mod's native `kos.processors`
 * push channel) and one `KosUplinkCpuQueue` per resolved core. One instance
 * lives for the lifetime of `KosDataSource`; `run()` re-adopts whichever
 * `TelemetryClient` the caller hands in each call, tearing down every
 * subscription/queue tied to a previous client if it has changed (a fresh
 * `TelemetryProvider` mount invalidates old subscriptions and any
 * in-flight correlation against the old transport).
 */
export class KosUplinkExecutor {
  private readonly timeoutMs: number;
  private readonly cpuWaitMs: number;
  /** The latest one-way delay `comms.delay` reported, in seconds, or `null` while none is known. */
  private oneWaySeconds: number | null = null;
  private delayUnsub: (() => void) | null = null;
  private client: TelemetryClient | null = null;
  private processorsUnsub: (() => void) | null = null;
  private readonly coreIdByTag = new Map<string, number>();
  private readonly queues = new Map<number, KosUplinkCpuQueue>();
  // Last processor snapshot delivered on `kos.processors`, retained so a
  // late `onProcessorsChanged` subscriber (the screen-side discovery hook,
  // which registers after mount) gets the current CPU list immediately
  // instead of waiting for the next push. Reset on client change (dispose).
  private lastProcessors: KosProcessorInfo[] = [];
  private readonly processorsListeners = new Set<
    (procs: KosProcessorInfo[]) => void
  >();

  constructor(opts: { timeoutMs?: number; cpuWaitMs?: number } = {}) {
    this.timeoutMs = opts.timeoutMs ?? DEFAULT_TIMEOUT_MS;
    this.cpuWaitMs = opts.cpuWaitMs ?? DEFAULT_CPU_WAIT_MS;
  }

  /**
   * Adopt `client` for discovery without dispatching a run, the eager
   * entry point the `KosCpuDiscovery` mount calls so the `kos.processors`
   * subscription (and thus CPU discovery) stands up as soon as a sitrep
   * stream is mounted. Idempotent for the same client; a different client
   * tears down the old subscriptions first (see `adoptClient`).
   */
  adopt(client: TelemetryClient): void {
    this.adoptClient(client);
  }

  /**
   * True once a `TelemetryClient` is adopted and the mod has reported at
   * least one CPU on `kos.processors`: i.e. the sitrep stream is live and
   * kOS is actually present. Drives `KosDataSource`'s status pill.
   */
  get hasLiveProcessors(): boolean {
    return this.client !== null && this.lastProcessors.length > 0;
  }

  /** True once a `TelemetryClient` has been adopted (stream mounted). */
  get hasClient(): boolean {
    return this.client !== null;
  }

  /**
   * Subscribe to CPU-list changes. Fires with the full processor snapshot
   * (each entry carries `tag`/`coreId`) every time `kos.processors` pushes a
   * new list, and replays the current snapshot synchronously on subscribe so
   * a late subscriber isn't blank until the next push. Returns an unsubscribe.
   */
  onProcessorsChanged(cb: (procs: KosProcessorInfo[]) => void): () => void {
    this.processorsListeners.add(cb);
    if (this.lastProcessors.length > 0) cb(this.lastProcessors);
    return () => this.processorsListeners.delete(cb);
  }

  /**
   * Run `script` on `cpu` (a tagname) via the `kos.run` Uplink. Rejects
   * immediately (no telnet fallback) if `cpu` doesn't resolve to a known
   * `coreId` yet (the `kos.processors` channel hasn't reported it, or it's
   * genuinely not a live CPU).
   */
  run(
    client: TelemetryClient,
    cpu: string,
    script: string,
    args: KosScriptArg[],
  ): Promise<KosData> {
    this.adoptClient(client);
    return this.resolveCoreId(cpu).then((coreId) => {
      if (coreId === undefined) {
        throw new Error(
          `kos.run: no known CPU with tagname "${cpu}", waiting on kos.processors, or the tagname is wrong`,
        );
      }
      return this.getOrCreateQueue(coreId).enqueue(script, args);
    });
  }

  /**
   * List the files on `volume` of the CPU named `cpu`, over `kos.files.list`.
   * Shares the per-CPU queue with {@link run}, and rejects the same way when
   * `cpu` does not resolve to a known `coreId`.
   */
  listFiles(
    client: TelemetryClient,
    cpu: string,
    volume: string,
    signal?: AbortSignal,
  ): Promise<KosData> {
    return this.file(
      client,
      cpu,
      { command: "kos.files.list", args: { volume } },
      signal,
    );
  }

  /**
   * Send one `kos.files.*` command to the CPU named `cpu` and resolve with the
   * fields its correlated `kos.run.<coreId>` answer carries. Shares the per-CPU
   * queue with {@link run}. A refusal rejects with the stream's own command
   * error, whose `reason` names the refusal (such as `kos.fileChanged`) and
   * whose `detail` says what to do about it.
   */
  file(
    client: TelemetryClient,
    cpu: string,
    call: KosFileCall,
    signal?: AbortSignal,
  ): Promise<KosData> {
    this.adoptClient(client);
    return this.resolveCoreId(cpu).then((coreId) => {
      if (coreId === undefined) {
        throw new Error(
          `${call.command}: no known CPU with tagname "${cpu}", waiting on kos.processors, or the tagname is wrong`,
        );
      }
      return this.getOrCreateQueue(coreId).enqueueFile(call, signal);
    });
  }

  /**
   * The coreId for `cpu`, waiting up to the CPU wait for a `kos.processors`
   * snapshot that names it when it is not known yet. A client adopted by the
   * call itself has no snapshot until the stream replays one, so a refusal
   * made at once would fail the first press after a page load.
   */
  private resolveCoreId(cpu: string): Promise<number | undefined> {
    const known = this.coreIdByTag.get(cpu);
    if (known !== undefined || this.cpuWaitMs <= 0) {
      return Promise.resolve(known);
    }
    return new Promise((resolve) => {
      const finish = (): void => {
        clearTimeout(timer);
        this.processorsListeners.delete(listener);
        resolve(this.coreIdByTag.get(cpu));
      };
      const listener = (): void => {
        if (this.coreIdByTag.has(cpu)) finish();
      };
      const timer = setTimeout(finish, this.cpuWaitMs);
      this.processorsListeners.add(listener);
    });
  }

  /** Tear down every subscription and queue, rejecting any in-flight/queued call. */
  dispose(): void {
    this.processorsUnsub?.();
    this.processorsUnsub = null;
    this.delayUnsub?.();
    this.delayUnsub = null;
    this.oneWaySeconds = null;
    for (const queue of this.queues.values()) {
      queue.dispose("kos: Uplink executor disposed");
    }
    this.queues.clear();
    this.coreIdByTag.clear();
    this.lastProcessors = [];
    this.client = null;
  }

  private adoptClient(client: TelemetryClient): void {
    if (this.client === client) return;
    // A different TelemetryClient instance (reconnect / provider remount)
    // invalidates every subscription and correlation tied to the old one.
    this.dispose();
    this.client = client;
    this.processorsUnsub = client.subscribe(PROCESSORS_TOPIC, (payload) => {
      this.handleProcessors(asProcessorList(payload));
    });
    this.delayUnsub = client.subscribe(COMMS_DELAY_TOPIC, (payload) => {
      this.oneWaySeconds = asOneWaySeconds(payload);
    });
  }

  /**
   * The wait a dispatch made now is given: the script's own allowance plus the
   * command's round trip, since both the order and its result cross the delay.
   * With no delay known the allowance stands alone.
   */
  private waitMs(): number {
    const roundTripMs = (this.oneWaySeconds ?? 0) * 2 * 1000;
    return this.timeoutMs + roundTripMs;
  }

  private handleProcessors(info: KosProcessorInfo[] | undefined): void {
    if (info === undefined) return;
    // Full-snapshot channel: replace, don't merge, so a CPU that goes
    // away (reboot / unload) stops resolving instead of sticking around
    // on a stale coreId.
    this.coreIdByTag.clear();
    for (const p of info) {
      if (p.tag) this.coreIdByTag.set(p.tag, p.coreId);
    }
    this.lastProcessors = info;
    for (const cb of this.processorsListeners) cb(info);
  }

  private getOrCreateQueue(coreId: number): KosUplinkCpuQueue {
    const existing = this.queues.get(coreId);
    if (existing) return existing;
    if (!this.client) {
      // Unreachable in practice: adoptClient() always runs first in run(),
      // but keeps this method safe to call standalone.
      throw new Error("kos.run: no active telemetry client");
    }
    const queue = new KosUplinkCpuQueue(this.client, coreId, () => this.waitMs());
    this.queues.set(coreId, queue);
    return queue;
  }
}

function cancelled(file: KosFileCall | undefined): Error {
  return new Error(`${file?.command ?? "kos.run"}: cancelled`);
}

/**
 * The one-way delay a `comms.delay` frame carries, in seconds, and `null` when
 * it carries none a wait can be sized from.
 */
function asOneWaySeconds(payload: unknown): number | null {
  if (typeof payload !== "object" || payload === null) return null;
  const seconds = magnitudeOf(
    Reflect.get(payload, "oneWaySeconds") as Parameters<typeof magnitudeOf>[0],
  );
  return seconds !== null && seconds > 0 ? seconds : null;
}

/**
 * The run result a `kos.run.<coreId>` frame carries, and `null` when it carries
 * no request to correlate against: an uncorrelated frame settles nothing, so it
 * is dropped rather than read.
 */
function asRunResult(payload: unknown): KosRunResult | null {
  if (
    typeof payload !== "object" ||
    payload === null ||
    typeof Reflect.get(payload, "requestId") !== "string" ||
    typeof Reflect.get(payload, "coreId") !== "number"
  ) {
    return null;
  }
  return payload as KosRunResult;
}

/**
 * The ack a command resolved with, and `undefined` when it answered something
 * with no `success` to read: only an explicit `false` is a rejection, so an
 * unreadable ack is the same as no ack at all.
 */
function asCommandResult(ack: unknown): CommandResult | undefined {
  if (
    typeof ack !== "object" ||
    ack === null ||
    typeof Reflect.get(ack, "success") !== "boolean"
  ) {
    return undefined;
  }
  return ack as CommandResult;
}

/**
 * The CPU snapshot a `kos.processors` frame carries, and `undefined` for
 * anything that is not a list of entries carrying a `coreId`.
 */
function asProcessorList(payload: unknown): KosProcessorInfo[] | undefined {
  if (!Array.isArray(payload)) return undefined;
  const entries: unknown[] = payload;
  const every = entries.every(
    (entry) =>
      typeof entry === "object" &&
      entry !== null &&
      typeof Reflect.get(entry, "coreId") === "number",
  );
  return every ? (entries as KosProcessorInfo[]) : undefined;
}
