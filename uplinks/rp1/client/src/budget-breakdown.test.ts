import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { isTopicId, useTelemetry } from "@ksp-gonogo/sitrep-sdk";
import {
  renderHook,
  setupStreamFixture,
  waitFor,
} from "@ksp-gonogo/sitrep-sdk/testing";
import { describe, expect, it } from "vitest";
import { RP1_BUDGET_BREAKDOWN_TOPIC } from "./topics.js";

const HERE = dirname(fileURLToPath(import.meta.url));

type Horizon = "day" | "month" | "year";
type Horizons = Record<Horizon, number>;

/** The wire shape as plain numbers, which is what the fixture file holds. */
interface BreakdownPayload {
  buildings: { facility: string; upkeep: Horizons }[];
  complexes: { lcId: string; upkeep: Horizons }[];
  crew: { name: string; inFlight: boolean; cost: Horizons }[];
  astronautBase: Horizons;
  nautBaseSalary: Horizons;
  astronautOperational: Horizons;
  astronautTraining: Horizons;
  courses: { id: string; students: number; cost: Horizons }[];
  trainingFees: { templateId: string; perStudent: Horizons }[];
  programs: { name: string; funding: Horizons }[];
}

function load<T>(file: string): { topic: string; payload: T } {
  return JSON.parse(
    readFileSync(join(HERE, "__testdata__", file), "utf8"),
  ) as { topic: string; payload: T };
}

const FIXTURE = load<BreakdownPayload>("rp1-budget-breakdown.json");
const BUDGET = load<
  Record<Horizon, { facilities: number; astronauts: number; programBudget: number }>
>("rp1-budget.json");

const HORIZONS: Horizon[] = ["day", "month", "year"];

const sum = (values: number[]) => values.reduce((a, b) => a + b, 0);

describe("rp1.budgetBreakdown", () => {
  it("names the topic the C# Uplink declares, and is a known TopicId", () => {
    const src = readFileSync(
      join(HERE, "..", "..", "mod", "Rp1ScUplink.cs"),
      "utf8",
    );
    expect(src).toContain(
      `BudgetBreakdownTopic = "${RP1_BUDGET_BREAKDOWN_TOPIC}"`,
    );
    expect(isTopicId(RP1_BUDGET_BREAKDOWN_TOPIC)).toBe(true);
    expect(FIXTURE.topic).toBe(RP1_BUDGET_BREAKDOWN_TOPIC);
  });

  it("decodes every line's horizons into funds, signed as RP-1 signs them", async () => {
    const fixture = setupStreamFixture();
    const { result } = renderHook(
      () => {
        const reading = useTelemetry(RP1_BUDGET_BREAKDOWN_TOPIC);
        return reading.state === "observed" ? reading.value : undefined;
      },
      { wrapper: fixture.Provider },
    );

    fixture.emit(RP1_BUDGET_BREAKDOWN_TOPIC, FIXTURE.payload);

    await waitFor(() => {
      expect(result.current?.crew).toBeDefined();
    });

    const breakdown = result.current;
    expect(breakdown?.refreshedAt).toMatchObject({ unit: "ut" });
    expect(breakdown?.buildings?.[0]?.upkeep?.month).toMatchObject({
      magnitude: -12000,
      unit: "funds",
    });
    // A flag decodes to a bare boolean rather than a quantity.
    expect(breakdown?.complexes?.[1]?.operational).toBe(false);
    expect(breakdown?.crew?.[0]?.cost?.day).toMatchObject({ unit: "funds" });
    expect(breakdown?.courses?.[0]?.students).toMatchObject({
      magnitude: 2,
      unit: "count",
    });
    expect(breakdown?.nautBaseSalary?.year).toMatchObject({ unit: "funds" });
    expect(breakdown?.trainingFees?.[2]?.perStudent?.day).toMatchObject({
      unit: "funds",
    });
    // Programs pay in, so their funding survives the decode positive.
    expect(breakdown?.programs?.[0]?.funding?.year).toMatchObject({
      magnitude: 2000000,
      unit: "funds",
    });
  });
});

/**
 * The fixture has to be a breakdown RP-1 could produce for the same career as
 * the rp1.budget fixture, or a drill-down built on the pair would be
 * photographed disagreeing with the row it opens from.
 */
describe("the rp1.budgetBreakdown fixture", () => {
  const { payload } = FIXTURE;

  it.each(HORIZONS)("%s: buildings and complexes make the Facilities row", (h) => {
    expect(
      sum(payload.buildings.map((b) => b.upkeep[h])) +
        sum(payload.complexes.map((c) => c.upkeep[h])),
    ).toBeCloseTo(BUDGET.payload[h].facilities, 2);
  });

  it.each(HORIZONS)(
    "%s: crew make the base and operational rows, courses the training row, and the three make Astronauts",
    (h) => {
      expect(sum(payload.crew.map((k) => k.cost[h]))).toBeCloseTo(
        payload.astronautBase[h] + payload.astronautOperational[h],
        2,
      );
      expect(sum(payload.courses.map((c) => c.cost[h]))).toBeCloseTo(
        payload.astronautTraining[h],
        2,
      );
      expect(
        payload.astronautBase[h] +
          payload.astronautOperational[h] +
          payload.astronautTraining[h],
      ).toBeCloseTo(BUDGET.payload[h].astronauts, 2);
    },
  );

  it.each(HORIZONS)("%s: the Programs make Program Budget", (h) => {
    expect(sum(payload.programs.map((p) => p.funding[h]))).toBeCloseTo(
      BUDGET.payload[h].programBudget,
      2,
    );
  });

  it.each(HORIZONS)("%s: a course costs its students times its template's fee", (h) => {
    for (const course of payload.courses) {
      const fee = payload.trainingFees.find((f) => f.templateId === course.id);
      expect(course.cost[h]).toBeCloseTo(course.students * fee!.perStudent[h], 2);
    }
  });

  it.each(HORIZONS)(
    "%s: the one crew member in flight costs a hire's base pay plus the operational row",
    (h) => {
      // In flight, GetNautCost pays base pay at the complex's tier and the
      // flight rate, and drops proficiency pay.
      const flying = payload.crew.filter((k) => k.inFlight);
      expect(flying).toHaveLength(1);
      expect(flying[0].cost[h]).toBeCloseTo(
        payload.nautBaseSalary[h] + payload.astronautOperational[h],
        2,
      );
    },
  );
});
