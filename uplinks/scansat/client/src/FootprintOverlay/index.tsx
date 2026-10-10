// SCANsat scanning-vessel footprint overlay for MapView.
//
// Fills MapView's `map-view.overlay` slot with each tracked vessel's ground-
// track rectangle. It lives here rather than in core MapView so that MapView
// reads no `scansat.scanningVessels` and does no SCANsat-shaped geometry of its
// own: augment, do not embed.
//
// `map-view.overlay` is an OVERLAY slot: MapView passes down `project()`,
// the exact per-body-offset + camera chain the base map itself draws with,
// so this augment lands its rectangles on the same pixels without
// re-deriving that maths.
//
// The stroke width is a fixed SCREEN-space constant (`STROKE_WIDTH_PX`), NOT
// pre-divided by camera zoom. Dividing is what a world-space drawing routine
// has to do, to cancel out a zoom-scaling `ctx.setTransform(...)` the caller
// applied; `project()` already hands back post-camera-transform screen pixels,
// so there is no such transform here to compensate for and dividing would
// shrink the stroke twice. The rest of the geometry is an affine zoom+pan
// either way.
//
// The map repeats east and west, one world every `worldW * camera.zoom`
// overlay pixels, and `project()` places a point in the repeat nearest the
// centre of the view. So a footprint is one rectangle laid from its west edge,
// drawn again in every repeat of the world in view, and a footprint across the
// antimeridian is simply one whose repeats both reach the view.
//
// Presence-gated on `requires: "scansat"`: renders only while
// `scansat.available` is live, so an install without SCANsat never mounts
// it: zero impact on MapView for non-SCANsat users.

import type { SlotProps } from "@ksp-gonogo/sitrep-sdk";
import { registerAugment, useTelemetry } from "@ksp-gonogo/sitrep-sdk";
import { magnitudeOf, magnitudeOr } from "@ksp-gonogo/ui-kit";
import { useEffect, useRef } from "react";
import { useScanningVessels } from "../ScanCoverage/useScanLayers.js";
import type { SCANScanningVessel } from "../schema.js";
import { SCANSAT } from "../uplink.js";

/** Fixed screen-pixel stroke width: see module doc comment for why this
 *  replaces the old world-space `1 / camZoom` compensation. `project()`
 *  already hands back post-camera-transform screen pixels, so a constant
 *  reads consistently at any zoom without re-deriving the camera's zoom
 *  factor here (same approach AnomalyOverlay's marker takes). */
const STROKE_WIDTH_PX = 1.5;

const HELD_DASH = [4, 3];

/**
 * Paint every scanning vessel's footprint rectangle onto the overlay
 * canvas, in already-projected SCREEN-space pixels via `project`. Only
 * vessels on `bodyName` are drawn. `width` is the overlay layer's pixel
 * width, and `repeatWidth` the pixels one world spans across, after which
 * the map repeats.
 *
 * `held` draws each footprint as a dashed outline with no fill, the way
 * MapView draws its own held vessel marker: the list is what was last really
 * seen, and a solid swath would read as a satellite scanning there now.
 */
