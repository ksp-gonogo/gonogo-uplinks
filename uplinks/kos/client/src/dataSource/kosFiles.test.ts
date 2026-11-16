/**
 * `KosDataSource`'s file methods against a real `TelemetryClient` over a
 * `StubTransport`: what each sends, how it correlates the `kos.run.<coreId>`
 * answer, and what a refusal rejects with.
 */

import {
  createTestTelemetryClient,
  StubTransport,
  setActiveTelemetryClientForTests,
} from "@ksp-gonogo/sitrep-sdk/testing";
import { afterEach, describe, expect, it } from "vitest";
import type { KosProcessorInfo, KosRunResult } from "../__generated__/contract.js";
import { isKosScriptError } from "../shared/KosScriptError.js";
import { KosDataSource } from "./kos.js";

interface Sent {
  command: string;
  args: Record<string, unknown>;
}

async function waitFor(predicate: () => boolean, timeoutMs = 1000): Promise<void> {
  const start = Date.now();
  while (!predicate()) {
    if (Date.now() - start > timeoutMs) {
      throw new Error("waitFor: predicate never became true");
    }
    await new Promise((r) => setTimeout(r, 1));
  }
}

function setup(reply: (command: string) => unknown = () => ({ success: true })) {
  const transport = new StubTransport();
  const client = createTestTelemetryClient(transport);
  const sent: Sent[] = [];
  transport.setCommandHandler((command, args) => {
    sent.push({ command, args: args as Record<string, unknown> });
    return reply(command);
  });
  setActiveTelemetryClientForTests(client);
  const source = new KosDataSource({ callTimeoutMs: 500, cpuWaitMs: 200 });
  source.attachTelemetryClient(client);
  transport.emit("kos.processors", [
    { coreId: 4, tag: "cpu-a", hasBooted: true, processorMode: "READY" },
  ] satisfies KosProcessorInfo[]);

  const answer = (
    index: number,
    fields: KosRunResult["fields"],
    error: string | null = null,
  ): void => {
    transport.emit("kos.run.4", {
      coreId: 4,
      requestId: sent[index].args.requestId as string,
      fields,
      error,
      ended: false,
    } satisfies KosRunResult);
  };
  return { source, sent, answer, transport };
}

