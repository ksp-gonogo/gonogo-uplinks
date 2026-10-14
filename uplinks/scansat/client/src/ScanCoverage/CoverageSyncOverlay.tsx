// Draws nothing. Rides Ground Track's `ground-track.overlay` slot only because that is
// where the map says which body it shows, so the masks its paint gate reads are
// filled for that body and follow it when the operator switches.

import {
  getBody,
  registerAugment,
  type SlotProps,
} from "@ksp-gonogo/sitrep-sdk";
import { SCANSAT } from "../uplink.js";
import { useScanCoverageSync } from "./useScanCoverageSync.js";

function CoverageSyncOverlay(ctx: SlotProps<"ground-track.overlay">) {
  useScanCoverageSync(ctx.bodyName ? getBody(ctx.bodyName) : undefined);
  return null;
}

registerAugment({
  id: "scansat-coverage-sync",
  augments: "ground-track.overlay",
  requires: "scansat",
  component: CoverageSyncOverlay,
  owner: SCANSAT,
});

export { CoverageSyncOverlay };
