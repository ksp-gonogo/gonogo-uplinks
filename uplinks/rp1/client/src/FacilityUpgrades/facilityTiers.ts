import {
  type CommandGateReport,
  GateOutcome,
  magnitudeOf,
  type Reading,
} from "@ksp-gonogo/sitrep-sdk";
import type { Rp1FacilityEntry } from "../__generated__/contract.js";
import { lastValue } from "../lastValue.js";
import { RP1 } from "../uplink.js";

/**
 * RP-1's tiers, into the host widget's own facility grid.
 *
 * <para><b>The grid above this Uplink's section used to be empty in flight, and
 * this is why.</b> `career.status.facilities` is read off the live
 * `UpgradeableFacility` objects, which KSP instantiates in the SPACECENTER scene
 * only, so away from the space centre every tier and price on it is absent. That
 * is not a gap the host widget could close for itself: stock's off-scene fallback,
 * `ProtoUpgradeable.GetLevel()`, returns a normalised level, and its sibling
 * `GetLevelCount()` answers -1 when the scene has no buildings in it, so there is
 * no tier count to denormalise against. RP-1 has one, out of its own config, and
 * bills the career off it in all four scenes.</para>
 *
 * <para><b>It displaces the host widget's rows rather than joining them.</b>
 * The widget contributes its own reading of the stock channel at priority 0;
 * this one takes the default, so wherever RP-1 answers the grid is RP-1's and
 * there is no second copy of the same nine buildings underneath. Where RP-1 is
 * not running the contribution is not registered at all and the grid is the
 * host widget's own.</para>
 *
 * <para><b>It is typed from its own deps.</b> A contribution is handed the
 * payloads of the topics it declares in `deps`, so these rows arrive as
 * `Rp1FacilityEntry[]`, the shape `Rp1ScCapture.BuildFacilities` writes. Every
 * field on it is optional, which is the real uncertainty and the one worth
 * checking: a row is carried only once its facility and both its tiers read,
 * and dropped rather than defaulted otherwise.</para>
 *
 * <para><b>A building RP-1 does not upgrade still gets its tier and never gets a
 * price.</b> `upgradedByRp1` is false for the five its config prices at a single
 * fund under a "cosmetic only" comment: RP-1 drives their tier itself from the
 * mean of the ones it does upgrade. The tier is a reading and is reported; the
 * price would be for a step nothing will take, so it is withheld and the grid
 * draws no control beside it.</para>
 *
 * <para><b>While the game refuses the stock upgrade command, no building gets a
 * price here either.</b> The grid draws its Upgrade control from the price, and
 * that control sends `career.facility.upgrade`, which RP-1 refuses on a save it
 * manages. This Uplink's Facility Upgrades widget queues the same upgrade, so
 * the grid's control would be a dead second one for the same building, priced in
 * stock rounding. The refusal is read from the published gate set; a gate that
 * passes or could not be read leaves the price and the stock control alone.</para>
 */
export function facilityTiers(
  rows: readonly Rp1FacilityEntry[] | null | undefined,
  held?: Reading<unknown>,
  gates?: CommandGateReport | null,
) {
  if (!Array.isArray(rows)) return [];
  const stockUpgradeRefused = isRefused(gates, STOCK_UPGRADE_COMMAND);
  return rows.flatMap((row) => {
    const facility = row.facility;
    const currentTier = magnitudeOf(row.currentTier);
    const maxTier = magnitudeOf(row.maxTier);
    // Both ends or nothing: a building whose tier could not be read is not a
    // building at tier 0, and the grid's whole subject is telling those apart.
    if (
      typeof facility !== "string" ||
      currentTier === null ||
      maxTier === null
    ) {
      return [];
    }
    const upgradeCost =
      row.upgradedByRp1 === false || stockUpgradeRefused
        ? null
        : magnitudeOf(row.upgradeCost);
    return [
      {
        facility,
        currentTier,
        maxTier,
        ...(upgradeCost === null ? {} : { upgradeCost }),
        ...(held === undefined ? {} : { held }),
      },
    ];
  });
}

const STOCK_UPGRADE_COMMAND = "career.facility.upgrade";

function isRefused(
  gates: CommandGateReport | null | undefined,
  command: string,
): boolean {
  const entry = gates?.gates?.find((gate) => gate.command === command);
  return entry?.verdict?.outcome === GateOutcome.Fail;
}

RP1.registerContribution({
  id: "facility-tiers",
  contributes: "space-center-status.facilities",
  requires: "rp1",
  deps: ["rp1.facilities", "system.uplink.gates"],
  compute: (topics) =>
    facilityTiers(
      lastValue(topics["rp1.facilities"]),
      topics["rp1.facilities"],
      lastValue(topics["system.uplink.gates"]),
    ),
});
