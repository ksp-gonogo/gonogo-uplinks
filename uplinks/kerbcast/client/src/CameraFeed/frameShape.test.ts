import { describe, expect, it } from "vitest";
import {
  borderedFrameBox,
  FEED_ASPECT,
  frameBox,
  frameRequest,
} from "./frameShape.js";

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

describe("frameRequest", () => {
  it("asks for a 16:9 size from the frame width alone", () => {
    for (const width of [170, 348, 640, 1001]) {
      const request = frameRequest(width);
      expect(request).not.toBeNull();
      expect(request?.width).toBeGreaterThanOrEqual(width);
      expect((request?.width ?? 1) % 16).toBe(0);
      expect((request?.width ?? 0) / (request?.height ?? 1)).toBeCloseTo(
        FEED_ASPECT,
        1,
      );
      expect((request?.height ?? 1) % 2).toBe(0);
    }
  });

  it("asks for nothing before the frame has a width", () => {
    expect(frameRequest(0)).toBeNull();
  });

  it("never asks for a side under 128 px", () => {
    for (const width of [1, 15, 48, 100, 200]) {
      const request = frameRequest(width);
      expect(request?.width).toBeGreaterThanOrEqual(128);
      expect(request?.height).toBeGreaterThanOrEqual(128);
    }
    expect(frameRequest(48, 1)).toEqual({ width: 128, height: 128 });
  });
});

describe("borderedFrameBox", () => {
  it("leaves a feed of exactly 16:9 under the border", () => {
    for (const box of [
      { w: 396, h: 156 },
      { w: 320, h: 400 },
      { w: 335, h: 188 },
      { w: 158, h: 88 },
    ]) {
      const frame = borderedFrameBox(box, 1);
      const feed = { w: frame.width - 2, h: frame.height - 2 };
      expect(feed.w * 9).toBe(feed.h * 16);
      expect(frame.width).toBeLessThanOrEqual(box.w);
      expect(frame.height).toBeLessThanOrEqual(box.h);
    }
  });
});
