import { afterEach, describe, expect, it, vi } from "vitest";
import {
  FRAME_DELAY_STATS_KEY,
  frameDelayStatsLogger,
} from "./frameDelayStats.js";

afterEach(() => {
  vi.unstubAllGlobals();
  localStorage.clear();
});

describe("frameDelayStatsLogger", () => {
  it("is off until the storage flag is set", () => {
    expect(frameDelayStatsLogger()).toBeUndefined();

    localStorage.setItem(FRAME_DELAY_STATS_KEY, "0");
    expect(frameDelayStatsLogger()).toBeUndefined();

    localStorage.setItem(FRAME_DELAY_STATS_KEY, "1");
    expect(frameDelayStatsLogger()).toBeTypeOf("function");
  });

  it("stays off when storage cannot be read", () => {
    vi.stubGlobal("localStorage", {
      getItem: () => {
        throw new Error("blocked");
      },
    });

    expect(frameDelayStatsLogger()).toBeUndefined();
  });
});
