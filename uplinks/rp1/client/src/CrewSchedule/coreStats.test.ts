import type { AnyContribution, Reading } from "@ksp-gonogo/sitrep-sdk";
import { getContributionsForSlot, value } from "@ksp-gonogo/sitrep-sdk";
import { describe, expect, it } from "vitest";
import { crewCoreStats, nautSalaryStat } from "./coreStats.js";

/* Real `Value`s, not bare magnitudes: the contract types every count as
   `Value<"count">`, and a fixture that hands over a number typechecks only
   because nothing on the read path minds. */
const PROGRAM = {
  crewRnREnabled: true,
  courses: value("count", 3),
  coursesStarted: value("count", 3),
  crewInTraining: value("count", 4),
};

/** RP-1's breakdown as the mod sends it: signed, so pay going out is negative. */
const BREAKDOWN = {
  nautBaseSalary: {
    day: value("funds", -41.07),
    month: value("funds", -1232.03),
    year: value("funds", -15000),
  },
};

/** The quantity a stat draws, whether it was handed over bare or as a held reading. */
function figureOf(
  stat: { value?: unknown } | null | undefined,
): { magnitude: number; unit: string } | undefined {
  const drawn = stat?.value;
  if (typeof drawn !== "object" || drawn === null) return undefined;
  if ("state" in drawn) {
    return (drawn as { value?: { magnitude: number; unit: string } }).value;
  }
  return drawn as { magnitude: number; unit: string };
}

const HELD_READING: Reading<unknown> = {
  state: "held",
  value: undefined,
  asOfUt: value("ut", 0),
  grade: "disconnected",
  reckoning: { status: "none" },
};

function crewRow(overrides: Record<string, unknown> = {}) {
  return { name: "Wernher Kerman", ...overrides };
}

