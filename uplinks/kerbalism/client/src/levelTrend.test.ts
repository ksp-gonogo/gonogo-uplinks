import { describe, expect, it } from "vitest";
import { LevelHistory, reconcileCrossing } from "./levelTrend.js";

const CAPACITY = 55;

function recorded(levels: readonly number[], stepSeconds = 10): LevelHistory {
  const history = new LevelHistory();
  levels.forEach((amount, i) => {
    history.record(1000 + i * stepSeconds, { ElectricCharge: amount });
  });
  return history;
}

describe("LevelHistory.trend", () => {
  it("reads a steadily falling level as falling", () => {
    const trend = recorded([52.2, 51.4, 50.6, 49.8, 49.0, 48.2]).trend(
      "ElectricCharge",
      CAPACITY,
    );
    expect(trend.kind).toBe("falling");
    if (trend.kind === "falling") expect(trend.perSecond).toBeCloseTo(-0.08, 3);
  });

  it("reads a steadily rising level as rising", () => {
    const trend = recorded([40, 40.8, 41.6, 42.4, 43.2, 44]).trend(
      "ElectricCharge",
      CAPACITY,
    );
    expect(trend.kind).toBe("rising");
  });

  it("reads a level that does not move as steady", () => {
    const trend = recorded([50, 50, 50, 50, 50, 50]).trend(
      "ElectricCharge",
      CAPACITY,
    );
    expect(trend.kind).toBe("steady");
  });

  it("reads a level jittering around a constant as steady", () => {
    const trend = recorded([50.03, 49.97, 50.05, 49.95, 50.02, 49.98]).trend(
      "ElectricCharge",
      CAPACITY,
    );
    expect(trend.kind).toBe("steady");
  });

  it("keeps the direction of a fall through one sample that jumps up", () => {
    const trend = recorded([52.2, 51.4, 50.6, 51.2, 49.0, 48.2, 47.4]).trend(
      "ElectricCharge",
      CAPACITY,
    );
    expect(trend.kind).toBe("falling");
  });

  it("is unknown with too few samples or too short a span", () => {
    expect(recorded([52, 51]).trend("ElectricCharge", CAPACITY).kind).toBe(
      "unknown",
    );
    expect(
      recorded([52, 51.9, 51.8, 51.7], 1).trend("ElectricCharge", CAPACITY)
        .kind,
    ).toBe("unknown");
    expect(new LevelHistory().trend("ElectricCharge", CAPACITY).kind).toBe(
      "unknown",
    );
  });

  it("ignores a repeated observation and restarts when time goes backwards", () => {
    const history = recorded([52, 51, 50, 49]);
    history.record(1030, { ElectricCharge: 10 });
    expect(history.trend("ElectricCharge", CAPACITY).kind).toBe("falling");
    history.record(500, { ElectricCharge: 20 });
    expect(history.trend("ElectricCharge", CAPACITY).kind).toBe("unknown");
  });
});

describe("reconcileCrossing", () => {
  const level = { current: 47.4, capacity: CAPACITY, ut: 1050 };
  const falling = recorded([52.2, 51.4, 50.6, 49.8, 49.0, 48.2]).trend(
    "ElectricCharge",
    CAPACITY,
  );
  const rising = recorded([40, 40.8, 41.6, 42.4, 43.2, 44]).trend(
    "ElectricCharge",
    CAPACITY,
  );
  const steady = recorded([50, 50, 50, 50, 50, 50]).trend(
    "ElectricCharge",
    CAPACITY,
  );
  const unknown = { kind: "unknown" } as const;

  it("says empty for a falling level even when the model says full", () => {
    const answer = reconcileCrossing(
      { boundary: "ceiling", atUt: 2500 },
      falling,
      level,
    );
    expect(answer?.boundary).toBe("floor");
    expect(answer?.atUt).toBeCloseTo(1050 + 47.4 / 0.08, 3);
  });

  it("says full for a rising level even when the model says empty", () => {
    const answer = reconcileCrossing(
      { boundary: "floor", atUt: 2500 },
      rising,
      { current: 44, capacity: CAPACITY, ut: 1050 },
    );
    expect(answer?.boundary).toBe("ceiling");
  });

  it("keeps the model's crossing where the levels agree with it", () => {
    const crossing = { boundary: "floor", atUt: 1700 } as const;
    expect(reconcileCrossing(crossing, falling, level)).toBe(crossing);
  });

  it("gives a falling level a crossing when the model had none", () => {
    expect(reconcileCrossing(null, falling, level)?.boundary).toBe("floor");
  });

  it("shows neither for a steady level the model says is moving", () => {
    expect(
      reconcileCrossing({ boundary: "ceiling", atUt: 1200 }, steady, {
        current: 50,
        capacity: CAPACITY,
        ut: 1050,
      }),
    ).toBeNull();
  });

  it("keeps a drain too slow to see in the window", () => {
    const crossing = { boundary: "floor", atUt: 1050 + 50 / 1e-5 } as const;
    expect(
      reconcileCrossing(crossing, steady, {
        current: 50,
        capacity: CAPACITY,
        ut: 1050,
      }),
    ).toBe(crossing);
  });

  it("shows nothing for a steady level with no model crossing", () => {
    expect(reconcileCrossing(null, steady, level)).toBeNull();
  });

  it("leaves the model's answer alone while the history is too short", () => {
    const crossing = { boundary: "ceiling", atUt: 2500 } as const;
    expect(reconcileCrossing(crossing, unknown, level)).toBe(crossing);
    expect(reconcileCrossing(null, unknown, level)).toBeNull();
  });
});
