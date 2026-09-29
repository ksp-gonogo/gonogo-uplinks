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
import { RP1_BUDGET_TOPIC } from "./topics.js";

const HERE = dirname(fileURLToPath(import.meta.url));

/** The wire shape as plain numbers, which is what the fixture file holds. */
interface PeriodRow {
  span: number;
  fundsDelta: number;
  facilities: number;
  integrationTeams: number;
  researchTeams: number;
  astronauts: number;
  subsidy: number;
  net: number;
  rollout: number;
  constructions: number;
  programBudget: number;
  balance: number;
  unlockCredit: number;
}

interface BudgetPayload {
  refreshedAt: number;
  day: PeriodRow;
  month: PeriodRow;
  year: PeriodRow;
  subsidyPerDay: number;
  forecast: { horizon: number; fundsDelta: number }[];
}

const FIXTURE = JSON.parse(
  readFileSync(join(HERE, "__testdata__", "rp1-budget.json"), "utf8"),
) as { topic: string; payload: BudgetPayload };

const DAY = 86400;

describe("rp1.budget", () => {
  it("names the topic the C# Uplink declares, and is a known TopicId", () => {
    const src = readFileSync(
      join(HERE, "..", "..", "mod", "Rp1ScUplink.cs"),
      "utf8",
    );
    expect(src).toContain(`BudgetTopic = "${RP1_BUDGET_TOPIC}"`);
    expect(isTopicId(RP1_BUDGET_TOPIC)).toBe(true);
    expect(FIXTURE.topic).toBe(RP1_BUDGET_TOPIC);
  });

  it("decodes every row, nested column and forecast point into its unit", async () => {
    const fixture = setupStreamFixture();
    const { result } = renderHook(
      () => {
        const reading = useTelemetry(RP1_BUDGET_TOPIC);
        return reading.state === "observed" ? reading.value : undefined;
      },
      { wrapper: fixture.Provider },
    );

    fixture.emit(RP1_BUDGET_TOPIC, FIXTURE.payload);

    await waitFor(() => {
      expect(result.current?.month).toBeDefined();
    });

    const budget = result.current;
    expect(budget?.refreshedAt).toMatchObject({ unit: "ut" });
    expect(budget?.subsidyPerDay).toMatchObject({
      magnitude: 6800,
      unit: "f/day",
    });
    expect(budget?.reputationDecayPerDay).toMatchObject({ unit: "rep/day" });
    expect(budget?.month?.span).toMatchObject({ magnitude: 30 * DAY, unit: "s" });
    // Negative is money going out, and it survives the decode signed.
    expect(budget?.month?.facilities).toMatchObject({
      magnitude: -93000,
      unit: "funds",
    });
    expect(budget?.forecast?.[19]?.horizon).toMatchObject({ unit: "s" });
    expect(budget?.forecast?.[19]?.fundsDelta).toMatchObject({
      unit: "funds",
    });
  });
});

/**
 * The fixture has to be a budget RP-1 could produce, or a screen built on it
 * would be photographed agreeing with arithmetic the game never does.
 */
describe("the rp1.budget fixture", () => {
  const { payload } = FIXTURE;
  const columns: [string, PeriodRow, number][] = [
    ["day", payload.day, 1],
    ["month", payload.month, 30],
    ["year", payload.year, 365.25],
  ];

  it.each(columns)("%s spans RP-1's own horizon", (_, row, days) => {
    expect(row.span).toBe(days * DAY);
  });

  it.each(columns)(
    "%s nets its upkeep against its subsidy, clamped at zero",
    (_, row) => {
      const upkeep =
        row.facilities + row.integrationTeams + row.researchTeams + row.astronauts;
      expect(row.net).toBeCloseTo(Math.min(0, upkeep + row.subsidy), 2);
    },
  );

  it.each(columns)(
    "%s balances net, rollouts, constructions and Programs",
    (_, row) => {
      expect(row.balance).toBeCloseTo(
        row.net + row.rollout + row.constructions + row.programBudget,
        2,
      );
    },
  );

  it("averages a one-day horizon over one sample, so its subsidy is today's", () => {
    expect(payload.day.subsidy).toBe(payload.subsidyPerDay);
  });

  it("forecasts twenty quarter-years to five, through the Year column's net", () => {
    expect(payload.forecast).toHaveLength(20);
    payload.forecast.forEach((point, i) => {
      expect(point.horizon).toBeCloseTo(((i + 1) * 365.25 * DAY) / 4, 3);
    });
    expect(payload.forecast[3].fundsDelta).toBe(payload.year.fundsDelta);
  });
});
