// SCANsat altimetry base-layer provider for MapView.
//
// Fills MapView's `map-view.base` STACKABLE slot
// with a standalone colourised elevation surface: SCANsat's own
// "Altimetry" map mode. Headless: renders no JSX, hands MapView a canvas
// via `ctx.onLayer` whenever this layer's own per-instance `show` setting
// (`ctx.augmentSettings[ALTIMETRY_LAYER_ID]?.show`, default true) is on.
//
// Draws ALONGSIDE `BiomeBase`: both register on `map-view.base` with
// distinct ids, and MapView composites every active layer's canvas rather
// than picking one. This layer sits at the BOTTOM of the stack (the base
// terrain colouring biome draws translucently on top of; see BiomeBase's
// own header comment) and declares `suppressesVanillaBase: true`: while
// either SCANsat base layer's Domain is LIVE (this mod is actually running
// in KSP: registering this augment alone is NOT enough, see
// `suppressesVanillaBase`'s own doc comment in packages/core/src/
// augments.ts), MapView's stock body texture never paints, full stop
// (spec: "don't like it, don't have the Uplink", meaning the Domain is
// live, not merely that this client package is bundled).
//
// This is a standalone colourised height surface REPLACING the map's base
// texture, never a tint drawn on top of it, so it carries no baked-in ramp
// opacity of its own: visibility comes from the coverage paint-gate
// MULTIPLIED by this layer's own `layerOpacity` (see
// `paintTile.ts`'s `effectiveAlpha`): at the BOTTOM of the stack this
// layer paints fully opaque (`layerOpacity = 1`) wherever it paints at
// all, since there's no stock texture beneath it to show through once
// vanilla is suppressed.

import {
  bodyNamed,
  CELESTIAL_FACTS,
  getBody,
  registerAugment,
  type SlotProps,
  useProcessor,
} from "@ksp-gonogo/sitrep-sdk";
import { useEffect } from "react";
import { useScanHeightGrid } from "../ScanCoverage/useScanLayers.js";
import { SCANSAT } from "../uplink.js";
import {
  BASE_LAYER_CANVAS_H,
  BASE_LAYER_CANVAS_W,
  paintTile,
} from "./paintTile.js";

export const ALTIMETRY_LAYER_ID = "scansat:altimetry";

const DEEP_WATER = "20, 50, 110";
const SHALLOW_WATER = "40, 100, 160";
const LOWLAND = "80, 150, 90";
const HIGHLAND = "140, 110, 60";
const PEAK = "220, 220, 220";

/**
 * Altimetry colour for a height in metres, given the grid's own min/max.
 *
 * On a body with an ocean the ramp is anchored at sea level (0 m), the way
 * SCANsat's own palettes clamp an ocean body's terrain config at 0: the two
 * water stops share `min..0` and the three land stops share `0..max`, so
 * dry land never paints as water however deep the ocean floor goes. With no
 * ocean (or none known) the five stops spread over the whole `min..max`
 * span, so an airless body such as the Mun still gets the full range.
 */
export function altimetryColour(
  metres: number,
  minMetres: number,
  maxMetres: number,
  hasOcean: boolean,
): string {
  if (!hasOcean) {
    const t = fraction(metres, minMetres, maxMetres);
    if (t < 0.2) return DEEP_WATER;
    if (t < 0.4) return SHALLOW_WATER;
    if (t < 0.6) return LOWLAND;
    if (t < 0.8) return HIGHLAND;
    return PEAK;
  }
  if (metres < 0) {
    return fraction(metres, minMetres, 0) < 0.5 ? DEEP_WATER : SHALLOW_WATER;
  }
  const t = fraction(metres, 0, maxMetres);
  if (t < 1 / 3) return LOWLAND;
  if (t < 2 / 3) return HIGHLAND;
  return PEAK;
}

function fraction(metres: number, lo: number, hi: number): number {
  return Math.max(0, Math.min(1, (metres - lo) / Math.max(1, hi - lo)));
}

// The bottom of the SCANsat base-layer stack, fully opaque wherever it
// paints at all. There is no stock texture beneath it once vanilla is
// suppressed (`suppressesVanillaBase`, below), so nothing benefits from
// this layer being translucent; BiomeBase (drawn on top) is the one that
// needs a `layerOpacity` under 1 so this layer still shows through it.
const ALTIMETRY_LAYER_OPACITY = 1;

function AltimetryBase(ctx: SlotProps<"map-view.base">) {
  const body = ctx.bodyId ? getBody(ctx.bodyId) : undefined;
  const heightGrid = useScanHeightGrid(body?.name);
  // The body catalogue is a fact, so a held reading still says whether the body has an ocean.
  const factsReading = useProcessor(CELESTIAL_FACTS);
  const facts =
    factsReading?.state === "observed" || factsReading?.state === "held"
      ? factsReading.value
      : undefined;
  const hasOcean = bodyNamed(facts, body?.name)?.hasOcean === true;
  // Per-layer toggle (spec: SCANsat layers default ON; `map-view.actions`
  // and the settings-panel checkbox both read/write this SAME value).
  const show = ctx.augmentSettings?.[ALTIMETRY_LAYER_ID]?.show !== false;

  useEffect(() => {
    if (!show) {
      ctx.onLayer(ALTIMETRY_LAYER_ID, null, 0);
      return;
    }
    if (!heightGrid || !body || typeof document === "undefined") return;

    // Fixed internal paint resolution: see paintTile.ts's header comment
    // for why this ignores ctx.width/ctx.height (the live viewport size).
    const canvas = document.createElement("canvas");
    canvas.width = BASE_LAYER_CANVAS_W;
    canvas.height = BASE_LAYER_CANVAS_H;
    const c2d = canvas.getContext("2d");
    if (!c2d) return;

    paintTile(
      c2d,
      heightGrid.width,
      heightGrid.height,
      body,
      ctx.coverageGate,
      (iLon, iLat) => {
        const idx = iLon * heightGrid.height + iLat;
        return altimetryColour(
          heightGrid.metres[idx],
          heightGrid.minMetres,
          heightGrid.maxMetres,
          hasOcean,
        );
      },
      BASE_LAYER_CANVAS_W,
      BASE_LAYER_CANVAS_H,
      ALTIMETRY_LAYER_OPACITY,
    );
    ctx.onLayer(ALTIMETRY_LAYER_ID, canvas, Date.now());

    // Drop this layer's canvas immediately on unmount (e.g. the Domain
    // goes unavailable) rather than leaving it orphaned in MapView's
    // per-id canvas store forever: with a single-pick slot a stale entry
    // was harmless (the next selection just overwrote it); in the
    // stackable model nothing else would ever clear it.
    return () => ctx.onLayer(ALTIMETRY_LAYER_ID, null, 0);
  }, [show, ctx.onLayer, ctx.coverageGate, heightGrid, body, hasOcean]);

  return null;
}

registerAugment({
  id: ALTIMETRY_LAYER_ID,
  augments: "map-view.base",
  requires: "scansat",
  component: AltimetryBase,
  suppressesVanillaBase: true,
  settings: [
    {
      key: "show",
      type: "boolean",
      label: "Show altimetry",
      default: true,
    },
  ],
  owner: SCANSAT,
});

export { AltimetryBase };
