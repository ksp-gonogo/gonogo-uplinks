import { registerUplinkHandle } from "@ksp-gonogo/sitrep-sdk";
import { act, renderHook } from "@ksp-gonogo/sitrep-sdk/testing";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { STALL_AFTER_MS, STALL_SAMPLE_MS, useFeedStallWatch } from "./useFeedStallWatch.js";

const { info, warn, tag } = vi.hoisted(() => {
  const info = vi.fn();
  const warn = vi.fn();
  return { info, warn, tag: vi.fn(() => ({ info, warn })) };
});

vi.mock("@ksp-gonogo/sitrep-sdk", async (original) => ({
  ...(await original<typeof import("@ksp-gonogo/sitrep-sdk")>()),
  logger: { tag },
}));

let frames = 0;

/* A client whose one camera, 7, has received `frames` frames so far. Each call is a fresh client, so no stats read is shared between tests. */
function clientReceiving() {
  const client = {
    inboundVideoStats: async () =>
      new Map([[7, { packetsReceived: frames * 10, bytesReceived: 0, framesReceived: frames, framesDecoded: frames, jitter: 0, framesPerSecond: 0 }]]),
  };
  registerUplinkHandle("kerbcast", { getClient: () => client } as never);
}

function wrapWithVideo() {
  const wrap = document.createElement("div");
  const video = document.createElement("video");
  Object.defineProperty(video, "srcObject", { value: {}, configurable: true });
  wrap.append(video);
  return wrap;
}

async function tick(ms: number, receiving: boolean) {
  for (let t = 0; t < ms; t += STALL_SAMPLE_MS) {
    if (receiving) frames += 28;
    await act(async () => {
      await vi.advanceTimersByTimeAsync(STALL_SAMPLE_MS);
    });
  }
}

beforeEach(() => {
  vi.useFakeTimers();
  frames = 100;
  clientReceiving();
});

afterEach(() => {
  vi.useRealTimers();
  info.mockClear();
  warn.mockClear();
});

describe("useFeedStallWatch", () => {
  it("says nothing while frames keep arriving", async () => {
    renderHook(() => useFeedStallWatch(7, wrapWithVideo(), "delayed"));
    await tick(STALL_AFTER_MS * 2, true);
    expect(warn).not.toHaveBeenCalled();
  });

  it("logs a stall once frames stop for the stall time, with the receive counters and the video's state, and the resume", async () => {
    renderHook(() => useFeedStallWatch(7, wrapWithVideo(), "delayed"));
    await tick(2000, true);
    await tick(STALL_AFTER_MS + STALL_SAMPLE_MS, false);
    expect(tag).toHaveBeenCalledWith("kerbcast:feed-stall");
    expect(warn).toHaveBeenCalledTimes(1);
    expect(warn).toHaveBeenCalledWith(
      expect.stringContaining("feed stalled: no frames received"),
      expect.objectContaining({
        flightId: 7,
        playout: "delayed",
        framesReceived: frames,
        framesDecoded: frames,
        packetsReceived: frames * 10,
        hasSrcObject: true,
        quietSeconds: expect.any(Number),
      }),
    );
    await tick(STALL_AFTER_MS, false);
    expect(warn).toHaveBeenCalledTimes(1);
    await tick(STALL_SAMPLE_MS, true);
    expect(info).toHaveBeenCalledWith(
      "feed resumed",
      expect.objectContaining({ flightId: 7, stalledSeconds: expect.any(Number) }),
    );
  });

  it("does not call a short gap a stall", async () => {
    renderHook(() => useFeedStallWatch(7, wrapWithVideo(), "delayed"));
    await tick(2000, true);
    await tick(STALL_AFTER_MS - STALL_SAMPLE_MS, false);
    await tick(2000, true);
    expect(warn).not.toHaveBeenCalled();
  });
});
