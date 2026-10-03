import {
  type BodyDefinition,
  stillTrue,
  useCoverageMaskCache,
  useLateTelemetrySubscribe,
  useTelemetry,
} from "@ksp-gonogo/sitrep-sdk";
import { useEffect } from "react";
import type { SCANCoverageBitmap } from "../schema.js";
import { COVERAGE_SCAN_TYPES } from "./coverageSources.js";
import { applyScanCoverageToMask } from "./scanCoverageSync.js";

/**
 * Subscribe to one `scansat.mask.body.scanType` per relevant scan type and
 * merge each push into its own per-type coverage mask. SCANsat's coverage is
 * per-program (cross-vessel, kept in the save), and the mod sends a body's
 * whole bitmap whenever it is subscribed, so each mask fills from the stream
 * on mount with nothing kept locally.
 */
export function useScanCoverageSync(body: BodyDefinition | undefined): void {
  const scanAvailable =
    stillTrue(useTelemetry("scansat.available"), undefined) === true;
  const cache = useCoverageMaskCache();
  const subscribe = useLateTelemetrySubscribe();

  useEffect(() => {
    if (!scanAvailable) return;
    if (!body || !cache) return;

    const unsubscribes = COVERAGE_SCAN_TYPES.map(({ type: scanType, layerId }) => {
      const mask = cache.acquire(body.id, layerId);
      return subscribe<unknown>(`scansat.mask.${body.name}.${scanType}`, (value) => {
        if (!value || typeof value !== "object") return;
        const bitmap = value as Partial<SCANCoverageBitmap>;
        if (
          typeof bitmap.width !== "number" ||
          typeof bitmap.height !== "number" ||
          typeof bitmap.bits !== "string"
        ) {
          return;
        }
        const changed = applyScanCoverageToMask(
          bitmap as SCANCoverageBitmap,
          mask,
          body,
        );
        if (changed) cache.markDirty(body.id, layerId);
      });
    });
    return () => {
      for (const unsubscribe of unsubscribes) unsubscribe();
    };
  }, [scanAvailable, body, cache, subscribe]);
}
