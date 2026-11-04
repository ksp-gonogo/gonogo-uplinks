import { GateOutcome, value } from "@ksp-gonogo/sitrep-sdk";
import { describe, expect, it } from "vitest";
import { facilityTiers } from "./facilityTiers.js";

/**
 * What RP-1 hands the host widget's facility grid.
 *
 * The grid is the surface that was empty in flight, because the stock channel
 * reads the live buildings and KSP only puts those in the space centre. RP-1
 * denormalises the level the save persists against its own tier count, so these
 * rows are the same three facts read a way that survives leaving the scene.
 */
describe("facilityTiers", () => {
  it("carries the tier, the ceiling and the price straight through", () => {
    expect(
      facilityTiers([
        {
          facility: "VehicleAssemblyBuilding",
          currentTier: value("count", 1),
          maxTier: value("count", 4),
          upgradeCost: value("funds", 40_000),
          upgradedByRp1: true,
        },
      ]),
    ).toEqual([
      {
        facility: "VehicleAssemblyBuilding",
        currentTier: 1,
        maxTier: 4,
        upgradeCost: 40_000,
      },
    ]);
  });

  /**
   * Tier 0 is where every career starts, and a building that said nothing is a
   * different reading. Only the second is dropped.
   */
  it("keeps a building at tier 0 and drops one that answered no tier", () => {
    expect(
      facilityTiers([
        {
          facility: "Administration",
          currentTier: value("count", 0),
          maxTier: value("count", 8),
        },
        { facility: "Runway", maxTier: value("count", 2) },
        {
          currentTier: value("count", 1),
          maxTier: value("count", 2),
        },
      ]),
    ).toEqual([{ facility: "Administration", currentTier: 0, maxTier: 8 }]);
  });

  /**
   * RP-1 prices five buildings at a single fund under a "cosmetic only" comment
   * and drives their tier from the mean of the ones it does upgrade. The tier is
   * still a reading; the price is for a step nothing will take.
   */
  it("reports a cosmetic building's tier and withholds its price", () => {
    expect(
      facilityTiers([
        {
          facility: "MissionControl",
          currentTier: value("count", 2),
          maxTier: value("count", 8),
          upgradeCost: value("funds", 1),
          upgradedByRp1: false,
        },
      ]),
    ).toEqual([{ facility: "MissionControl", currentTier: 2, maxTier: 8 }]);
  });

  /** No channel, no rows, and never a fabricated one. */
  it("contributes nothing when the channel is silent", () => {
    expect(facilityTiers(undefined)).toEqual([]);
    expect(facilityTiers(null)).toEqual([]);
  });

  /**
   * Every field on `Rp1FacilityEntry` is optional, which is the uncertainty that
   * survives the typing: the capture writes a row per building and fills what
   * reflection could read. None of these may reach the grid, because a building
   * whose tier could not be read is not a building at tier 0.
   */
  it("drops a row whose facility or tier did not read", () => {
    expect(
      facilityTiers([
        {},
        { facility: "LaunchPad" },
        { facility: "Runway", currentTier: value("count", 1) },
        { facility: "Administration", maxTier: value("count", 2) },
        { currentTier: value("count", 1), maxTier: value("count", 2) },
      ]),
    ).toEqual([]);
  });

  /** An unreadable row alongside a sound one loses only itself. */
  it("keeps the rows it can read when a sibling is unreadable", () => {
    expect(
      facilityTiers([
        { facility: "LaunchPad", maxTier: value("count", 2) },
        {
          facility: "Runway",
          currentTier: value("count", 1),
          maxTier: value("count", 3),
        },
      ]),
    ).toEqual([{ facility: "Runway", currentTier: 1, maxTier: 3 }]);
  });

  /**
   * The grid draws its Upgrade control from the price and that control sends the
   * stock command, so a refusal of it must leave no price and no control, while
   * a gate that passes or abstains leaves both. Unknown withholds them too,
   * because the engine refuses a dispatch its gate could not decide.
   */
  describe("when the stock upgrade command is refused", () => {
    const row = {
      facility: "LaunchPad",
      currentTier: value("count", 1),
      maxTier: value("count", 3),
      upgradeCost: value("funds", 112_500),
      upgradedByRp1: true,
    };
    const gate = (outcome: GateOutcome) => ({
      gates: [
        {
          command: "career.facility.upgrade",
          itemSets: [],
          verdict: { outcome, detail: "" },
        },
      ],
      channels: [],
    });

    it.each([GateOutcome.Fail, GateOutcome.Unknown])(
      "withholds the price on %s",
      (outcome) => {
        expect(facilityTiers([row], undefined, gate(outcome))).toEqual([
          { facility: "LaunchPad", currentTier: 1, maxTier: 3 },
        ]);
      },
    );

    it.each([GateOutcome.Pass, GateOutcome.Abstain])(
      "keeps the price on %s",
      (outcome) => {
        expect(facilityTiers([row], undefined, gate(outcome))[0]).toMatchObject(
          { upgradeCost: 112_500 },
        );
      },
    );

    it("keeps the price with no gate report", () => {
      expect(facilityTiers([row], undefined, undefined)[0]).toMatchObject({
        upgradeCost: 112_500,
      });
    });
  });
});