describe("KosDataSource file commands", () => {
  afterEach(() => {
    setActiveTelemetryClientForTests(undefined);
  });

  it("readFile sends kos.files.read and resolves with the text and its hash", async () => {
    const { source, sent, answer } = setup();

    const pending = source.readFile("cpu-a", "0:", "lib/launch.ks");
    await waitFor(() => sent.length === 1);

    expect(sent[0].command).toBe("kos.files.read");
    expect(sent[0].args).toMatchObject({ coreId: 4, volume: "0:", path: "lib/launch.ks" });

    answer(0, {
      op: "read",
      volume: "0:",
      path: "lib/launch.ks",
      text: "print 1.\n",
      hash: "abc",
      size: 9,
    });
    await expect(pending).resolves.toEqual({
      volume: "0:",
      path: "lib/launch.ks",
      text: "print 1.\n",
      hash: "abc",
      size: 9,
    });
  });

  it("writeFile sends the text and the hash it last read", async () => {
    const { source, sent, answer } = setup();

    const pending = source.writeFile("cpu-a", "1:", "a.ks", "print 2.", "abc");
    await waitFor(() => sent.length === 1);

    expect(sent[0].command).toBe("kos.files.write");
    expect(sent[0].args).toMatchObject({
      coreId: 4,
      volume: "1:",
      path: "a.ks",
      text: "print 2.",
      expectedHash: "abc",
    });

    answer(0, { op: "write", volume: "1:", path: "a.ks", hash: "def", size: 8 });
    await expect(pending).resolves.toEqual({ volume: "1:", path: "a.ks", hash: "def", size: 8 });
  });

  it("writeFile for a new file sends no hash", async () => {
    const { source, sent } = setup();

    source.writeFile("cpu-a", "1:", "new.ks", "x", null).catch(() => {});
    await waitFor(() => sent.length === 1);

    expect(sent[0].args.expectedHash).toBeUndefined();
  });

  it("deleteFile and renameFile send the hash and resolve with what moved", async () => {
    const { source, sent, answer } = setup();

    const deleted = source.deleteFile("cpu-a", "0:", "old.ks", "h1");
    await waitFor(() => sent.length === 1);
    expect(sent[0].command).toBe("kos.files.delete");
    expect(sent[0].args).toMatchObject({ volume: "0:", path: "old.ks", expectedHash: "h1" });
    answer(0, { op: "delete", volume: "0:", path: "old.ks" });
    await expect(deleted).resolves.toEqual({ volume: "0:", path: "old.ks" });

    const renamed = source.renameFile("cpu-a", "0:", "a.ks", "lib/b.ks", "h2");
    await waitFor(() => sent.length === 2);
    expect(sent[1].command).toBe("kos.files.rename");
    expect(sent[1].args).toMatchObject({
      volume: "0:",
      path: "a.ks",
      newPath: "lib/b.ks",
      expectedHash: "h2",
    });
    answer(1, { op: "rename", volume: "0:", path: "a.ks", newPath: "lib/b.ks", hash: "h2" });
    await expect(renamed).resolves.toEqual({
      volume: "0:",
      path: "a.ks",
      newPath: "lib/b.ks",
      hash: "h2",
    });
  });

  it("a refusal rejects with the reason and detail the mod gave", async () => {
    const { source } = setup(() => ({
      success: false,
      errorCode: "wrongState",
      reason: "kos.fileChanged",
      detail: "read the file again before saving over it",
    }));

    const error = (await source
      .writeFile("cpu-a", "0:", "a.ks", "x", "stale")
      .catch((e: unknown) => e)) as Error & {
      errorCode?: string;
      reason?: string;
      detail?: string;
    };

    expect(error.errorCode).toBe("wrongState");
    expect(error.reason).toBe("kos.fileChanged");
    expect(error.detail).toBe("read the file again before saving over it");
  });

  it("an error the mod answers with is a plain error, never a script fault", async () => {
    const { source, sent, answer } = setup();

    const pending = source.readFile("cpu-a", "1:", "lib/a.ks");
    await waitFor(() => sent.length === 1);
    answer(0, null, "could not use 1:lib/a.ks: Directory does not exist");

    const error = await pending.catch((e: unknown) => e);
    expect(error).toBeInstanceOf(Error);
    expect(isKosScriptError(error)).toBe(false);
    expect((error as Error).message).toBe(
      "kos.files.read: could not use 1:lib/a.ks: Directory does not exist",
    );
  });

  it("an answer missing a field it needs rejects instead of resolving half a file", async () => {
    const { source, sent, answer } = setup();

    const pending = source.readFile("cpu-a", "0:", "a.ks");
    await waitFor(() => sent.length === 1);
    answer(0, { op: "read", volume: "0:", path: "a.ks", text: "x", size: 1 });

    await expect(pending).rejects.toThrow(
      'kos.files.read: the CPU\'s answer has no string "hash", so it could not be read',
    );
  });

  it("an answer for another request settles nothing", async () => {
    const { source, sent, answer, transport } = setup();

    const pending = source.readFile("cpu-a", "0:", "a.ks");
    await waitFor(() => sent.length === 1);
    transport.emit("kos.run.4", {
      coreId: 4,
      requestId: "someone-else",
      fields: { op: "read", volume: "0:", path: "a.ks", text: "theirs", hash: "z", size: 6 },
      error: null,
      ended: false,
    } satisfies KosRunResult);
    answer(0, { op: "read", volume: "0:", path: "a.ks", text: "mine", hash: "y", size: 4 });

    await expect(pending).resolves.toMatchObject({ text: "mine" });
  });

  it("a file command waits behind a run already on the same CPU", async () => {
    const { source, sent, answer } = setup();

    const run = source.executeScript("cpu-a", "0:/x.ks", []);
    const read = source.readFile("cpu-a", "0:", "a.ks");
    await waitFor(() => sent.length === 1);
    await new Promise((r) => setTimeout(r, 5));
    expect(sent).toHaveLength(1);

    answer(0, {});
    await run;
    await waitFor(() => sent.length === 2);
    expect(sent[1].command).toBe("kos.files.read");
    answer(1, { op: "read", volume: "0:", path: "a.ks", text: "", hash: "e", size: 0 });
    await expect(read).resolves.toMatchObject({ size: 0 });
  });

  it("a cancelled file command names itself", async () => {
    const { source } = setup();
    const abort = new AbortController();
    abort.abort();

    await expect(source.readFile("cpu-a", "0:", "a.ks", abort.signal)).rejects.toThrow(
      "kos.files.read: cancelled",
    );
  });

  it("rejects with no stream mounted", async () => {
    const source = new KosDataSource();

    await expect(source.deleteFile("cpu-a", "0:", "a.ks", "h")).rejects.toThrow(
      /kOS Uplink not connected: no telemetry stream is mounted, so kos.files.delete/,
    );
  });
});
