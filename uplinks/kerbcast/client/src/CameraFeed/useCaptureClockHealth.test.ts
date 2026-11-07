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

/* The steps the station page's view clock made in one recorded minute: its estimate of the game's present ran ahead and refitted back by more than a second, each second, while the camera's own stamps stayed with the game. Each row is the present before the step, after it, and the UT of the next stamp. */
const RECORDED_REFITS: [number, number, number][] = [
  [68.73036342294495, 67.45874859478933, 67.46],
  [69.80621874041515, 68.50264440672656, 68.5],
  [70.89564685322817, 69.5623669541335, 69.52],
  [72.11680210585125, 70.56340883562977, 70.6],
  [73.18553371863563, 71.63701021268282, 71.64],
  [73.87168275616435, 72.64535674145293, 72.64],
  [74.97091294496698, 73.68413929995016, 73.66],
  [76.03647921042518, 74.74824463618582, 74.74],
  [77.07307037508858, 75.81746322528095, 75.78],
  [78.14082803496115, 76.80551969901983, 76.8],
];

describe("useCaptureClockHealth", () => {
  it("does not flush the delay each second while the view's estimate refits behind a camera that is on time", () => {
    const clock = fakeView(68);
    const stamps = stampFeed();
    const { result } = setup({ flightId: 767722819, view: clock.view, captureUt: 68, epoch: 0, warpRate: 1, frameStamps: stamps.feed });
    for (const [before, after, stampUt] of RECORDED_REFITS) {
      clock.setPresent(before);
      clock.run(1);
      stamps.send(stampUt - 0.04, 0);
      clock.setPresent(after);
      clock.run(1);
      stamps.send(stampUt, 0);
      nowMs += 1000;
    }
    expect(result.current.resets).toBe(0);
    expect(result.current.stale).toBe(false);
  });

  it("still flushes once for a real revert, and not again when the camera catches up", () => {
    const clock = fakeView(549);
    const stamps = stampFeed();
    const { result } = setup({ flightId: 767722819, view: clock.view, captureUt: 549, epoch: 0, warpRate: 1, frameStamps: stamps.feed });
    stamps.send(549, 0);
    clock.run(500);
    clock.setPresent(549 - 124);
    clock.run(100);
    expect(result.current.stale).toBe(true);
    expect(result.current.resets).toBe(1);
    stamps.send(425.2, 1);
    expect(result.current.stale).toBe(false);
    expect(result.current.resets).toBe(1);
  });

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
    expect(result.current.resets).toBe(1);
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
