import type { TelemetryClient } from "@ksp-gonogo/sitrep-sdk";
import {
  createPerfBudget,
  getActiveTelemetryClient,
  registerUplinkHandle,
} from "@ksp-gonogo/sitrep-sdk";
import type { KosProcessorInfo } from "../__generated__/contract.js";
import type { KosData, KosScriptArg } from "../shared/kos-data.js";
import {
  deleteAnswer,
  type KosFileCall,
  type KosFileDeleted,
  type KosFileRenamed,
  type KosFileText,
  type KosFileWritten,
  type KosVolume,
  readAnswer,
  renameAnswer,
  writeAnswer,
} from "./kosFiles.js";
import { KosUplinkExecutor, type KosRunListeners } from "./kosUplinkExecutor.js";

export type {
  KosFileDeleted,
  KosFileRenamed,
  KosFileText,
  KosFileWritten,
  KosVolume,
};

export type { KosScriptArg };

/** Milliseconds a single executeScript call waits for its script to return, fail or end. */
const DEFAULT_CALL_TIMEOUT_MS = 30_000;

/**
 * Soft cap on kOS executeScript dispatch rate. Each script run holds a
 * CPU's REPL for ~hundreds of ms (RUNPATH + queue drain), so a sustained
 * dispatch rate above ~5/sec means widgets are stomping each other. At
 * 10/sec we want to know about it.
 */
const KOS_DISPATCH_BUDGET = createPerfBudget({
  name: "KosDataSource.executeScript dispatches/sec",
  threshold: 10,
  windowMs: 1000,
  unit: "dispatches",
});

interface KosDataSourceOptions {
  callTimeoutMs?: number;
  /**
   * Accepted for source-construction back-compat (existing tests pass it) and
   * ignored: dispatch rides the `kos.run` Uplink, which needs no post-attach
   * settle delay.
   */
  postAttachDrainDelayMs?: number;
  /** How long a call waits for `kos.processors` to name its CPU before refusing. */
  cpuWaitMs?: number;
}

/**
 * Plain kOS Uplink client: exposes `executeScript(cpu, script, args)` for
 * widgets that run kOS scripts on individual CPUs (dispatched over the
 * `kos.run` Uplink; see `kosUplinkExecutor.ts`), and surfaces CPU
 * discovery off the mod's native `kos.processors` push channel
 * (`onProcessorsChanged`). Registered only via `registerUplinkHandle("kos",
 * kosSource)` (not `registerDataSource`) so it never appears in the
 * generic Data Sources panel; kOS's own health surfaces via the mod-side
 * `ISitrepUplink.Health()` (`KosHealth`) instead. Same SPI-free shape as
 * other first-party Uplinks that carry no subscribable data keys of their
 * own.
 *
 * No persistent socket is held by this source. Everything rides the sitrep
 * telemetry stream: `executeScript` correlates a `kos.run.<coreId>` result,
 * and discovery stands up the moment a `TelemetryClient` is adopted
 * (`attachTelemetryClient`, driven by the `KosCpuDiscovery` mount).
 */
export class KosDataSource {
  id = "kos";
  name = "kOS";

  private readonly callTimeoutMs: number;

  // The ONLY transport executeScript() dispatches through: the kos.run
  // Uplink command + kos.run.<coreId> channel. Also owns the standing
  // kos.processors subscription that feeds CPU discovery. See
  // kosUplinkExecutor.ts.
  private readonly uplinkExecutor: KosUplinkExecutor;

  constructor(opts: KosDataSourceOptions = {}) {
    this.callTimeoutMs = opts.callTimeoutMs ?? DEFAULT_CALL_TIMEOUT_MS;
    this.uplinkExecutor = new KosUplinkExecutor({
      timeoutMs: this.callTimeoutMs,
      cpuWaitMs: opts.cpuWaitMs,
    });
  }

