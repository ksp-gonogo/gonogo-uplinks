// @vitest-environment jsdom

import { act, renderHook } from "@ksp-gonogo/sitrep-sdk/testing";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { CameraSite } from "./cameraSite.js";
import {
  noteFrameReceived,
  resetUnheardCameras,
  UNHEARD_AFTER_MS,
  useFrameWitness,
  useTrackUnheard,
  useUnheardCameras,
} from "./unheardCameras.js";

const elsewhere = (link: "unknown" | "live" | "silent"): CameraSite => ({
  kind: "elsewhere",
  clock: undefined,
  link,
  delaySeconds: undefined,
});

function track(flightId: number, site: CameraSite) {
  return renderHook(
    ({ site }: { site: CameraSite }) => {
      useTrackUnheard(flightId, site);
      return useUnheardCameras();
    },
    { initialProps: { site } },
  );
}

describe("a camera elsewhere that never delivered a frame", () => {
  beforeEach(() => {
    vi.useFakeTimers();
    resetUnheardCameras();
  });
  afterEach(() => {
    vi.useRealTimers();
  });

  it("leaves the list when its link goes silent", () => {
    const { result, rerender } = track(43, elsewhere("live"));
    expect(result.current.has(43)).toBe(false);
    rerender({ site: elsewhere("silent") });
    expect(result.current.has(43)).toBe(true);
  });

  it("leaves the list when nothing has been heard for the grace period", () => {
    const { result } = track(43, elsewhere("unknown"));
    expect(result.current.has(43)).toBe(false);
    act(() => {
      vi.advanceTimersByTime(UNHEARD_AFTER_MS + 1);
    });
    expect(result.current.has(43)).toBe(true);
  });

  it("stays while its link is live", () => {
    const { result, rerender } = track(43, elsewhere("unknown"));
    rerender({ site: elsewhere("live") });
    act(() => {
      vi.advanceTimersByTime(UNHEARD_AFTER_MS * 2);
    });
    expect(result.current.has(43)).toBe(false);
  });
});

describe("a camera elsewhere that delivered a frame", () => {
  beforeEach(() => {
    vi.useFakeTimers();
    resetUnheardCameras();
  });
  afterEach(() => {
    vi.useRealTimers();
  });

  it("keeps its place when its link goes silent, to show the dark state", () => {
    noteFrameReceived(43);
    const { result, rerender } = track(43, elsewhere("live"));
    rerender({ site: elsewhere("silent") });
    expect(result.current.has(43)).toBe(false);
  });

  it("is not marked by an unheard site either", () => {
    noteFrameReceived(43);
    const { result } = track(43, elsewhere("unknown"));
    act(() => {
      vi.advanceTimersByTime(UNHEARD_AFTER_MS * 2);
    });
    expect(result.current.has(43)).toBe(false);
  });

  it("never marks a camera on the craft being flown", () => {
    const { result } = track(42, { kind: "active" });
    act(() => {
      vi.advanceTimersByTime(UNHEARD_AFTER_MS * 2);
    });
    expect(result.current.has(42)).toBe(false);
  });
});

describe("the frame witness", () => {
  beforeEach(() => {
    resetUnheardCameras();
  });
  afterEach(() => {
    vi.restoreAllMocks();
    Reflect.deleteProperty(HTMLVideoElement.prototype, "requestVideoFrameCallback");
  });

  it("notes a camera as streamed once a decoded frame arrives, and not before", () => {
    let deliver: () => void = () => {};
    Object.defineProperty(HTMLVideoElement.prototype, "requestVideoFrameCallback", {
      configurable: true,
      value: (cb: () => void) => {
        deliver = cb;
        return 1;
      },
    });
    vi.spyOn(HTMLMediaElement.prototype, "play").mockResolvedValue();
    const stream = {} as MediaStream;
    Object.defineProperty(HTMLMediaElement.prototype, "srcObject", {
      configurable: true,
      writable: true,
      value: null,
    });

    const { result } = renderHook(() => {
      useFrameWitness(43, stream);
      useTrackUnheard(43, elsewhere("silent"));
      return useUnheardCameras();
    });
    // No frame yet: a silent camera that never streamed leaves the list.
    expect(result.current.has(43)).toBe(true);

    act(() => {
      deliver();
    });
    // A frame arrived: the mark clears, the camera keeps its place.
    expect(result.current.has(43)).toBe(false);
  });
});
