import type { FrameStamp, FrameStampFeed } from "@ksp-gonogo/sitrep-sdk/media";
import { act, renderHook } from "@ksp-gonogo/sitrep-sdk/testing";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  AHEAD_HOLD_MS,
  type CaptureClockHealthInput,
  useCaptureClockHealth,
} from "./useCaptureClockHealth.js";

let nowMs = 0;

/* The screen's view clock as the delay sees it: a game present the test moves, and a frame callback the test fires. */
function fakeView(present: number | null) {
  let ut = present;
  const frames = new Set<(viewUt: number) => void>();
  const view = {
    confirmedEdgeUt: () => (ut ?? 0) - 2,
    ...(present === null ? {} : { utNowEstimate: () => ut ?? 0 }),
    onFrame(cb: (viewUt: number) => void) {
      frames.add(cb);
      return () => frames.delete(cb);
    },
  };
  return {
    view,
    setPresent(next: number) {
      ut = next;
    },
    /* Advances wall time by `ms` in frames of 100 ms, the game present with it at 1x. */
    run(ms: number) {
      for (let t = 0; t < ms; t += 100) {
        nowMs += 100;
        if (ut !== null) ut += 0.1;
        act(() => {
          for (const cb of frames) cb(ut ?? 0);
        });
      }
    },
  };
}

function stampFeed() {
  const listeners = new Set<(s: FrameStamp) => void>();
  const feed: FrameStampFeed = {
    subscribe(listener) {
      listeners.add(listener);
      return () => listeners.delete(listener);
    },
  };
  return {
    feed,
    send(ut: number, epoch = 1) {
      act(() => {
        for (const l of listeners) l({ rtpTimestamp: nowMs * 90, ut, epoch });
      });
    },
  };
}

function setup(initial: CaptureClockHealthInput) {
  return renderHook((p: CaptureClockHealthInput) => useCaptureClockHealth(p), {
    initialProps: initial,
  });
}

beforeEach(() => {
  nowMs = 1000;
  vi.spyOn(performance, "now").mockImplementation(() => nowMs);
});

afterEach(() => {
  vi.restoreAllMocks();
});

describe("useCaptureClockHealth", () => {
  it("stops trusting the camera clock when the game steps back, and trusts it again on a stamp from the new timeline", () => {
    const clock = fakeView(549);
    const stamps = stampFeed();
    const { result } = setup({ flightId: 7, view: clock.view, captureUt: 549, epoch: 1, warpRate: 1, frameStamps: stamps.feed });
    stamps.send(549);
    clock.run(500);
    expect(result.current.stale).toBe(false);

    clock.setPresent(419);
    clock.run(100);
    expect(result.current.stale).toBe(true);
    expect(result.current.resets).toBe(1);

    stamps.send(419.2, 2);
    expect(result.current.stale).toBe(false);
    expect(result.current.resets).toBe(2);
  });

  it("keeps distrusting it while the stamps still come from before the revert", () => {
    const clock = fakeView(549);
    const stamps = stampFeed();
    const { result } = setup({ flightId: 7, view: clock.view, captureUt: 549, epoch: 1, warpRate: 1, frameStamps: stamps.feed });
    stamps.send(549);
    clock.run(200);
    clock.setPresent(419);
    clock.run(100);
    expect(result.current.stale).toBe(true);
    stamps.send(550);
    clock.run(1000);
    expect(result.current.stale).toBe(true);
  });

  it("trusts a clock sample from the new timeline when the sidecar sends no stamps", () => {
    const clock = fakeView(549);
    const { result, rerender } = setup({ flightId: 7, view: clock.view, captureUt: 549, epoch: 1, warpRate: 1, frameStamps: undefined });
    clock.run(200);
    clock.setPresent(419);
    clock.run(100);
    expect(result.current.stale).toBe(true);
    rerender({ flightId: 7, view: clock.view, captureUt: 549.5, epoch: 1, warpRate: 1, frameStamps: undefined });
    expect(result.current.stale).toBe(true);
    rerender({ flightId: 7, view: clock.view, captureUt: 419.4, epoch: 3, warpRate: 1, frameStamps: undefined });
    expect(result.current.stale).toBe(false);
  });

  it("stops trusting a clock whose frames stay dated far ahead of the game, but not before the hold", () => {
    const clock = fakeView(1000);
    const stamps = stampFeed();
    const { result } = setup({ flightId: 7, view: clock.view, captureUt: 1130, epoch: 1, warpRate: 1, frameStamps: stamps.feed });
    stamps.send(1130);
    clock.run(AHEAD_HOLD_MS - 600);
    expect(result.current.stale).toBe(false);
    clock.run(1200);
    expect(result.current.stale).toBe(true);
  });

  it("lets a short run of frames dated ahead pass", () => {
    const clock = fakeView(1000);
    const stamps = stampFeed();
    const { result } = setup({ flightId: 7, view: clock.view, captureUt: 1000, epoch: 1, warpRate: 1, frameStamps: stamps.feed });
    stamps.send(1130);
    clock.run(1500);
    stamps.send(1001.5);
    clock.run(AHEAD_HOLD_MS);
    expect(result.current.stale).toBe(false);
    expect(result.current.resets).toBe(0);
  });

  it("ignores the game stepping back by less than a second", () => {
    const clock = fakeView(1000);
    const { result } = setup({ flightId: 7, view: clock.view, captureUt: 1000, epoch: 1, warpRate: 1, frameStamps: undefined });
    clock.run(200);
    clock.setPresent(999.6);
    clock.run(200);
    expect(result.current.stale).toBe(false);
  });

  it("judges nothing on a screen that does not know the game's present", () => {
    const clock = fakeView(null);
    const stamps = stampFeed();
    const { result } = setup({ flightId: 7, view: clock.view, captureUt: 5000, epoch: 1, warpRate: 1, frameStamps: stamps.feed });
    stamps.send(5000);
    clock.run(AHEAD_HOLD_MS + 1000);
    expect(result.current.stale).toBe(false);
  });

  it("reports the clock's sample and stamp ages, its epoch and the stamps since the last report", () => {
    const clock = fakeView(1000);
    const stamps = stampFeed();
    const { result } = setup({ flightId: 7, view: clock.view, captureUt: 1000, epoch: 4, warpRate: 1, frameStamps: stamps.feed });
    stamps.send(1000);
    stamps.send(1000.1);
    clock.run(1500);
    expect(result.current.facts()).toEqual({
      flightId: 7,
      sampleAgeSeconds: 1.5,
      clockEpoch: 4,
      stampsReceived: 2,
      stampAgeSeconds: 1.5,
      clockStale: false,
    });
    expect(result.current.facts().stampsReceived).toBe(0);
  });
});
