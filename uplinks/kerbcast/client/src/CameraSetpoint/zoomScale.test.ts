import { describe, expect, it } from "vitest";
import {
  clampFov,
  formatFov,
  fovToPosition,
  positionToFov,
} from "./zoomScale.js";

const level3 = { fovMin: 0.13, fovMax: 1.2 };
const spaceLens = { fovMin: 0.004, fovMax: 1.2 };

describe("zoom scale", () => {
  it("puts the narrowest field of view at 0 and the widest at 1", () => {
    expect(fovToPosition(0.13, level3)).toBeCloseTo(0, 10);
    expect(fovToPosition(1.2, level3)).toBeCloseTo(1, 10);
  });

  it("makes equal travel an equal ratio of field of view", () => {
    const mid = positionToFov(0.5, spaceLens);
    expect(mid).toBeCloseTo(Math.sqrt(0.004 * 1.2), 10);
    expect(1.2 / mid).toBeCloseTo(mid / 0.004, 8);
  });

  it("round-trips a field of view through the wheel position", () => {
    for (const fov of [0.004, 0.02, 0.13, 0.7, 1.2]) {
      expect(positionToFov(fovToPosition(fov, spaceLens), spaceLens)).toBeCloseTo(
        fov,
        10,
      );
    }
  });

  it("reads the limits off the camera it is given", () => {
    expect(positionToFov(0, level3)).toBeCloseTo(0.13, 10);
    expect(positionToFov(0, spaceLens)).toBeCloseTo(0.004, 10);
    expect(positionToFov(1, { fovMin: 10, fovMax: 90 })).toBeCloseTo(90, 10);
  });

  it("clamps a position or a field of view outside the range", () => {
    expect(positionToFov(-3, level3)).toBeCloseTo(0.13, 10);
    expect(positionToFov(7, level3)).toBeCloseTo(1.2, 10);
    expect(clampFov(0.001, level3)).toBe(0.13);
    expect(clampFov(5, level3)).toBe(1.2);
    expect(fovToPosition(50, level3)).toBeCloseTo(1, 10);
  });

  it("does not divide by zero on limits it cannot use", () => {
    const unusable = [
      { fovMin: 0, fovMax: 0 },
      { fovMin: 0, fovMax: 60 },
      { fovMin: 60, fovMax: 60 },
      { fovMin: Number.NaN, fovMax: 60 },
    ];
    for (const limits of unusable) {
      expect(Number.isFinite(fovToPosition(30, limits))).toBe(true);
      expect(Number.isFinite(positionToFov(0.5, limits))).toBe(true);
    }
  });
});

describe("formatFov", () => {
  it("never reads a sub-degree zoom as zero", () => {
    expect(formatFov(0.13)).toBe("0.13°");
    expect(formatFov(0.004)).toBe("0.004°");
    expect(formatFov(0.0043)).toBe("0.0043°");
    expect(formatFov(0.4)).toBe("0.4°");
    expect(formatFov(0.9)).not.toBe("0°");
  });

  it("gives two significant figures from 1 to 10 degrees", () => {
    expect(formatFov(1.2)).toBe("1.2°");
    expect(formatFov(1)).toBe("1°");
    expect(formatFov(5.04)).toBe("5°");
    expect(formatFov(9.6)).toBe("9.6°");
  });

  it("gives whole degrees from 10 up", () => {
    expect(formatFov(10)).toBe("10°");
    expect(formatFov(59.6)).toBe("60°");
    expect(formatFov(120)).toBe("120°");
  });

  it("reads 0 for a value that is not a field of view", () => {
    expect(formatFov(0)).toBe("0°");
    expect(formatFov(Number.NaN)).toBe("0°");
  });
});
