import { registerCoverageSource } from "@ksp-gonogo/sitrep-sdk";
import { SCAN_TYPE, type SCANType } from "../schema.js";

/**
 * Scan types this Uplink keeps per-body coverage masks for, mapped to their
 * `"scansat:<Name>"` coverage-source layerId (the `<uplinkId>:<name>`
 * convention every Uplink's coverage sources follow) and composite weight.
 * Higher-resolution scans within a channel (HiRes vs LoRes) get a brighter
 * weight so MapView's paint gate reveals more for a HiRes-covered tile than a
 * LoRes-only one.
 *
 * Visual (LoRes/HiRes) and Anomaly are deliberately excluded:
 *   - Visual* are deprecated in modern KSP / SCANsat, no stock parts emit
 *     them.
 *   - Anomaly markers are surfaced via `scansat.anomalies.body` directly
 *     (point-based, not area-based coverage).
 */
export const COVERAGE_SCAN_TYPES: readonly {
  type: SCANType;
  layerId: string;
  weight: number;
}[] = [
  {
    type: SCAN_TYPE.AltimetryLoRes,
    layerId: "scansat:AltimetryLoRes",
    weight: 192,
  },
  {
    type: SCAN_TYPE.AltimetryHiRes,
    layerId: "scansat:AltimetryHiRes",
    weight: 255,
  },
  { type: SCAN_TYPE.Biome, layerId: "scansat:Biome", weight: 255 },
  {
    type: SCAN_TYPE.ResourceLoRes,
    layerId: "scansat:ResourceLoRes",
    weight: 192,
  },
  {
    type: SCAN_TYPE.ResourceHiRes,
    layerId: "scansat:ResourceHiRes",
    weight: 255,
  },
];

/**
 * Register every scan type as a coverage source, so MapView's paint gate knows
 * this Uplink contributes coverage. Called once, from this package's index,
 * rather than at import: a module that only wants the hook must not change
 * what the map paints.
 */
export function registerScanCoverageSources(): void {
  for (const { layerId, weight } of COVERAGE_SCAN_TYPES) {
    registerCoverageSource({ id: layerId, weight });
  }
}
