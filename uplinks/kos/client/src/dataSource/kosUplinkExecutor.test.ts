import type { TelemetryClient } from "@ksp-gonogo/sitrep-sdk";
import {
  createTestTelemetryClient,
  StubTransport,
} from "@ksp-gonogo/sitrep-sdk/testing";
import { afterEach, describe, expect, it, vi } from "vitest";
import type { GeneratedCommandArgsMap } from "../__generated__/command-map.js";
import type { KosProcessorInfo, KosRunResult } from "../__generated__/contract.js";
import { isKosScriptError } from "../shared/KosScriptError.js";
import { recordDispatch, sentCommands } from "../test/recordedCommands.js";
import { KosUplinkExecutor } from "./kosUplinkExecutor.js";

/**
 * Unit tests for the `kos.run` Uplink executor that now backs
 * `KosDataSource.executeScript` end to end (see
 * `../__tests__/kos-execute-uplink.test.ts` for that KosDataSource-level
 * wiring). Uses a real `StubTransport` + `TelemetryClient`, no mocked
 * internals: so dispatch, subscribe, and correlation all run through the
 * real client machinery; only the wire is stubbed.
 *
 * `kos.processors` is a plain push channel: nothing delivers it until
 * something subscribes (there is no proactive auto-subscribe). The
 * executor's own `run()` is what subscribes, lazily, on first call, so a
 * cold `run()` against a client that has never seen kos.processors data
 * always rejects with "no known CPU" (this is exactly the "reject
 * immediately" contract `run()` promises). Every test below therefore
 * primes the subscription with a throwaway first call before publishing
 * the CPU list and driving the call under test, the same two-step
 * sequence a real widget hits after a fresh reconnect.
 */

interface DispatchedCommand {
  command: string;
  args: GeneratedCommandArgsMap["kos.run"];
}

function makeClient() {
  const transport = new StubTransport();
  const client = createTestTelemetryClient(transport);
  return { transport, client };
}

/** Records every dispatched command; command handler defaults to a success ack. */
function captureDispatches(transport: StubTransport): DispatchedCommand[] {
  const commands: DispatchedCommand[] = [];
  transport.setCommandHandler((command, args) => {
    recordDispatch<"kos.run">(commands, command, args);
    return { success: true };
  });
  return commands;
}

/**
 * Adopts `client` so `executor` subscribes to its `kos.processors`, then
 * publishes `processors`. After this, any `run()` against a tagname in
 * `processors` resolves its coreId at once.
 */
function primeProcessors(
  executor: KosUplinkExecutor,
  client: TelemetryClient,
  transport: StubTransport,
  processors: KosProcessorInfo[],
): void {
  executor.adopt(client);
  transport.emit("kos.processors", processors);
}

/** Poll a microtask at a time until predicate is true or timeoutMs elapses. */
async function waitFor(
  predicate: () => boolean,
  { timeoutMs = 1000 } = {},
): Promise<void> {
  const start = Date.now();
  while (!predicate()) {
    if (Date.now() - start > timeoutMs) {
      throw new Error("waitFor: predicate never became true");
    }
    await new Promise((r) => setTimeout(r, 1));
  }
}

