/**
 * What shape the camera frame is, how big it can be inside the tile, and what
 * resolution the sidecar is asked to render for it.
 *
 * Pure, so the one thing this widget cannot photograph is unit-testable. The
 * game renders the camera at the size this widget reports, so whatever decides
 * the frame's shape also decides the shot. The frame is therefore a fixed 16:9,
 * never the tile's shape and never the shape of the stream already playing: a
 * frame that followed the stream asked for a stream of its own shape, and any
 * odd shape a narrow tile produced for one frame became the stream's shape for
 * good.
 */

/** Shape of every camera frame, width over height. */
export const FEED_ASPECT = 16 / 9;

/** Requested sizes are ceiled to this many pixels, which also keeps them even for H.264. */
const REQUEST_BUCKET_PX = 16;

/**
 * The frame's own box, CSS px: 16:9, as large as the box the tile left it, and
 * centred in whatever it does not use.
 *
 * Stated in px rather than left to CSS `aspect-ratio`, deliberately. With a
 * definite height and an auto width, `max-width` clamps the width without
 * feeding back into the height, so the box goes out of ratio at exactly the
 * sizes where it matters. This asks the question the fit actually is: which
 * axis runs out first.
 */
export function frameBox(
  box: { w: number; h: number },
  aspect: number = FEED_ASPECT,
): { width: number; height: number } {
  const width = Math.floor(Math.min(box.w, box.h * aspect));
  return { width, height: Math.floor(width / aspect) };
}

/**
 * The render size to ask the sidecar for, from the frame's width alone: the
 * width ceiled to a 16px bucket and a 16:9 height from it, rounded up to an
 * even number. `null` for a frame with no width yet, which asks for nothing.
 */
export function frameRequest(
  frameWidth: number,
): { width: number; height: number } | null {
  if (!(frameWidth > 0)) return null;
  const width = Math.ceil(frameWidth / REQUEST_BUCKET_PX) * REQUEST_BUCKET_PX;
  const height = Math.ceil(width / FEED_ASPECT / 2) * 2;
  return { width, height };
}
