import { type Reading, value } from "@ksp-gonogo/sitrep-sdk";
import { describe, expect, it } from "vitest";
import { spaceWeatherBadges } from "./badge.js";

const HELD: Reading<unknown> = {
  state: "held",
  value: undefined,
  asOfUt: value("ut", 0),
  grade: "disconnected",
  reckoning: { status: "none" },
};

describe("spaceWeatherBadges", () => {
  it("hands the reading to the badge so a held verdict is drawn as held", () => {
    expect(
      spaceWeatherBadges({ stormInProgress: true }, HELD)?.[0]?.held,
    ).toBe(HELD);
    expect(spaceWeatherBadges({}, HELD)).toBeNull();
  });

  it("flags a storm in progress as Storm in progress (nogo)", () => {
    expect(spaceWeatherBadges({ stormInProgress: true })).toEqual([
      {
        id: "space-weather-status",
        label: "Storm in progress",
        tone: "nogo",
      },
    ]);
  });

  it("flags an incoming storm or a radiation belt as Exposed (warn)", () => {
    expect(spaceWeatherBadges({ stormIncoming: true })?.[0]?.label).toBe(
      "Exposed",
    );
    expect(spaceWeatherBadges({ innerBelt: true })?.[0]?.tone).toBe("warn");
    expect(spaceWeatherBadges({ outerBelt: true })?.[0]?.label).toBe("Exposed");
  });

  it("prioritises an in-progress storm over a belt", () => {
    expect(
      spaceWeatherBadges({ stormInProgress: true, innerBelt: true })?.[0]
        ?.label,
    ).toBe("Storm in progress");
  });

  it("shows no badge when sheltered or when there is no data", () => {
    expect(spaceWeatherBadges({ magnetosphere: true })).toBeNull();
    expect(spaceWeatherBadges(undefined)).toBeNull();
    expect(spaceWeatherBadges(null)).toBeNull();
  });
});