describe("KosUplinkExecutor", () => {
  afterEach(() => {
    vi.useRealTimers();
  });

  it("resolves tagname -> coreId via kos.processors, then dispatches kos.run with a fresh requestId", async () => {
    const { transport, client } = makeClient();
    const commands = captureDispatches(transport);
    const executor = new KosUplinkExecutor();

    primeProcessors(executor, client, transport, [
      { coreId: 7, tag: "datastream", hasBooted: true, processorMode: "READY" },
    ]);
    const pending = executor.run(client, "datastream", "0:/foo.ks", []);

    await waitFor(() => commands.length === 1);
    expect(commands[0].command).toBe("kos.run");
    expect(commands[0].args.coreId).toBe(7);
    expect(commands[0].args.path).toBe("0:/foo.ks");
    expect(commands[0].args.args).toEqual([]);
    expect(commands[0].args.copyToLocal).toBe(false);
    expect(commands[0].args.requestId).toBeTruthy();

    transport.emit("kos.run.7", {
      coreId: 7,
      requestId: commands[0].args.requestId,
      fields: { v: 1, ok: true },
      ended: false,
      logged: 0,
      dropped: 0,
    } satisfies KosRunResult);

    await expect(pending).resolves.toEqual({ v: 1, ok: true });
  });

  it("still resolves with an empty object for an empty returned lexicon", async () => {
    // `ADDONS:GONOGO:RETURN(LEXICON())` hands back an empty field map, so `{}`
    // ON THE WIRE is a real answer: the script ran and reported nothing.
    // Only an ABSENT map is the absence.
    const { transport, client } = makeClient();
    const commands = captureDispatches(transport);
    const executor = new KosUplinkExecutor();

    primeProcessors(executor, client, transport, [
      { coreId: 4, tag: "cpu-a", hasBooted: true, processorMode: "READY" },
    ]);
    const pending = executor.run(client, "cpu-a", "0:/foo.ks", []);
    await waitFor(() => commands.length === 1);

    transport.emit("kos.run.4", {
      coreId: 4,
      requestId: commands[0].args.requestId,
      fields: {},
      ended: false,
      logged: 0,
      dropped: 0,
    } satisfies KosRunResult);

    await expect(pending).resolves.toEqual({});
  });

  it.each([
    ["null", null],
    ["absent", undefined],
  ])("rejects rather than resolving empty when a non-error result carries a %s field map", async (_label, fields) => {
    // `KosRunResult`'s contract is that exactly one of fields/error is
    // non-null, so neither being set is a frame we cannot read. Resolving
    // it as `{}` claimed the script ran and returned nothing, and
    // KosScriptRunner drew a green OK over "No fields returned." for a
    // run whose result never arrived intact.
    const { transport, client } = makeClient();
    const commands = captureDispatches(transport);
    const executor = new KosUplinkExecutor();

    primeProcessors(executor, client, transport, [
      { coreId: 5, tag: "cpu-a", hasBooted: true, processorMode: "READY" },
    ]);
    const pending = executor.run(client, "cpu-a", "0:/foo.ks", []);
    await waitFor(() => commands.length === 1);

    transport.emit("kos.run.5", {
      coreId: 5,
      requestId: commands[0].args.requestId,
      fields,
    });

    await expect(pending).rejects.toThrow(/neither an error nor a field map/i);
    // A transport/protocol fault, NOT a script-author fault: the widget
    // badge that distinguishes the two must not say "Script error".
    await pending.catch((err: unknown) => {
      expect(isKosScriptError(err)).toBe(false);
    });
  });

  it("rejects immediately with a clear error when the tagname doesn't resolve to a known coreId", async () => {
    const { client } = makeClient();
    const executor = new KosUplinkExecutor({ cpuWaitMs: 0 });

    await expect(
      executor.run(client, "no-such-cpu", "0:/foo.ks", []),
    ).rejects.toThrow(/no known CPU with tagname "no-such-cpu"/);
  });

  it("serialises calls to the SAME coreId: the second call doesn't dispatch until the first resolves", async () => {
    const { transport, client } = makeClient();
    const commands = captureDispatches(transport);
    const executor = new KosUplinkExecutor();

    primeProcessors(executor, client, transport, [
      { coreId: 1, tag: "cpu-a", hasBooted: true, processorMode: "READY" },
    ]);
    const first = executor.run(client, "cpu-a", "0:/a.ks", []);
    await waitFor(() => commands.length === 1);

    const second = executor.run(client, "cpu-a", "0:/b.ks", []);
    // Give the second call every chance to (incorrectly) dispatch early.
    await new Promise((r) => setTimeout(r, 20));
    expect(commands).toHaveLength(1);

    transport.emit("kos.run.1", {
      coreId: 1,
      requestId: commands[0].args.requestId,
      fields: { step: 1 },
      ended: false,
      logged: 0,
      dropped: 0,
    } satisfies KosRunResult);
    await first;

    await waitFor(() => commands.length === 2);
    expect(commands[1].args.path).toBe("0:/b.ks");

    transport.emit("kos.run.1", {
      coreId: 1,
      requestId: commands[1].args.requestId,
      fields: { step: 2 },
      ended: false,
      logged: 0,
      dropped: 0,
    } satisfies KosRunResult);
    await second;
  });

  it("runs calls to DIFFERENT coreIds in parallel", async () => {
    const { transport, client } = makeClient();
    const commands = captureDispatches(transport);
    const executor = new KosUplinkExecutor();

    primeProcessors(executor, client, transport, [
      { coreId: 1, tag: "cpu-a", hasBooted: true, processorMode: "READY" },
      { coreId: 2, tag: "cpu-b", hasBooted: true, processorMode: "READY" },
    ]);
    const a = executor.run(client, "cpu-a", "0:/a.ks", []);
    const b = executor.run(client, "cpu-b", "0:/b.ks", []);

    await waitFor(() => commands.length === 2);
    const forA = commands.find((c) => c.args.coreId === 1);
    const forB = commands.find((c) => c.args.coreId === 2);
    expect(forA).toBeDefined();
    expect(forB).toBeDefined();

    transport.emit("kos.run.1", {
      coreId: 1,
      requestId: forA?.args.requestId ?? "",
      fields: {},
      ended: false,
      logged: 0,
      dropped: 0,
    } satisfies KosRunResult);
    transport.emit("kos.run.2", {
      coreId: 2,
      requestId: forB?.args.requestId ?? "",
      fields: {},
      ended: false,
      logged: 0,
      dropped: 0,
    } satisfies KosRunResult);
    await Promise.all([a, b]);
  });

  it("rejects when the mod acks the command as a failure (success: false)", async () => {
    const { transport, client } = makeClient();
    const executor = new KosUplinkExecutor();
    primeProcessors(executor, client, transport, [
      { coreId: 1, tag: "cpu-a", hasBooted: true, processorMode: "READY" },
    ]);
    transport.setCommandHandler(() => ({ success: false, errorCode: "range" }));

    const pending = executor.run(client, "cpu-a", "0:/a.ks", []);

    // The SPINE settles this now: a `CommandResult.success === false` reply
    // rejects the dispatch promise rather than resolving it, so the refusal
    // reaches `settleFailure` through the executor's `.catch` and carries the
    // mod's typed reason. The executor's own `success === false` branch in
    // `.then` is no longer the mechanism under test here.
    await expect(pending).rejects.toThrow(/refused/i);
  });

  it("rejects with a KosScriptError when kos.run.<coreId> carries an error", async () => {
    const { transport, client } = makeClient();
    const commands = captureDispatches(transport);
    const executor = new KosUplinkExecutor();
    primeProcessors(executor, client, transport, [
      { coreId: 1, tag: "cpu-a", hasBooted: true, processorMode: "READY" },
    ]);

    const pending = executor.run(client, "cpu-a", "0:/a.ks", []);
    await waitFor(() => commands.length === 1);

    transport.emit("kos.run.1", {
      coreId: 1,
      requestId: commands[0].args.requestId,
      error: "engine flameout",
      ended: false,
      logged: 0,
      dropped: 0,
    } satisfies KosRunResult);

    let caught: unknown;
    try {
      await pending;
    } catch (err) {
      caught = err;
    }
    expect(isKosScriptError(caught)).toBe(true);
    if (!(caught instanceof Error)) {
      throw new Error(`expected an Error, got: ${String(caught)}`);
    }
    expect(caught.message).toBe("engine flameout");
  });

  it("rejects after timeoutMs when no kos.run.<coreId> result ever arrives", async () => {
    vi.useFakeTimers();
    const { transport, client } = makeClient();
    const executor = new KosUplinkExecutor({ timeoutMs: 1000 });
    primeProcessors(executor, client, transport, [
      { coreId: 1, tag: "cpu-a", hasBooted: true, processorMode: "READY" },
    ]);

    const pending = executor.run(client, "cpu-a", "0:/a.ks", []);

    const assertion = expect(pending).rejects.toThrow(/did not respond/i);
    await vi.advanceTimersByTimeAsync(1000);
    await assertion;
  });

  it("resolves with an empty object when the mod reports the run ended without a block", async () => {
    const { transport, client } = makeClient();
    const commands = captureDispatches(transport);
    const executor = new KosUplinkExecutor();
    primeProcessors(executor, client, transport, [
      { coreId: 6, tag: "cpu-a", hasBooted: true, processorMode: "READY" },
    ]);
    const pending = executor.run(client, "cpu-a", "0:/quiet.ks", []);
    await waitFor(() => commands.length === 1);

    transport.emit("kos.run.6", {
      coreId: 6,
      requestId: commands[0].args.requestId,
      fields: null,
      error: null,
      ended: true,
    });

    await expect(pending).resolves.toEqual({});
  });

  it("sends a kos.cancel for its own run when the run times out", async () => {
    vi.useFakeTimers();
    const { transport, client } = makeClient();
    const sent: { command: string; args: unknown }[] = [];
    transport.setCommandHandler((command, args) => {
      sent.push({ command, args });
      return { success: true };
    });
    const executor = new KosUplinkExecutor({ timeoutMs: 1000 });
    primeProcessors(executor, client, transport, [
      { coreId: 1, tag: "cpu-a", hasBooted: true, processorMode: "READY" },
    ]);

    const pending = executor.run(client, "cpu-a", "0:/a.ks", []);
    const assertion = expect(pending).rejects.toThrow(/did not respond/i);
    await vi.advanceTimersByTimeAsync(1000);
    await assertion;

    const run = sentCommands(sent, "kos.run");
    const cancel = sentCommands(sent, "kos.cancel");
    expect(run).toHaveLength(1);
    expect(cancel).toHaveLength(1);
    expect(cancel[0].args).toEqual({
      coreId: 1,
      requestId: run[0].args.requestId,
    });
  });

  it("sends no kos.cancel for a run that finished", async () => {
    const { transport, client } = makeClient();
    const sent: { command: string; args: unknown }[] = [];
    transport.setCommandHandler((command, args) => {
      sent.push({ command, args });
      return { success: true };
    });
    const executor = new KosUplinkExecutor();
    primeProcessors(executor, client, transport, [
      { coreId: 2, tag: "cpu-a", hasBooted: true, processorMode: "READY" },
    ]);
    const pending = executor.run(client, "cpu-a", "0:/a.ks", []);
    await waitFor(() => sentCommands(sent, "kos.run").length === 1);

    transport.emit("kos.run.2", {
      coreId: 2,
      requestId: sentCommands(sent, "kos.run")[0].args.requestId,
      fields: { v: 1 },
      ended: false,
      logged: 0,
      dropped: 0,
    } satisfies KosRunResult);
    await pending;

    expect(sentCommands(sent, "kos.cancel")).toHaveLength(0);
  });

  it("waits out the round trip of a delayed craft before giving up", async () => {
    vi.useFakeTimers();
    const { transport, client } = makeClient();
    const commands = captureDispatches(transport);
    const executor = new KosUplinkExecutor({ timeoutMs: 30_000 });
    primeProcessors(executor, client, transport, [
      { coreId: 1, tag: "cpu-a", hasBooted: true, processorMode: "READY" },
    ]);
    transport.emit("comms.delay", { oneWaySeconds: 20 });

    const pending = executor.run(client, "cpu-a", "0:/a.ks", []);
    let settled = false;
    pending.then(
      () => {
        settled = true;
      },
      () => {
        settled = true;
      },
    );
    await vi.advanceTimersByTimeAsync(40_000);
    expect(commands).toHaveLength(1);
    expect(settled).toBe(false);

    transport.emit("kos.run.1", {
      coreId: 1,
      requestId: commands[0].args.requestId,
      fields: { ok: true },
      ended: false,
      logged: 0,
      dropped: 0,
    } satisfies KosRunResult);
    await expect(pending).resolves.toEqual({ ok: true });
  });

  it("still gives up once the round trip and the script's allowance have both passed", async () => {
    vi.useFakeTimers();
    const { transport, client } = makeClient();
    const executor = new KosUplinkExecutor({ timeoutMs: 30_000 });
    primeProcessors(executor, client, transport, [
      { coreId: 1, tag: "cpu-a", hasBooted: true, processorMode: "READY" },
    ]);
    transport.emit("comms.delay", { oneWaySeconds: 20 });

    const pending = executor.run(client, "cpu-a", "0:/a.ks", []);
    const assertion = expect(pending).rejects.toThrow(/within 70000ms/);
    await vi.advanceTimersByTimeAsync(70_000);
    await assertion;
  });

  it("a foreign requestId on the channel does not settle an unrelated in-flight call", async () => {
    const { transport, client } = makeClient();
    const commands = captureDispatches(transport);
    const executor = new KosUplinkExecutor();
    primeProcessors(executor, client, transport, [
      { coreId: 1, tag: "cpu-a", hasBooted: true, processorMode: "READY" },
    ]);

    const pending = executor.run(client, "cpu-a", "0:/a.ks", []);
    await waitFor(() => commands.length === 1);

    transport.emit("kos.run.1", {
      coreId: 1,
      requestId: "some-other-requestId",
      fields: { v: 1 },
      ended: false,
      logged: 0,
      dropped: 0,
    } satisfies KosRunResult);

    let settled = false;
    void pending.then(
      () => {
        settled = true;
      },
      () => {
        settled = true;
      },
    );
    await new Promise((r) => setTimeout(r, 10));
    expect(settled).toBe(false);

    // Clean up the still-pending promise so it doesn't leak into other tests.
    transport.emit("kos.run.1", {
      coreId: 1,
      requestId: commands[0].args.requestId,
      fields: {},
      ended: false,
      logged: 0,
      dropped: 0,
    } satisfies KosRunResult);
    await pending;
  });

  it("dispose() rejects every queued/in-flight call and drops subscriptions", async () => {
    const { transport, client } = makeClient();
    const commands = captureDispatches(transport);
    const executor = new KosUplinkExecutor();
    primeProcessors(executor, client, transport, [
      { coreId: 1, tag: "cpu-a", hasBooted: true, processorMode: "READY" },
    ]);

    const first = executor.run(client, "cpu-a", "0:/a.ks", []);
    await waitFor(() => commands.length === 1);
    const second = executor.run(client, "cpu-a", "0:/b.ks", []); // queued behind first

    executor.dispose();

    await expect(first).rejects.toThrow();
    await expect(second).rejects.toThrow();
  });

  it("re-adopting a different TelemetryClient tears down the old subscriptions/queues", async () => {
    const { transport: t1, client: c1 } = makeClient();
    const commands1 = captureDispatches(t1);
    const executor = new KosUplinkExecutor({ cpuWaitMs: 0 });
    primeProcessors(executor, c1, t1, [
      { coreId: 1, tag: "cpu-a", hasBooted: true, processorMode: "READY" },
    ]);

    const stale = executor.run(c1, "cpu-a", "0:/a.ks", []);
    await waitFor(() => commands1.length === 1);
    expect(t1.isSubscribed("kos.processors")).toBe(true);
    expect(t1.isSubscribed("kos.run.1")).toBe(true);

    const { transport: t2, client: c2 } = makeClient();
    const commands2 = captureDispatches(t2);
    // First call against the new client switches adoption, it tears down
    // every c1 subscription/queue (rejecting `held`) AND subscribes to
    // c2's kos.processors, but rejects itself: c2's processors haven't
    // reported "cpu-a" yet.
    await expect(
      executor.run(c2, "cpu-a", "0:/x.ks", []),
    ).rejects.toThrow(/no known CPU/);

    await expect(stale).rejects.toThrow();
    expect(t1.isSubscribed("kos.processors")).toBe(false);
    expect(t1.isSubscribed("kos.run.1")).toBe(false);

    // Now that c2 is adopted and its kos.processors is subscribed, publish
    // the CPU list and retry: this is the realistic case (a caller races
    // the processors channel right after a reconnect, then succeeds).
    t2.emit("kos.processors", [
      { coreId: 9, tag: "cpu-a", hasBooted: true, processorMode: "READY" },
    ] satisfies KosProcessorInfo[]);
    const fresh = executor.run(c2, "cpu-a", "0:/c.ks", []);
    await waitFor(() => commands2.length === 1);
    expect(commands2[0].args.coreId).toBe(9);

    t2.emit("kos.run.9", {
      coreId: 9,
      requestId: commands2[0].args.requestId,
      fields: {},
      ended: false,
      logged: 0,
      dropped: 0,
    } satisfies KosRunResult);
    await fresh;
  });

  it("a cancelled listing stops holding the CPU's queue for the run behind it", async () => {
    const { transport, client } = makeClient();
    const commands = captureDispatches(transport);
    const executor = new KosUplinkExecutor();
    primeProcessors(executor, client, transport, [
      { coreId: 4, tag: "cpu-a", hasBooted: true, processorMode: "READY" },
    ]);

    const abort = new AbortController();
    const listing = executor.listFiles(client, "cpu-a", "0:", abort.signal);
    const listed = expect(listing).rejects.toThrow(/cancelled/);
    const run = executor.run(client, "cpu-a", "0:/x.ks", []);
    await waitFor(() => commands.length === 1);

    abort.abort();
    await listed;
    await waitFor(() => commands.length === 2);

    transport.emit("kos.run.4", {
      coreId: 4,
      requestId: commands[1].args.requestId,
      fields: {},
      ended: false,
      logged: 0,
      dropped: 0,
    } satisfies KosRunResult);
    await run;
  });

  it("a listing cancelled before it was sent is never sent", async () => {
    const { transport, client } = makeClient();
    const commands = captureDispatches(transport);
    const executor = new KosUplinkExecutor();
    primeProcessors(executor, client, transport, [
      { coreId: 4, tag: "cpu-a", hasBooted: true, processorMode: "READY" },
    ]);

    const first = executor.run(client, "cpu-a", "0:/x.ks", []);
    const abort = new AbortController();
    const listing = executor.listFiles(client, "cpu-a", "0:", abort.signal);
    const listed = expect(listing).rejects.toThrow(/cancelled/);
    await waitFor(() => commands.length === 1);

    abort.abort();
    await listed;
    transport.emit("kos.run.4", {
      coreId: 4,
      requestId: commands[0].args.requestId,
      fields: {},
      ended: false,
      logged: 0,
      dropped: 0,
    } satisfies KosRunResult);
    await first;
    await new Promise((r) => setTimeout(r, 5));
    expect(commands).toHaveLength(1);
  });

  it("waits for the first kos.processors snapshot instead of refusing a tag it has not been told yet", async () => {
    const { transport, client } = makeClient();
    const commands = captureDispatches(transport);
    const executor = new KosUplinkExecutor();

    const pending = executor.run(client, "cpu-a", "0:/a.ks", []);
    await new Promise((r) => setTimeout(r, 5));
    expect(commands).toHaveLength(0);

    transport.emit("kos.processors", [
      { coreId: 1, tag: "cpu-a", hasBooted: true, processorMode: "READY" },
    ]);
    await waitFor(() => commands.length === 1);
    expect(commands[0].args.coreId).toBe(1);

    transport.emit("kos.run.1", {
      coreId: 1,
      requestId: commands[0].args.requestId,
      fields: {},
      ended: false,
      logged: 0,
      dropped: 0,
    } satisfies KosRunResult);
    await pending;
  });

  it("refuses a tag no snapshot names once the CPU wait has passed", async () => {
    const { transport, client } = makeClient();
    const executor = new KosUplinkExecutor({ cpuWaitMs: 30 });

    const pending = executor.run(client, "cpu-a", "0:/a.ks", []);
    transport.emit("kos.processors", [
      { coreId: 2, tag: "cpu-b", hasBooted: true, processorMode: "READY" },
    ]);

    await expect(pending).rejects.toThrow(/no known CPU with tagname "cpu-a"/);
  });
});
