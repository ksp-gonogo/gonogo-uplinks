import { act, renderHook } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { STALLED_AFTER_MS, useFeedSignal } from "./useFeedSignal.js";

function feedWith(signal: string | null) {
  const root = document.createElement("div");
  const stage = document.createElement("div");
  if (signal !== null) stage.setAttribute("data-kc-signal", signal);
  root.append(stage);
  return { root, stage };
}

async function flush() {
  await act(async () => {
    await Promise.resolve();
  });
}

describe("useFeedSignal", () => {
  beforeEach(() => vi.useFakeTimers());
  afterEach(() => vi.useRealTimers());

  it("is null with no feed, no attribute or a live feed", async () => {
    expect(renderHook(() => useFeedSignal(null)).result.current).toBeNull();
    const bare = feedWith(null);
    expect(
      renderHook(() => useFeedSignal(bare.root)).result.current,
    ).toBeNull();
    const live = feedWith("live");
    expect(
      renderHook(() => useFeedSignal(live.root)).result.current,
    ).toBeNull();
  });

  it("reports a feed with no source at once", async () => {
    const { root } = feedWith("none");
    const { result } = renderHook(() => useFeedSignal(root));
    await flush();
    expect(result.current).toBe("none");
  });

  it("reports a stall only once it has lasted past the delay", async () => {
    const { root, stage } = feedWith("live");
    const { result } = renderHook(() => useFeedSignal(root));
    stage.setAttribute("data-kc-signal", "stalled");
    await flush();
    expect(result.current).toBeNull();
    await act(async () => {
      vi.advanceTimersByTime(STALLED_AFTER_MS - 1);
    });
    expect(result.current).toBeNull();
    await act(async () => {
      vi.advanceTimersByTime(1);
    });
    expect(result.current).toBe("stalled");
  });

  it("never reports a stall that clears before the delay, and clears one that ends", async () => {
    const { root, stage } = feedWith("live");
    const { result } = renderHook(() => useFeedSignal(root));
    stage.setAttribute("data-kc-signal", "stalled");
    await flush();
    await act(async () => {
      vi.advanceTimersByTime(STALLED_AFTER_MS - 500);
    });
    stage.setAttribute("data-kc-signal", "live");
    await flush();
    await act(async () => {
      vi.advanceTimersByTime(STALLED_AFTER_MS);
    });
    expect(result.current).toBeNull();

    stage.setAttribute("data-kc-signal", "stalled");
    await flush();
    await act(async () => {
      vi.advanceTimersByTime(STALLED_AFTER_MS);
    });
    expect(result.current).toBe("stalled");
    stage.setAttribute("data-kc-signal", "live");
    await flush();
    expect(result.current).toBeNull();
  });
});