describe("crewCoreStats", () => {
  it("quotes the crew a mission cannot draw on, and what they are on", () => {
    const [inTraining] = crewCoreStats(PROGRAM, []);

    expect(inTraining?.label).toBe("In Training");
    // A `Value`, not a formatted number: the host widget draws it through its own
    // `Unit` so a contributed figure ladders its unit like every other reading.
    expect(figureOf(inTraining)?.magnitude).toBe(4);
    expect(figureOf(inTraining)?.unit).toBe("count");
    expect(inTraining?.detail).toBe("3 courses");
  });

  /**
   * RP-1 lets a course sit enrolled and unstarted indefinitely, so the two
   * counts differ on a real career and the difference is what says whether the
   * crew on them are becoming available on any schedule at all.
   */
  it("calls out the courses nobody has started", () => {
    const [inTraining] = crewCoreStats(
      {
        ...PROGRAM,
        courses: value("count", 3),
        coursesStarted: value("count", 1),
      },
      [],
    );

    expect(inTraining?.detail).toBe("3 courses · 2 not started");
  });

  it("counts the kerbals whose mission training is running out", () => {
    const stats = crewCoreStats(PROGRAM, [
      crewRow({ nextTrainingExpiryUt: value("ut", 9_000_000) }),
      crewRow({
        name: "Nedcas Kerman",
        nextTrainingExpiryUt: value("ut", 12_000_000),
      }),
      crewRow({ name: "Valentina Kerman" }),
    ]);
    const lapsing = stats.find((s) => s.id === "training-lapsing");

    expect(lapsing?.label).toBe("Training Lapsing");
    expect(figureOf(lapsing)?.magnitude).toBe(2);
    expect(lapsing?.tone).toBe("warn");
  });

  /** A permanent amber zero is an alarm about nothing. */
  it("leaves a lapse count of zero untoned", () => {
    const stats = crewCoreStats(PROGRAM, [crewRow()]);
    const lapsing = stats.find((s) => s.id === "training-lapsing");

    expect(figureOf(lapsing)?.magnitude).toBe(0);
    expect(lapsing?.tone).toBe("neutral");
  });

  /**
   * The setting is HONOURED, not reported: RP-1 stops checking mission training
   * entirely, so a count there is a figure about a mechanic nobody is running.
   * Absent, not zero.
   */
  it("says nothing about lapses on a save with mission training off", () => {
    const stats = crewCoreStats(
      PROGRAM,
      [crewRow({ nextTrainingExpiryUt: value("ut", 9_000_000) })],
      undefined,
      false,
    );

    expect(stats.map((s) => s.id)).not.toContain("training-lapsing");
    // The in-training cell survives: a proficiency runs regardless.
    expect(stats.map((s) => s.id)).toContain("in-training");
  });

  /**
   * An unread roster is not a career with nothing lapsing. An empty crew array
   * IS that career and answers zero; an absent one has no answer to give.
   */
  it("draws no lapse cell at all while the roster is unread", () => {
    const stats = crewCoreStats(PROGRAM, undefined);
    expect(stats.map((s) => s.id)).not.toContain("training-lapsing");
  });

  /** A figure nobody sent is not a zero. */
  it("draws no in-training cell while the count is unread", () => {
    const stats = crewCoreStats({ ...PROGRAM, crewInTraining: undefined }, [
      crewRow(),
    ]);
    expect(stats.map((s) => s.id)).not.toContain("in-training");
  });

  it("draws a figure as held once its channel is", () => {
    const held = crewCoreStats(PROGRAM, [crewRow()], {
      program: HELD_READING,
      crew: HELD_READING,
    });
    for (const id of ["in-training", "training-lapsing"]) {
      const drawn = held.find((s) => s.id === id)?.value;
      expect(drawn).toMatchObject({ state: "held" });
    }
    const live = crewCoreStats(PROGRAM, [crewRow()]);
    expect(live.find((s) => s.id === "training-lapsing")?.value).toMatchObject({
      unit: "count",
    });
  });

  it("reads each channel's currency off its reading", () => {
    const contribution = getContributionsForSlot(
      "astronaut-complex.readouts",
    ).find((c: AnyContribution) => c.id === "rp1:crew-core-stats");
    if (!contribution) throw new Error("crew-core-stats is not registered");
    const reading = (state: "observed" | "held", payload: unknown) =>
      state === "observed"
        ? {
            state,
            value: payload,
            atUt: value("ut", 0),
            reckoning: { status: "none" },
          }
        : {
            state,
            value: payload,
            asOfUt: value("ut", 0),
            grade: "disconnected",
            reckoning: { status: "none" },
          };
    const drawnOf = (state: "observed" | "held") =>
      (
        contribution.compute({
          "rp1.crew": reading(state, [crewRow()]),
          "rp1.crewProgram": reading(state, PROGRAM),
          "rp1.budgetBreakdown": reading(state, BREAKDOWN),
        } as never) as { id: string; value?: object }[]
      ).find((s) => s.id === "training-lapsing")?.value;
    expect(drawnOf("observed")).not.toHaveProperty("state");
    expect(drawnOf("held")).toMatchObject({ state: "held" });
  });

  it("leads the strip with what a hire adds per day", () => {
    const contribution = getContributionsForSlot(
      "astronaut-complex.readouts",
    ).find((c: AnyContribution) => c.id === "rp1:crew-core-stats");
    if (!contribution) throw new Error("crew-core-stats is not registered");
    const observed = (payload: unknown) => ({
      state: "observed",
      value: payload,
      atUt: value("ut", 0),
      reckoning: { status: "none" },
    });
    const stats = contribution.compute({
      "rp1.crew": observed([crewRow()]),
      "rp1.crewProgram": observed(PROGRAM),
      "rp1.budgetBreakdown": observed(BREAKDOWN),
    } as never) as { id: string }[];
    expect(stats.map((s) => s.id)).toEqual([
      "naut-salary",
      "in-training",
      "training-lapsing",
    ]);
  });

  it("registers itself into the Astronaut Complex's core-stat strip", () => {
    const ids = getContributionsForSlot("astronaut-complex.readouts").map(
      (c: AnyContribution) => c.id,
    );
    // Namespaced by the client handle, which is what stops two Uplinks
    // colliding on an id somebody picked independently.
    expect(ids).toContain("rp1:crew-core-stats");
  });
});

describe("nautSalaryStat", () => {
  /**
   * A new hire holds no proficiency, so RP-1's `GetNautCost` bills them the
   * Astronaut Complex's base pay alone: the standing cost pressing Hire adds.
   */
  it("quotes a hire's pay per day as a cost", () => {
    const stat = nautSalaryStat(BREAKDOWN);

    expect(stat?.label).toBe("Salary per Naut");
    expect(figureOf(stat)?.unit).toBe("f/day");
    expect(figureOf(stat)?.magnitude).toBeCloseTo(41.07);
    expect(stat?.detail).toBe("added by each hire");
  });

  /** RP-1 pays every naut something, so an unread figure is not a free hire. */
  it("draws nothing while the breakdown is unread", () => {
    expect(nautSalaryStat(undefined)).toBeNull();
    expect(nautSalaryStat({ nautBaseSalary: null })).toBeNull();
  });

  it("draws the figure as held once its channel is", () => {
    expect(nautSalaryStat(BREAKDOWN, HELD_READING)?.value).toMatchObject({
      state: "held",
    });
  });
});
