import type { CameraState } from "@ksp-gonogo/kerbcast";
import { describe, expect, it } from "vitest";
import { DEFAULT_FEED_ASPECT, feedAspect, frameBox } from "./frameShape.js";

/** Only the four dimensions `feedAspect` reads; the rest of `CameraState` is
 *  irrelevant to the shape of the picture. */
function camera(dims: Partial<CameraState>): CameraState {
  return dims as CameraState;
}

describe("feedAspect", () => {
  it("takes the camera's own configured size first", () => {
    // kerbcast's shipped default. `renderWidth` is deliberately something else
    // so the precedence is what passes this, not a coincidence of equal values.
    expect(
      feedAspect(
        camera({
          operatorWidth: 1024,
          operatorHeight: 576,
          renderWidth: 512,
          renderHeight: 512,
        }),
      ),
    ).toBeCloseTo(16 / 9);
  });

  it("falls back to the effective render size when there is no operator size", () => {
    expect(
      feedAspect(camera({ renderWidth: 800, renderHeight: 600 })),
    ).toBeCloseTo(4 / 3);
  });

  it("is 16:9 with no camera, and with a camera reporting zeroes", () => {
    expect(feedAspect(undefined)).toBe(DEFAULT_FEED_ASPECT);
    expect(
      feedAspect(
        camera({
          operatorWidth: 0,
          operatorHeight: 0,
          renderWidth: 0,
          renderHeight: 0,
        }),
      ),
    ).toBe(DEFAULT_FEED_ASPECT);
  });
});

describe("frameBox", () => {
  it("holds the aspect when the box is wider than the camera", () => {
    // The tile the widget shipped with: 396x156 of body for a 16:9 camera. The
    // frame takes the height and leaves the spare width to the panel, rather
    // than asking the sidecar for a 2.5:1 view.
    expect(frameBox({ w: 396, h: 156 }, 16 / 9)).toEqual({
      width: 277,
      height: 155,
    });
  });

  it("holds the aspect when the box is taller than the camera", () => {
    expect(frameBox({ w: 320, h: 400 }, 16 / 9)).toEqual({
      width: 320,
      height: 180,
    });
  });

  it("never exceeds the box it was given on either axis", () => {
    for (const box of [
      { w: 100, h: 100 },
      { w: 316, h: 189 },
      { w: 220, h: 123 },
    ]) {
      const fitted = frameBox(box, 16 / 9);
      expect(fitted.width).toBeLessThanOrEqual(box.w);
      expect(fitted.height).toBeLessThanOrEqual(box.h);
    }
  });
});
