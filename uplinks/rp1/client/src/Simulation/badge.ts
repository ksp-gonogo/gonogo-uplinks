import type { Reading } from "@ksp-gonogo/sitrep-sdk";
import type { BadgeEntry } from "@ksp-gonogo/ui-kit";
import type { Rp1Simulation } from "../__generated__/contract.js";
import { lastValue } from "../lastValue.js";
import { RP1 } from "../uplink.js";

/**
 * The SIMULATION badge in the screen header, or `null` for none.
 *
 * A simulation flies a vessel that was never built, from a save RP-1 restores
 * when it ends, and every widget on the board draws it exactly as it would a
 * mission. The header is the one surface on the main screen and every station
 * alike, so it is where the board says which of the two it is.
 *
 * Drawn only while RP-1 says a simulation is running. A real flight, and an
 * absent reading (RP-1 not managing the save), both draw nothing: an empty
 * header is the normal state, and a badge is a claim.
 */
export function simulationBadges(
  simulation: Rp1Simulation | null | undefined,
  held?: Reading<unknown>,
): BadgeEntry[] | null {
  if (simulation?.active !== true) return null;
  return [
    {
      id: "rp1-simulation",
      label: "SIMULATION",
      tone: "caution",
      ...(held === undefined ? {} : { held }),
    },
  ];
}

RP1.registerContribution({
  id: "rp1-simulation-badge",
  contributes: "app.header-badges",
  requires: "rp1",
  deps: ["rp1.simulation"],
  compute: (topics) =>
    simulationBadges(
      lastValue(topics["rp1.simulation"]),
      topics["rp1.simulation"],
    ),
});
