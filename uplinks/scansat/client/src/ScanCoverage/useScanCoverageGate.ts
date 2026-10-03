// Mod-local coverage-gate hook. A near-verbatim copy of
// packages/components/src/MapView/useCoverageGate.ts's hook, ported here so
// widgets that live outside MapView's `map-view.base` slot tree (currently
// only Minimap.tsx) can compute the same per-tile reveal composite without
// importing @ksp-gonogo/components, whose scan-canvas internals go once every
// consumer has its own copy.
//
// Kept behaviourally identical to the original. A single shared implementation
// could be hoisted into @ksp-gonogo/data without changing behaviour, the same
// way TerrainBase/paintTile.ts's tileToPixelRect is a deliberate byte-for-byte
// copy of ScanCoverage/scanDecode.ts's.
import {
  type BodyMask,
  type CoverageSourceDefinition,
  getCoverageSources,
  onCoverageSourcesChange,
  useCoverageMaskCache,
} from "@ksp-gonogo/sitrep-sdk";
import { useEffect, useState, useSyncExternalStore } from "react";

export interface ScanCoverageGate {
  /** Composite reveal intensity, one byte per cell, row-major, same
   *  dimensions as `width`/`height`. 0 = fully un-covered (paint nothing /
   *  black), 255 = fully covered (paint at full opacity). */
  data: Uint8Array | null;
  version: number;
  width: number;
  height: number;
  /** True when at least one coverage source is registered AND a
   *  `CoverageMaskCacheProvider` is mounted to actually resolve its masks. False
   *  in either the "no coverage source" case (zero coverage sources
   *  registered) or the "no cache provider" case (sources are registered
   *  but nothing can fetch their masks). Consumers should treat false as
   *  "paint fully open," never "paint nothing." */
  hasAnySource: boolean;
}

const DEFAULT_WEIGHT = 255;

/** Exported for direct unit testing without a canvas, pure per-pixel math. */
export function compositeScanCoverage(
  sources: readonly CoverageSourceDefinition[],
  masksByLayer: ReadonlyMap<string, BodyMask>,
  augmentSettings: Record<string, Record<string, unknown>> | undefined,
  pixelIndex: number,
): number {
  let reveal = 0;
  for (const source of sources) {
    if (augmentSettings?.[source.id]?.show === false) continue;
    const m = masksByLayer.get(source.id);
    if (!m) continue;
    const weight = source.weight ?? DEFAULT_WEIGHT;
    const v = Math.round((m.data[pixelIndex] * weight) / 255);
    if (v > reveal) reveal = v;
  }
  return reveal;
}

// Stable-reference snapshot cache: getCoverageSources() allocates fresh
// every call, which would infinite-loop useSyncExternalStore directly.
// Refreshed via an unconditional module-load subscription (mirrors the
// MapView original) so a reveal source registering before any hook instance
// is mounted is never missed.
let cachedSources: CoverageSourceDefinition[] = getCoverageSources();
onCoverageSourcesChange(() => {
  cachedSources = getCoverageSources();
});
function getSourcesSnapshot(): CoverageSourceDefinition[] {
  return cachedSources;
}

export function useScanCoverageGate(
  bodyId: string | undefined,
  augmentSettings: Record<string, Record<string, unknown>> | undefined,
): ScanCoverageGate {
  const sources = useSyncExternalStore(
    onCoverageSourcesChange,
    getSourcesSnapshot,
    getSourcesSnapshot,
  );
  const cache = useCoverageMaskCache();
  const [gate, setGate] = useState<ScanCoverageGate>({
    data: null,
    version: 0,
    width: 0,
    height: 0,
    hasAnySource: cache != null && sources.length > 0,
  });

  useEffect(() => {
    if (!cache) {
      setGate((g) => ({ ...g, data: null, hasAnySource: false }));
      return;
    }
    if (!bodyId || sources.length === 0) {
      setGate((g) => ({ ...g, data: null, hasAnySource: sources.length > 0 }));
      return;
    }
    let cancelled = false;
    const masksByLayer = new Map<string, BodyMask>();
    const unsubs: Array<() => void> = [];
    let width = 0;
    let height = 0;

    function recompute(): void {
      if (cancelled || width === 0) return;
      const len = width * height;
      const out = new Uint8Array(len);
      for (let i = 0; i < len; i++) {
        out[i] = compositeScanCoverage(
          sources,
          masksByLayer,
          augmentSettings,
          i,
        );
      }
      setGate((g) => ({
        data: out,
        version: g.version + 1,
        width,
        height,
        hasAnySource: true,
      }));
    }

    for (const source of sources) {
      const m = cache.acquire(bodyId, source.id);
      width = m.width;
      height = m.height;
      masksByLayer.set(source.id, m);
      unsubs.push(cache.onChange(bodyId, source.id, recompute));
    }
    recompute();
    return () => {
      cancelled = true;
      for (const u of unsubs) u();
    };
  }, [bodyId, sources, augmentSettings, cache]);

  return gate;
}
