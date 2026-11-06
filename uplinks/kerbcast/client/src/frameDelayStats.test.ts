import { afterEach, describe, expect, it, vi } from "vitest";
import { frameDelayStatsLogger } from "./frameDelayStats.js";

const { info, tag } = vi.hoisted(() => {
  const info = vi.fn();
  return { info, tag: vi.fn(() => ({ info })) };
});

vi.mock("@ksp-gonogo/sitrep-sdk", async (original) => ({
  ...(await original<typeof import("@ksp-gonogo/sitrep-sdk")>()),
  logger: { tag },
}));

afterEach(() => {
  info.mockClear();
  vi.restoreAllMocks();
});

const totals = (over: Partial<Record<string, number>> = {}) => ({
  read: 0,
  presented: 0,
  pacerSkipped: 0,
  pacerCatchUps: 0,
  flushDropped: 0,
  evicted: 0,
  awaitingKeyframeDropped: 0,
  ...over,
});

describe("frameDelayStatsLogger", () => {
  it("logs rates and depth since the last report under the frame-delay tag", () => {
    let now = 1000;
    vi.spyOn(performance, "now").mockImplementation(() => now);

    const report = frameDelayStatsLogger(() => 2.5);
    now = 6000;
    report(totals({ read: 300, presented: 250, evicted: 20 }));
    now = 11000;
    report(totals({ read: 600, presented: 400, evicted: 20 }));

    expect(tag).toHaveBeenCalledWith("kerbcast:frame-delay");
    expect(info).toHaveBeenNthCalledWith(
      1,
      "frame rates",
      expect.objectContaining({
        readPerSec: 60,
        presentedPerSec: 50,
        buffered: 30,
        heldSeconds: 2.5,
        evicted: 20,
      }),
    );
    expect(info).toHaveBeenNthCalledWith(
      2,
      "frame rates",
      expect.objectContaining({
        readPerSec: 60,
        presentedPerSec: 30,
        buffered: 180,
        evicted: 0,
      }),
    );
  });

  it("reports an unknown hold as null", () => {

    frameDelayStatsLogger(() => null)(totals());

    expect(info).toHaveBeenCalledWith(
      "frame rates",
      expect.objectContaining({ heldSeconds: null }),
    );
  });
});
