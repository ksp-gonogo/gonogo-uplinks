/**
 * What shape the camera frame should be, and how big it can be inside the tile.
 *
 * Pure, so the one thing this widget cannot photograph is unit-testable: the
 * frame's box is what the kerbcast SDK reports to the sidecar as the display
 * size (`useReportDisplaySize`, on by default via `renderSize="auto"`), and the
 * game renders the camera at exactly that resolution. A frame that took the
 * tile's shape therefore asked KSP for a view of the tile's shape, so a wide,
 * short tile got a wide, short FIELD OF VIEW. Nothing was ever scaled
 * anisotropically (the SDK's `<video>` is `object-fit: contain`) and nothing was
 * cropped; the shot itself was being recomposed by the layout.
 */

import type { CameraState } from "@ksp-gonogo/kerbcast";

/** Shape of a feed nobody has said anything about yet. */
export const DEFAULT_FEED_ASPECT = 16 / 9;

/**
 * The shape of the picture this camera actually produces, as width ÷ height.
 *
 * `operatorWidth`/`operatorHeight` first, because that is the camera's OWN
 * configured size (kerbcast's `KerbcastSettings` defaults it to 1024x576) and
 * the one number here that is not downstream of this widget's own layout.
 * `renderWidth`/`renderHeight` is the effective size after adaptive shedding,
 * which is the honest second answer when a camera reports no operator size.
 */
export function feedAspect(camera: CameraState | undefined): number {
  const pairs: ReadonlyArray<readonly [number, number]> = [
    [camera?.operatorWidth ?? 0, camera?.operatorHeight ?? 0],
    [camera?.renderWidth ?? 0, camera?.renderHeight ?? 0],
  ];
  for (const [w, h] of pairs) {
    if (w > 0 && h > 0) return w / h;
  }
  return DEFAULT_FEED_ASPECT;
}

/**
 * The frame's own box, CSS px: the camera's aspect, as large as the box the
 * tile left it.
 *
 * Stated in px rather than left to CSS `aspect-ratio`, deliberately. With a
 * definite height and an auto width, `max-width` clamps the width without
 * feeding back into the height, so the box goes out of ratio at exactly the
 * sizes where it matters. This asks the question the fit actually is: which
 * axis runs out first.
 */
export function frameBox(
  box: { w: number; h: number },
  aspect: number,
): { width: number; height: number } {
  const width = Math.floor(Math.min(box.w, box.h * aspect));
  return { width, height: Math.floor(width / aspect) };
}
