import { useStream, useTelemetry } from "@ksp-gonogo/sitrep-sdk";
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
import { SCANSAT_AVAILABLE_TOPIC } from "../topics.js";

/**
 * One per-body layer's last payload, or `undefined` with no body or before the
 * first push. A per-body key is a dynamic Topic with no `TopicId` member, so it
 * is read with `useStream`; with no body the hook still subscribes, to the
 * availability flag, and ignores it, so the hook order holds. A `stale` payload
 * still answers: coverage, terrain and the anomaly list only change on a push.
 */
function useBodyLayer<T>(topic: string | undefined): T | undefined {
  const reading = useStream<T>(topic ?? SCANSAT_AVAILABLE_TOPIC);
  if (topic === undefined) return undefined;
  return reading.state === "observed" || reading.state === "stale"
    ? reading.value
    : undefined;
}

/**
 * Live snapshot of SCANsat's per-tile coverage bitfield for the named
 * body and scan-type. `undefined` until the first push lands; `null` if
 * SCANsat isn't installed (the fork returns null on every SCANsat-only
 * key in that case).
 */
export function useScanCoverage(
  bodyName: string | undefined,
  scanType: SCANType,
): DecodedCoverage | null | undefined {
  const raw = useBodyLayer<SCANCoverageBitmap | null>(
    bodyName ? `scansat.mask.${bodyName}.${scanType}` : undefined,
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
): DecodedHeights | null | undefined {
  const raw = useBodyLayer<SCANHeightGrid | null>(
    bodyName ? `scansat.height.${bodyName}` : undefined,
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
): DecodedBiomes | null | undefined {
  const raw = useBodyLayer<SCANBiomeGrid | null>(
    bodyName ? `scansat.biome.${bodyName}` : undefined,
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
): SCANAnomalyEntry[] | null | undefined {
  const raw = useBodyLayer<SCANAnomalyEntry[] | null>(
    bodyName ? `scansat.anomalies.${bodyName}` : undefined,
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
 * `scansat.scanningVessels` is a declared Topic of this Uplink's contract
 * slice, so it is read through `useTelemetry`, unlike the per-body layers above.
 */
export function useScanningVessels(): SCANScanningVessel[] | undefined {
  const reading = useTelemetry("scansat.scanningVessels");
  // A scanning fleet is a FACT: it stays true until an event changes it, and a
  // link that has gone quiet cannot deliver that event. So `stale` still answers
  // with what was last really seen; only `pending`/`unowned`/`absent` have
  // nothing to give. The cast restores the required-field mirror in ../schema.ts
  // over the all-optional shape codegen emits for a reference type. The wire
  // carries every KEY, but not every key with a value: `altitude` and the two
  // ground-track widths are genuinely null when their inputs were not read
  // (see the mod's ScanningVessels.Build), and the mirror says so.
  if (reading.state === "observed" || reading.state === "stale") {
    return reading.value as SCANScanningVessel[];
  }
  return undefined;
}