export function drawFootprints(
  ctx: Pick<
    CanvasRenderingContext2D,
    | "fillRect"
    | "strokeRect"
    | "fillStyle"
    | "strokeStyle"
    | "lineWidth"
    | "setLineDash"
  >,
  width: number,
  repeatWidth: number,
  bodyName: string | undefined,
  vessels: readonly SCANScanningVessel[],
  project: (lat: number, lon: number) => { x: number; y: number },
  held = false,
): void {
  if (!bodyName || !(repeatWidth > 0)) return;
  ctx.setLineDash(held ? HELD_DASH : []);

  for (const v of vessels) {
    if (v.body !== bodyName) continue;
    // Magnitudes, because everything below is canvas geometry. These arrive as
    // `Value<"°">` off the wire (this Uplink registers its own type units), and
    // read as numbers they produced NaN coordinates rather than throwing, so the
    // footprint silently drew nothing.
    const halfLat = magnitudeOf(v.groundTrackWidthDeg);
    const halfLon = magnitudeOf(v.groundTrackLonHalfDeg);
    const subLat = magnitudeOf(v.subLatitude);
    const subLon = magnitudeOf(v.subLongitude);
    if (halfLat == null || halfLat <= 0) continue;
    if (halfLon == null || halfLon <= 0) continue;
    // A vessel whose sub-point did not decode has no known place on this
    // body, so it gets no rectangle. Defaulted to 0 it got one anyway,
    // centred on 0°N 0°E, and the operator read a swath being scanned off
    // the west coast of Africa.
    if (subLat == null || subLon == null) continue;

    const tc = v.trackColor;
    const channels = tc
      ? {
          r: magnitudeOr(tc.r, 255),
          g: magnitudeOr(tc.g, 255),
          b: magnitudeOr(tc.b, 255),
          a: magnitudeOr(tc.a, 255),
        }
      : undefined;
    const fill = held
      ? "transparent"
      : channels
      ? `rgba(${channels.r}, ${channels.g}, ${channels.b}, ${((channels.a / 255) * 0.45).toFixed(3)})`
      : "rgba(255, 255, 255, 0.3)";
    const stroke = channels
      ? `rgba(${channels.r}, ${channels.g}, ${channels.b}, 0.9)`
      : "rgba(255, 255, 255, 0.7)";

    // Latitude band (no wrap: clamp to the poles, matching `project`'s
    // own body-offset clamp semantics before it's even applied here).
    const latTop = Math.min(90, subLat + halfLat);
    const latBot = Math.max(-90, subLat - halfLat);
    const { y: yTop } = project(latTop, 0);
    const { y: yBot } = project(latBot, 0);
    const rectY = Math.min(yTop, yBot);
    const rectH = Math.abs(yBot - yTop);

    const { x: xWest } = project(0, subLon - halfLon);
    const rectW = ((halfLon * 2) / 360) * repeatWidth;

    ctx.fillStyle = fill;
    ctx.strokeStyle = stroke;
    ctx.lineWidth = STROKE_WIDTH_PX;

    if (rectW >= repeatWidth) {
      // Spans the whole world, so every repeat of it: one band across the view.
      ctx.fillRect(0, rectY, width, rectH);
      ctx.strokeRect(0, rectY, width, rectH);
      continue;
    }
    const first = Math.ceil(-(xWest + rectW) / repeatWidth);
    const last = Math.floor((width - xWest) / repeatWidth);
    for (let k = first; k <= last; k++) {
      const rectX = xWest + k * repeatWidth;
      ctx.fillRect(rectX, rectY, rectW, rectH);
      ctx.strokeRect(rectX, rectY, rectW, rectH);
    }
  }
}

function FootprintOverlay(ctx: SlotProps<"map-view.overlay">) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const vessels = useScanningVessels();
  const held = useTelemetry("scansat.scanningVessels").state === "held";

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const c2d = canvas.getContext("2d");
    if (!c2d) return;
    c2d.clearRect(0, 0, ctx.width, ctx.height);
    if (!Array.isArray(vessels)) return;
    drawFootprints(
      c2d,
      ctx.width,
      ctx.worldW * ctx.camera.zoom,
      ctx.bodyName,
      vessels,
      ctx.project,
      held,
    );
  }, [
    vessels,
    held,
    ctx.width,
    ctx.height,
    ctx.worldW,
    ctx.camera.zoom,
    ctx.bodyName,
    ctx.project,
  ]);

  return (
    <canvas
      ref={canvasRef}
      data-footprints={held ? "held" : "current"}
      width={ctx.width}
      height={ctx.height}
      style={{
        position: "absolute",
        inset: 0,
        width: "100%",
        height: "100%",
        pointerEvents: "none",
      }}
    />
  );
}

registerAugment({
  id: "scansat-footprint-overlay",
  augments: "map-view.overlay",
  requires: "scansat",
  component: FootprintOverlay,
  owner: SCANSAT,
});

export { FootprintOverlay };
