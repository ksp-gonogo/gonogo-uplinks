import { value } from "@ksp-gonogo/sitrep-sdk";
import { writeQuantity } from "@ksp-gonogo/ui-kit";

/**
 * The zoom wheel's scale: field of view on a log axis between a camera's live
 * widest and narrowest limits.
 *
 * A command camera's range spans three orders of magnitude (about 1.2 degrees
 * to 0.13 degrees at Tracking Station levels 1 and 3, and lower with a space
 * lens), so equal wheel travel has to mean an equal ratio of field of view
 * rather than an equal number of degrees, or the narrow end is a few pixels of
 * tape. The wheel carries a position from 0 (narrowest) to 1 (widest) and this
 * module converts it to and from degrees. Pure arithmetic, no React.
 */

/** Wheel increment as a share of the whole range, for a keyboard step. */
export const ZOOM_STEP = 0.02;

/** Seconds a fully held input takes to carry the zoom across its whole range. */
export const ZOOM_SECONDS_END_TO_END = 6;

type FovLimits = { fovMin: number; fovMax: number };

/** A usable pair of limits: both finite and above 0, with the widest above the narrowest. */
function usable({ fovMin, fovMax }: FovLimits): boolean {
  return (
    Number.isFinite(fovMin) &&
    Number.isFinite(fovMax) &&
    fovMin > 0 &&
    fovMax > fovMin
  );
}

/** A field of view held inside the camera's limits. */
export function clampFov(fov: number, limits: FovLimits): number {
  if (!usable(limits)) return Number.isFinite(fov) ? fov : 0;
  return Math.min(limits.fovMax, Math.max(limits.fovMin, fov));
}

/** Wheel position, 0 at the narrowest field of view and 1 at the widest. */
export function fovToPosition(fov: number, limits: FovLimits): number {
  if (!usable(limits)) return 0;
  const clamped = clampFov(fov, limits);
  return (
    Math.log(clamped / limits.fovMin) / Math.log(limits.fovMax / limits.fovMin)
  );
}

/** The field of view a wheel position stands for, in degrees. */
export function positionToFov(position: number, limits: FovLimits): number {
  if (!usable(limits)) return Number.isFinite(limits.fovMin) ? limits.fovMin : 0;
  const p = Math.min(1, Math.max(0, position));
  return limits.fovMin * (limits.fovMax / limits.fovMin) ** p;
}

/**
 * A field of view as the wheel reads it: two significant figures below 10
 * degrees ("1.2°", "0.13°", "0.004°") and whole degrees from there up.
 */
export function formatFov(fov: number): string {
  if (!Number.isFinite(fov) || fov <= 0) return writeQuantity(value("°", 0), { decimals: 0 });
  if (fov >= 10) {
    return writeQuantity(value("°", Math.round(fov)), { decimals: 0 });
  }
  const places = Math.max(0, 1 - Math.floor(Math.log10(fov)));
  const rounded = Number(fov.toFixed(places));
  const decimals = (String(rounded).split(".")[1] ?? "").length;
  return writeQuantity(value("°", rounded), { decimals });
}
