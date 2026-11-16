/**
 * FakeKosUplink: a fake `kos.run` Uplink responder, so `executeScript` and CPU
 * discovery coverage exercises the real dispatch → correlate → resolve
 * pipeline over a real `StubTransport` + `TelemetryClient`.
 *
 * Usage:
 *   const fake = FakeKosUplink.install();
 *   fake.setCpus([{ number: 1, tagname: "datastream" }]);
 *   fake.registerScript("0:/deltav.ks", (inv) => ({ fields: { dv: inv.args[0] } }));
 *   // ... run code under test that calls KosDataSource.executeScript ...
 *   FakeKosUplink.uninstall();
 *
 * What it handles:
 *   - `kos.processors`: publishes the coreId/tag list `setCpus()` is given.
 *     Subscribed eagerly on construction (a dummy listener) so it stays
 *     flowing: `KosUplinkExecutor`'s own lazy subscribe then replays the
 *     current list synchronously instead of racing an empty cache.
 *   - `kos.run`: looks up the handler registered for the run's path and
 *     answers with what it returns, as the mod would: `fields` for a script
 *     that called `ADDONS:GONOGO:RETURN`, `error` for one kOS stopped on an
 *     error, `ended` for one that finished without returning anything. A path
 *     with no handler is refused with `kos.scriptNotFound`, as the mod refuses
 *     a path with no script behind it.
 */

import type { CommandResult } from "@ksp-gonogo/sitrep-sdk";
import {
  createTestTelemetryClient,
  StubTransport,
  setActiveTelemetryClientForTests,
} from "@ksp-gonogo/sitrep-sdk/testing";
import type {
  KosProcessorInfo,
  KosRunResult,
} from "../__generated__/contract.js";
import type { KosData, KosScriptArg } from "../shared/kos-data.js";

export interface FakeKosCpu {
  /** Used as the coreId on the kos.processors wire shape. */
  number: number;
  tagname: string;
}

export interface FakeKosInvocation {
  script: string;
  args: KosScriptArg[];
  copyToLocal: boolean;
  cpu: { tagname: string };
}

/** What a fake script does: hand back fields, stop on an error, or finish with nothing. */
export type FakeKosOutcome = { fields: KosData } | { error: string } | { ended: true };

export type FakeKosScriptHandler = (
  invocation: FakeKosInvocation,
) => FakeKosOutcome | Promise<FakeKosOutcome>;

export class FakeKosUplink {
  private static active: FakeKosUplink | null = null;

  static install(): FakeKosUplink {
    if (FakeKosUplink.active) {
      throw new Error(
        "FakeKosUplink is already installed. Call uninstall() first.",
      );
    }
    const instance = new FakeKosUplink();
    FakeKosUplink.active = instance;
    return instance;
  }

  static uninstall(): void {
    setActiveTelemetryClientForTests(undefined);
    FakeKosUplink.active = null;
  }

  readonly transport = new StubTransport();
  readonly client = createTestTelemetryClient(this.transport);

  private cpuTagByCoreId = new Map<number, string>();
  private readonly scripts = new Map<string, FakeKosScriptHandler>();
  private readonly invocationLog: FakeKosInvocation[] = [];

  private constructor() {
    // Dummy always-on subscriber: see the class doc comment above.
    this.client.subscribe("kos.processors", () => {});
    this.transport.setCommandHandler((command, args) =>
      this.handleCommand(command, args),
    );
    setActiveTelemetryClientForTests(this.client);
    this.setCpus([{ number: 1, tagname: "datastream" }]);
  }

  setCpus(cpus: FakeKosCpu[]): void {
    this.cpuTagByCoreId = new Map(cpus.map((c) => [c.number, c.tagname]));
    this.transport.emit(
      "kos.processors",
      cpus.map(
        (c): KosProcessorInfo => ({
          coreId: c.number,
          tag: c.tagname,
          hasBooted: true,
          processorMode: "READY",
        }),
      ),
    );
  }

  registerScript(path: string, handler: FakeKosScriptHandler): void {
    this.scripts.set(path, handler);
  }

  /** Invocations seen across all dispatches, in order. */
  invocations(): FakeKosInvocation[] {
    return [...this.invocationLog];
  }

  private handleCommand(command: string, rawArgs: unknown): CommandResult {
    if (command !== "kos.run") return { success: true };
    const run = asRunArgs(rawArgs);
    if (!run) return { success: false, errorCode: "notFound" };
    const { coreId, requestId, path } = run;
    const invocation: FakeKosInvocation = {
      script: path,
      args: run.args,
      copyToLocal: run.copyToLocal === true,
      cpu: { tagname: this.cpuTagByCoreId.get(coreId) ?? "" },
    };
    this.invocationLog.push(invocation);

    const handler = this.scripts.get(path);
    if (!handler) {
      return { success: false, errorCode: "notFound", reason: "kos.scriptNotFound" };
    }
    void Promise.resolve(handler(invocation)).then((outcome) => {
      this.respond(coreId, requestId, outcome);
    });
    return { success: true };
  }

  private respond(
    coreId: number,
    requestId: string,
    outcome: FakeKosOutcome,
  ): void {
    this.transport.emit(`kos.run.${coreId}`, {
      coreId,
      requestId,
      fields: "fields" in outcome ? outcome.fields : null,
      error: "error" in outcome ? outcome.error : null,
      ended: "ended" in outcome,
    } satisfies KosRunResult);
  }
}

/**
 * The `kos.run` args a dispatch carried, and `null` when the fields this
 * fake answers on are not all there: a run it cannot correlate is refused
 * rather than answered against undefined.
 */
function asRunArgs(rawArgs: unknown): {
  coreId: number;
  requestId: string;
  path: string;
  args: KosScriptArg[];
  copyToLocal?: boolean;
} | null {
  if (
    typeof rawArgs !== "object" ||
    rawArgs === null ||
    typeof Reflect.get(rawArgs, "coreId") !== "number" ||
    typeof Reflect.get(rawArgs, "requestId") !== "string" ||
    typeof Reflect.get(rawArgs, "path") !== "string" ||
    !Array.isArray(Reflect.get(rawArgs, "args"))
  ) {
    return null;
  }
  return rawArgs as {
    coreId: number;
    requestId: string;
    path: string;
    args: KosScriptArg[];
    copyToLocal?: boolean;
  };
}
