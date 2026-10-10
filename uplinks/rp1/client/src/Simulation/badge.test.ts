import type { AnyContribution } from "@ksp-gonogo/sitrep-sdk";
import { getContributionsForSlot, value } from "@ksp-gonogo/sitrep-sdk";
import { badgeFace } from "@ksp-gonogo/ui-kit";
import { describe, expect, it } from "vitest";
import { simulationBadges } from "./badge.js";

describe("simulationBadges", () => {
  it("draws SIMULATION while RP-1 says a simulation is running", () => {
    expect(simulationBadges({ active: true, kind: "Orbit" })).toEqual([
      { id: "rp1-simulation", label: "SIMULATION", tone: "caution" },
    ]);
    expect(simulationBadges({ active: true })).toHaveLength(1);
  });

  it("draws nothing on a real flight", () => {
    expect(simulationBadges({ active: false })).toBeNull();
  });

  /**
   * An absent reading is RP-1 not managing the save. That is not a simulation,
   * and an empty header must stay the normal state.
   */
  it("draws nothing when nothing was read", () => {
    expect(simulationBadges(undefined)).toBeNull();
    expect(simulationBadges(null)).toBeNull();
  });

  it("reads through the kit's badge face as its own words", () => {
    const [entry] = simulationBadges({ active: true }) ?? [];
    expect(badgeFace(entry)).toEqual({
      label: "SIMULATION",
      tone: "caution",
      title: undefined,
    });
  });
});

describe("the SIMULATION header badge contribution", () => {
  const contribution = () => {
    const found = getContributionsForSlot("app.header-badges").find(
      (c: AnyContribution) => c.id === "rp1:rp1-simulation-badge",
    );
    if (!found) throw new Error("rp1-simulation-badge is not registered");
    return found;
  };

  it("contributes to the screen header, gated on RP-1 being present", () => {
    expect(contribution().requires).toBe("rp1");
    expect(contribution().deps).toEqual(["rp1.simulation"]);
  });

  const reading = (payload: unknown) => ({
    state: "observed",
    value: payload,
    atUt: value("ut", 0),
    reckoning: { status: "none" },
  });

  it("computes the badge from rp1.simulation, carrying the reading it came from", () => {
    const active = reading({ active: true });
    expect(
      contribution().compute({ "rp1.simulation": active } as never),
    ).toEqual([
      {
        id: "rp1-simulation",
        label: "SIMULATION",
        tone: "caution",
        held: active,
      },
    ]);
    expect(
      contribution().compute({
        "rp1.simulation": reading({ active: false }),
      } as never),
    ).toBeNull();
  });

  it("draws nothing while the simulation flag has not arrived", () => {
    expect(
      contribution().compute({
        "rp1.simulation": { state: "pending", reckoning: { status: "none" } },
      } as never),
    ).toBeNull();
  });
});