  /**
   * Adopt the active sitrep `TelemetryClient` for kOS discovery + dispatch.
   * Establishes the standing `kos.processors` subscription so CPU discovery
   * works whenever a stream is mounted, not only while a `kos.run` dispatch
   * is pending. Idempotent for the same client; driven eagerly by the
   * `KosCpuDiscovery` mount on every client change.
   */
  attachTelemetryClient(client: TelemetryClient): void {
    this.uplinkExecutor.adopt(client);
  }

  /**
   * Subscribe to CPU-list changes off the mod's native `kos.processors`
   * push channel. Fires with the full processor snapshot (each entry
   * carries `tag`/`coreId`) whenever the list changes, and replays the
   * current snapshot synchronously on subscribe. `KosCpuDiscovery` maps
   * `procs.map(p => p.tag)` into the CPU registry.
   */
  onProcessorsChanged(cb: (procs: KosProcessorInfo[]) => void): () => void {
    return this.uplinkExecutor.onProcessorsChanged(cb);
  }

  /** Tear down the standing subscription and reject any in-flight dispatch. */
  disconnect(): void {
    this.uplinkExecutor.dispose();
  }

  /**
   * Run a script on the named CPU and resolve with the lexicon it handed back
   * with `ADDONS:GONOGO:RETURN` (empty when it finished without one),
   * dispatched over the `kos.run` Uplink (see `kosUplinkExecutor.ts`),
   * the only transport this method uses. Calls to the same CPU are
   * serialised by a per-core FIFO queue; calls to different CPUs run in
   * parallel. Rejects if the CPU's tagname doesn't resolve to a known
   * `coreId`, no `kos.run.<coreId>` result arrives within the call timeout,
   * or no telemetry stream is mounted at all (`kOS Uplink not connected`).
   * `listeners.onLog` hears each value the script hands to
   * `ADDONS:GONOGO:LOG` while it runs (see {@link KosRunListeners}).
   */
  executeScript(
    cpu: string,
    script: string,
    args: KosScriptArg[],
    listeners?: KosRunListeners,
  ): Promise<KosData> {
    KOS_DISPATCH_BUDGET.record();
    const client = getActiveTelemetryClient();
    if (!client) {
      return Promise.reject(
        new Error(
          "kOS Uplink not connected: no telemetry stream is mounted, so executeScript has no transport to dispatch on.",
        ),
      );
    }
    return this.uplinkExecutor.run(client, cpu, script, args, listeners);
  }

  /**
   * List the files on `volume` (`0:` the Archive, `1:` the CPU's own drive) of
   * the named CPU and resolve with the listing fields, read by the game
   * without typing anything into the CPU's terminal. Shares the per-CPU queue
   * and the rejection rules of {@link executeScript}. Aborting `signal` drops
   * the request: it leaves the queue, or stops holding it if already sent, and
   * rejects.
   */
  listFiles(
    cpu: string,
    volume: string,
    signal?: AbortSignal,
  ): Promise<KosData> {
    KOS_DISPATCH_BUDGET.record();
    const client = getActiveTelemetryClient();
    if (!client) {
      return Promise.reject(
        new Error(
          "kOS Uplink not connected: no telemetry stream is mounted, so listFiles has no transport to dispatch on.",
        ),
      );
    }
    return this.uplinkExecutor.listFiles(client, cpu, volume, signal);
  }

  /**
   * Read one file's text from `volume` of the named CPU, with the content hash
   * {@link writeFile}, {@link deleteFile} and {@link renameFile} name to be sure
   * it has not changed since. Read through kOS's own volumes, without typing
   * anything into the CPU's terminal, and queued with {@link executeScript}'s
   * calls to the same CPU. A refusal (no file there, a path outside the rules,
   * a binary or oversized file, the Archive with no link home) rejects with
   * the stream's command error, whose `reason` names it.
   */
  readFile(
    cpu: string,
    volume: KosVolume,
    path: string,
    signal?: AbortSignal,
  ): Promise<KosFileText> {
    return this.fileCommand(
      cpu,
      { command: "kos.files.read", args: { volume, path } },
      signal,
    ).then(readAnswer);
  }

