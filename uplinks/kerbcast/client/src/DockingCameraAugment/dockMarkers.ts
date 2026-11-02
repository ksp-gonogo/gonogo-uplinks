import type {
  AnchorCornerOverride,
  AnchorCornerOverrides,
} from "@ksp-gonogo/kerbcast-react";

/** Line-of-sight angle off the port's axis, in degrees, inside which an axis reads as lined up. */
export const LINED_UP_DEG = 1;

const LINED_UP = "var(--color-accent-fg)";
const OFF = "var(--color-warn-mark)";

/** What the four triangles around the target port are drawn from. */
export interface DockMarkerInput {
  /** The anchor's result for the displayed frame. */
  anchor: { inFrame: boolean; behind?: boolean; occluded?: boolean };
  /** Horizontal line-of-sight angle to the target port, degrees. `undefined` while not reported. */
  ax: number | undefined;
  /** Vertical line-of-sight angle to the target port, degrees. `undefined` while not reported. */
  ay: number | undefined;
  /** True while the two ports face each other head-on. */
  aligned: boolean;
  /** True once the own port has captured the target port or is joined to it. */
  docked: boolean;
}

const HIDDEN: AnchorCornerOverride = { hidden: true };

/**
 * The four triangles around the target port: top and bottom follow the
 * vertical angle, left and right the horizontal one. A triangle is green
 * while its angle is inside {@link LINED_UP_DEG} and amber outside it, and
 * all four are green once the port has captured or joined the target. Filled while the ports face
 * each other head-on, outlined while they do not. Nothing is drawn unless the
 * port is in front of the lens, in frame and not hidden behind something.
 */
export function dockCorners(input: DockMarkerInput): AnchorCornerOverrides {
  const { anchor, ax, ay, aligned, docked } = input;
  if (!anchor.inFrame || anchor.behind === true || anchor.occluded !== false) {
    return { top: HIDDEN, right: HIDDEN, bottom: HIDDEN, left: HIDDEN };
  }
  const side = (angle: number | undefined): AnchorCornerOverride => {
    if (docked) return { colour: LINED_UP, dashed: false };
    if (angle === undefined || !Number.isFinite(angle)) return HIDDEN;
    return {
      colour: Math.abs(angle) <= LINED_UP_DEG ? LINED_UP : OFF,
      dashed: !aligned,
    };
  };
  const vertical = side(ay);
  const horizontal = side(ax);
  return {
    top: vertical,
    bottom: vertical,
    left: horizontal,
    right: horizontal,
  };
}
