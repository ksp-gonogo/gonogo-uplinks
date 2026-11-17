import {
  createTestTelemetryClient,
  StubTransport,
} from "@ksp-gonogo/sitrep-sdk/testing";
import { afterEach, describe, expect, it, vi } from "vitest";
import type { KosLogEntry, KosRunResult } from "../__generated__/contract.js";
import { recordDispatch } from "../test/recordedCommands.js";
import { KosUplinkExecutor, LOG_GRACE_MS } from "./kosUplinkExecutor.js";

/**
 * `ADDONS:GONOGO:LOG` through the executor: entries reach the caller while the
 * run is in flight, and still reach it when they cross the delay after the
 * run's own result. Real client and stub transport, only the wire is faked.
 */

async function started() {
  const transport = new StubTransport();
  const client = createTestTelemetryClient(transport);
  const commands: { command: string; args: { requestId: string } }[] = [];
  transport.setCommandHandler((command, args) => {
    recordDispatch<"kos.run">(commands as never, command, args);
    return { success: true };
  });
  const executor = new KosUplinkExecutor();
  executor.adopt(client);
  transport.emit("kos.processors", [
    { coreId: 7, tag: "lander", hasBooted: true, processorMode: "READY" },
  ]);
  const heard: KosLogEntry[] = [];
  const counts: { logged: number; dropped: number }[] = [];
  const pending = executor.run(client, "lander", "0:/watch.ks", [], {
    onLog: (e) => heard.push(e),
    onLogged: (c) => counts.push(c),
  });
  for (let i = 0; i < 200 && commands.length === 0; i++) {
    await new Promise((r) => setTimeout(r, 1));
  }
  const requestId = commands[0].args.requestId;
  const log = (seq: number, value: unknown) =>
    transport.emit("kos.log.7", { coreId: 7, requestId, seq, value } satisfies KosLogEntry);
  const result = (logged: number, dropped = 0) =>
    transport.emit("kos.run.7", {
      coreId: 7,
      requestId,
      fields: { done: true },
      error: null,
      ended: false,
      logged,
      dropped,
    } satisfies KosRunResult);
  return { transport, pending, heard, counts, log, result, requestId };
}

describe("KosUplinkExecutor log", () => {
  afterEach(() => {
    vi.useRealTimers();
  });

  it("hands each entry to the caller while the run is in flight, without settling it", async () => {
    const { pending, heard, log, result } = await started();

    log(0, 1);
    log(1, "two");
    expect(heard.map((e) => e.value)).toEqual([1, "two"]);

    result(2);
    await expect(pending).resolves.toEqual({ done: true });
  });

  it("still delivers entries that land after the result, until the announced count is in", async () => {
    const { pending, heard, counts, log, result } = await started();

    result(3);
    await pending;
    expect(counts).toEqual([{ logged: 3, dropped: 0 }]);

    log(1, "b");
    log(0, "a");
    log(2, "c");
    log(3, "stray");

    expect(heard.map((e) => e.seq)).toEqual([1, 0, 2]);
  });

  it("reports the entries the mod dropped", async () => {
    const { pending, counts, result } = await started();

    result(20, 5);
    await pending;

    expect(counts).toEqual([{ logged: 20, dropped: 5 }]);
  });

  it("ignores an entry from another run", async () => {
    const { transport, heard, pending, result } = await started();

    transport.emit("kos.log.7", {
      coreId: 7,
      requestId: "someone-else",
      seq: 0,
      value: 9,
    } satisfies KosLogEntry);
    result(0);
    await pending;

    expect(heard).toEqual([]);
  });

  it("stops listening when an announced entry never arrives", async () => {
    const { pending, heard, log, result } = await started();
    vi.useFakeTimers();

    result(3);
    await pending;
    log(0, "a");
    vi.advanceTimersByTime(LOG_GRACE_MS + 1);
    log(1, "too late");

    expect(heard.map((e) => e.seq)).toEqual([0]);
  });

  it("does not time out when every announced entry arrived", async () => {
    const { pending, heard, log, result } = await started();

    result(1);
    await pending;
    log(0, "a");

    expect(heard).toHaveLength(1);
  });
});