  /**
   * Save `text` as one file on `volume` of the named CPU. `expectedHash` is the
   * hash {@link readFile} last answered for it, or null to create a new file.
   * Refused, with nothing written, when the file has changed since that read
   * (reason `kos.fileChanged`), when a new file's name is taken
   * (`kos.fileExists`), or when it does not fit on the CPU's own drive
   * (`kos.driveFull`).
   */
  writeFile(
    cpu: string,
    volume: KosVolume,
    path: string,
    text: string,
    expectedHash: string | null,
    signal?: AbortSignal,
  ): Promise<KosFileWritten> {
    return this.fileCommand(
      cpu,
      {
        command: "kos.files.write",
        args: { volume, path, text, expectedHash: expectedHash ?? undefined },
      },
      signal,
    ).then(writeAnswer);
  }

  /**
   * Delete one file on `volume` of the named CPU, refused (reason
   * `kos.fileChanged`) when it has changed since the read that answered
   * `expectedHash`.
   */
  deleteFile(
    cpu: string,
    volume: KosVolume,
    path: string,
    expectedHash: string,
    signal?: AbortSignal,
  ): Promise<KosFileDeleted> {
    return this.fileCommand(
      cpu,
      { command: "kos.files.delete", args: { volume, path, expectedHash } },
      signal,
    ).then(deleteAnswer);
  }

  /**
   * Rename or move one file within `volume` of the named CPU, refused when it
   * has changed since the read that answered `expectedHash`
   * (`kos.fileChanged`) or when a file already has `newPath`
   * (`kos.fileExists`).
   */
  renameFile(
    cpu: string,
    volume: KosVolume,
    path: string,
    newPath: string,
    expectedHash: string,
    signal?: AbortSignal,
  ): Promise<KosFileRenamed> {
    return this.fileCommand(
      cpu,
      {
        command: "kos.files.rename",
        args: { volume, path, newPath, expectedHash },
      },
      signal,
    ).then(renameAnswer);
  }

  private fileCommand(
    cpu: string,
    call: KosFileCall,
    signal?: AbortSignal,
  ): Promise<KosData> {
    KOS_DISPATCH_BUDGET.record();
    const client = getActiveTelemetryClient();
    if (!client) {
      return Promise.reject(
        new Error(
          `kOS Uplink not connected: no telemetry stream is mounted, so ${call.command} has no transport to dispatch on.`,
        ),
      );
    }
    return this.uplinkExecutor.file(client, cpu, call, signal);
  }

  // Host-side relay handle for station peer-relayed calls (see
  // PeerHostService.handleUplinkRelay / PeerClientDataSource.relay). Only
  // the "executeScript" and "listFiles" methods are exposed, the kOS-specific
  // isScriptError-via-errorMeta unwrap is the calling client's own
  // responsibility, not this source's.
  async relay(method: string, args: unknown): Promise<unknown> {
    if (method === "executeScript") {
      if (
        typeof args !== "object" ||
        args === null ||
        typeof Reflect.get(args, "cpu") !== "string" ||
        typeof Reflect.get(args, "script") !== "string" ||
        !Array.isArray(Reflect.get(args, "args"))
      ) {
        throw new Error(
          'kos relay handle: "executeScript" needs a cpu, a script and an args list',
        );
      }
      const a = args as {
        cpu: string;
        script: string;
        args: KosScriptArg[];
      };
      return this.executeScript(a.cpu, a.script, a.args);
    }
    if (method === "listFiles") {
      if (
        typeof args !== "object" ||
        args === null ||
        typeof Reflect.get(args, "cpu") !== "string" ||
        typeof Reflect.get(args, "volume") !== "string"
      ) {
        throw new Error(
          'kos relay handle: "listFiles" needs a cpu and a volume',
        );
      }
      const a = args as { cpu: string; volume: string };
      return this.listFiles(a.cpu, a.volume);
    }
    throw new Error(`kos relay handle: unknown method "${method}"`);
  }
}

export const kosSource = new KosDataSource();
registerUplinkHandle("kos", kosSource);
