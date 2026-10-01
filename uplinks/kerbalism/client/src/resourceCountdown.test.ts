import type { TopicPayload } from "@ksp-gonogo/sitrep-sdk";
import { value } from "@ksp-gonogo/sitrep-sdk";
import { describe, expect, it } from "vitest";
import type { KerbalismLifeSupport } from "./__generated__/contract.js";
import { resourceBoundaryCrossings } from "./resourceReckoning.js";

/**
 * The Ship Systems row time is the resource model's boundary crossing less the
 * view time, and there is no second countdown beside it. These pin the source:
 * what the crossing is, that its absence stays absence, and that a row carries
 * it unchanged.
 */

const AMOUNTS: TopicPayload<"vessel.resources"> = {
  resources: {
    Food: {
      current: value("units", 100),
      max: value("units", 400),
      active: true,
    },
    Water: {
      current: value("units", 100),
      max: value("units", 400),
      active: true,
    },
  },
  meta: { source: "test" },
};

/** Food draining at 0.1/s, Water filling at 0.5/s, accumulators last advanced at UT 1000. */
const LIFE_SUPPORT = {
  asOfKerbalismUt: value("ut", 1000),
  rates: { Food: value("units/s", -0.1), Water: value("units/s", 0.5) },
} satisfies KerbalismLifeSupport;

describe("the countdown source", () => {
  it("is the model's floor crossing, anchored to Kerbalism's stamp", () => {
    const food = resourceBoundaryCrossings(AMOUNTS, LIFE_SUPPORT).find(
      (c) => c.resource === "Food",
    );

    expect(food?.boundary).toBe("floor");
    // 100 units at 0.1/s is 1000 s past the stamp; a view at UT 1600 has 400 s.
    expect(food?.atUt.magnitude).toBeCloseTo(2000);
    expect((food?.atUt.magnitude ?? Number.NaN) - 1600).toBeCloseTo(400);
  });

  it("names the ceiling for a level that is filling", () => {
    const water = resourceBoundaryCrossings(AMOUNTS, LIFE_SUPPORT).find(
      (c) => c.resource === "Water",
    );

    expect(water?.boundary).toBe("ceiling");
    expect(water?.atUt.magnitude).toBeCloseTo(1000 + 300 / 0.5);
  });

  it("gives no crossing for a missing rate or a missing anchor, never zero", () => {
    expect(
      resourceBoundaryCrossings(AMOUNTS, { asOfKerbalismUt: value("ut", 1000) }),
    ).toEqual([]);
    expect(
      resourceBoundaryCrossings(AMOUNTS, {
        rates: { Food: value("units/s", -0.1) },
      }),
    ).toEqual([]);
  });
});
