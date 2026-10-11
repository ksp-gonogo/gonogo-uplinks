import type { TopicPayload } from "@ksp-gonogo/sitrep-sdk";
import { value } from "@ksp-gonogo/sitrep-sdk";
import { describe, expect, it } from "vitest";
import {
  reckonResourceLevels,
  resourceBoundaryCrossings,
} from "./resourceReckoning.js";

type Resources = TopicPayload<"vessel.resources">;
type LifeSupport = TopicPayload<"kerbalism.lifesupport">;
type Profile = TopicPayload<"kerbalism.profile">;

/*
 * A water recycler of capacity 1 turning 0.1 waste water a second into 0.08
 * water a second, and a crew drinking 0.05 a second. The measured net rates
 * are the sums of those, so waste water falls at 0.1 and water gains 0.03.
 */
const PROFILE = {
  name: "Test",
  processes: [
    {
      name: "recycler",
      modifiers: ["_Recycler"],
      inputs: { WasteWater: value("units/s", 0.1) },
      outputs: { Water: value("units/s", 0.08) },
    },
  ],
} as unknown as Profile;

function levels(wasteWater: number, water: number): Resources {
  return {
    resources: {
      WasteWater: {
        current: value("units", wasteWater),
        max: value("units", 100),
        active: true,
      },
      Water: {
        current: value("units", water),
        max: value("units", 100),
        active: true,
      },
    },
    meta: { source: "test" },
  } as unknown as Resources;
}

function lifeSupport(
  overrides: {
    running?: boolean;
    broken?: boolean;
    rates?: Record<string, number>;
  } = {},
): LifeSupport {
  const rates = overrides.rates ?? { WasteWater: -0.1, Water: 0.03 };
  return {
    asOfKerbalismUt: value("ut", 0),
    rates: Object.fromEntries(
      Object.entries(rates).map(([k, v]) => [k, value("units/s", v)]),
    ),
    processes: [
      {
        resource: "_Recycler",
        capacity: value("units", 1),
        running: overrides.running ?? true,
        broken: overrides.broken ?? false,
      },
    ],
  } as unknown as LifeSupport;
}

function waterAt(
  observed: Resources,
  life: LifeSupport,
  profile: Profile | undefined,
  ut: number,
): number {
  const answer = reckonResourceLevels(observed, life, ut, profile);
  if (!("reckon" in answer)) throw new Error("the model declined");
  const water = answer.reckon(ut).resources.Water.current;
  return (water as { magnitude: number }).magnitude;
}

describe("a process that stops when its input runs out", () => {
  it("keeps producing while its input lasts", () => {
    expect(waterAt(levels(50, 10), lifeSupport(), PROFILE, 400)).toBeCloseTo(
      10 + 0.03 * 400,
    );
  });

  it("stops producing at the instant the input is empty, and the crew goes on drinking", () => {
    // Waste water is empty at UT 500, water is 25 then and falls at 0.05 after.
    expect(waterAt(levels(50, 10), lifeSupport(), PROFILE, 700)).toBeCloseTo(
      25 - 0.05 * 200,
    );
  });

  it("names the moment water runs out after the producer stopped", () => {
    expect(
      resourceBoundaryCrossings(levels(50, 10), lifeSupport(), PROFILE).find(
        (crossing) => crossing.resource === "Water",
      ),
    ).toMatchObject({ boundary: "floor", atUt: { magnitude: 1000 } });
  });

  it("never names a moment for a level that stops changing when the producer stops", () => {
    const balanced = lifeSupport({ rates: { WasteWater: -0.1, Water: 0.08 } });
    expect(
      resourceBoundaryCrossings(levels(50, 10), balanced, PROFILE).map(
        (crossing) => crossing.resource,
      ),
    ).toEqual(["WasteWater"]);
  });

  it("does not stop a process whose input was already empty when measured", () => {
    // The measured water rate already shows the stalled recycler.
    expect(
      waterAt(
        levels(0, 10),
        lifeSupport({ rates: { Water: 0.03 } }),
        PROFILE,
        100,
      ),
    ).toBeCloseTo(10 + 0.03 * 100);
  });

  it("leaves a stopped, broken or unprofiled process out of it", () => {
    for (const life of [
      lifeSupport({ running: false }),
      lifeSupport({ broken: true }),
    ]) {
      expect(waterAt(levels(50, 10), life, PROFILE, 700)).toBeCloseTo(
        10 + 0.03 * 700,
      );
    }
    expect(waterAt(levels(50, 10), lifeSupport(), undefined, 700)).toBeCloseTo(
      10 + 0.03 * 700,
    );
  });

  it("carries the stop on to a second process fed by what the first one made", () => {
    const profile = {
      name: "Test",
      processes: [
        PROFILE.processes?.[0],
        {
          name: "electrolyser",
          modifiers: ["_Electrolyser"],
          inputs: { Water: value("units/s", 0.2) },
          outputs: { Oxygen: value("units/s", 0.1) },
        },
      ],
    } as unknown as Profile;
    const observed = levels(50, 10);
    observed.resources.Oxygen = {
      current: value("units", 0),
      max: value("units", 100),
      active: true,
    } as never;
    const life = lifeSupport({
      rates: { WasteWater: -0.1, Water: -0.12, Oxygen: 0.1 },
    });
    (life.processes as unknown[]).push({
      resource: "_Electrolyser",
      capacity: value("units", 1),
      running: true,
      broken: false,
    });
    // Water falls at 0.12, so it is empty at 10 / 0.12 and the electrolyser stops there.
    const crossings = resourceBoundaryCrossings(observed, life, profile);
    expect(
      crossings.find((c) => c.resource === "Water")?.atUt.magnitude,
    ).toBeCloseTo(10 / 0.12);
  });
});
