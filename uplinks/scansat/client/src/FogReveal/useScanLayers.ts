import { useTelemetry } from "@ksp-gonogo/sitrep-sdk";
import { useMemo } from "react";
import type {
  SCANAnomalyEntry,
  SCANBiomeGrid,
  SCANCoverageBitmap,
  SCANHeightGrid,
  SCANScanningVessel,
  SCANType,
} from "../schema.js";
import type {
  DecodedBiomes,
  DecodedCoverage,
  DecodedHeights,
} from "./scanDecode.js";
import {
  decodeBiomeGrid,
  decodeCoverage,
  decodeHeightGrid,
} from "./scanDecode.js";

/**
 * Live snapshot of SCANsat's per-tile coverage bitfield for the named
 * body and scan-type. `undefined` until the first push lands; `null` if
 * SCANsat isn't installed (the fork returns null on every SCANsat-only
 * key in that case).
 */
export function useScanCoverage(
  bodyName: string | undefined,
  scanType: SCANType,
  dataSourceId = "data",
): DecodedCoverage | null | undefined {
  const raw = useTelemetry<SCANCoverageBitmap | null>(
    dataSourceId,
    bodyName ? `scansat.mask.${bodyName}.${scanType}` : "scansat.available",
  );
  return useMemo(() => {
    if (!bodyName) return undefined;
    if (raw == null) return raw as null | undefined;
    return decodeCoverage(raw);
  }, [raw, bodyName]);
}

/**
 * Live snapshot of the per-tile elevation grid (PQS-backed, doesn't
 * actually need SCANsat installed, the fork resolves it from stock).
 */
export function useScanHeightGrid(
  bodyName: string | undefined,
  dataSourceId = "data",
): DecodedHeights | null | undefined {
  const raw = useTelemetry<SCANHeightGrid | null>(
    dataSourceId,
    bodyName ? `scansat.height.${bodyName}` : "scansat.available",
  );
  return useMemo(() => {
    if (!bodyName) return undefined;
    if (raw == null) return raw as null | undefined;
    return decodeHeightGrid(raw);
  }, [raw, bodyName]);
}

/**
 * Live snapshot of the per-tile biome grid + body's biome name/colour
 * table (stock BiomeMap-backed, no SCANsat install required).
 */
export function useScanBiomeGrid(
  bodyName: string | undefined,
  dataSourceId = "data",
): DecodedBiomes | null | undefined {
  const raw = useTelemetry<SCANBiomeGrid | null>(
    dataSourceId,
    bodyName ? `scansat.biome.${bodyName}` : "scansat.available",
  );
  return useMemo(() => {
    if (!bodyName) return undefined;
    if (raw == null) return raw as null | undefined;
    return decodeBiomeGrid(raw);
  }, [raw, bodyName]);
}

/**
 * Anomalies known to SCANsat for the given body, with per-anomaly
 * discovery state. The list always returns the same anomalies for a
 * given save+body (KSP places them at world-gen); the per-entry
 * `known` and `detail` flags toggle as the player scans.
 */
export function useScanAnomalies(
  bodyName: string | undefined,
  dataSourceId = "data",
): SCANAnomalyEntry[] | null | undefined {
  const raw = useTelemetry<SCANAnomalyEntry[] | null>(
    dataSourceId,
    bodyName ? `scansat.anomalies.${bodyName}` : "scansat.available",
  );
  if (!bodyName) return undefined;
  if (raw == null) return raw as null | undefined;
  return raw;
}

/**
 * Live list of vessels SCANsat is tracking (loaded or unloaded). Used
 * by the Scanning widget: MapView consumes a flat anomaly list and a
 * single-body fog mask, but the Scanning widget surfaces the per-
 * vessel scanner + footprint detail.
 *
 * Read through the canonical one-arg Topic form, unlike the per-body hooks
 * above. Those name a key in a DYNAMIC namespace (`scansat.mask.<body>.<type>`
 * and friends), which no `[SitrepTopic]` type can enumerate, so the two-arg
 * form's `resolveValueTopic` vouches for them by pattern. `scansat.scanningVessels`
 * is a declared Topic of this Uplink's own contract slice, and the two-arg form
 * cannot reach one: `mapTopic` answers only for those dynamic patterns, and
 * `isKnownFieldPath` walks a topic root plus a FIELD path, so a bare Topic id
 * resolves to nothing on either arm. It then fell through to a `DataSource`
 * registered under the flat id `"data"`, which the app has not had since the
 * stream became the sole telemetry path, so this list read `undefined` for ever.
 */
export function useScanningVessels(): SCANScanningVessel[] | undefined {
  const reading = useTelemetry("scansat.scanningVessels");
  // A scanning fleet is a FACT: it stays true until an event changes it, and a
  // link that has gone quiet cannot deliver that event. So `stale` still answers
  // with what was last really seen; only `pending`/`unowned`/`absent` have
  // nothing to give. The cast restores the required-field mirror in ../schema.ts
  // over the all-optional shape codegen emits for a reference type; the wire
  // always carries every field (see the mod's ScanningVessels.Build), and the
  // previous read asserted exactly the same thing through its type parameter.
  if (reading.state === "observed" || reading.state === "stale") {
    return reading.value as SCANScanningVessel[];
  }
  return undefined;
}
