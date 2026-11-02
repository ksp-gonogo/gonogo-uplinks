import { describe, expect, it } from "vitest";
import { dockCorners, LINED_UP_DEG } from "./dockMarkers";

const SEEN = { inFrame: true, behind: false, occluded: false };
const GO = "var(--color-accent-fg)";
const OFF = "var(--color-warn-mark)";

const sides = ["top", "right", "bottom", "left"] as const;

describe("dockCorners", () => {
  it("colours the top and bottom triangles from the vertical angle and the left and right from the horizontal one", () => {
    const corners = dockCorners({
      anchor: SEEN,
      ax: 4,
      ay: 0.2,
      aligned: true,
      docked: false,
    });
    expect(corners.top?.colour).toBe(GO);
    expect(corners.bottom?.colour).toBe(GO);
    expect(corners.left?.colour).toBe(OFF);
    expect(corners.right?.colour).toBe(OFF);
  });

  it("reads an axis as lined up up to the tolerance and off beyond it, in either direction", () => {
    for (const angle of [-LINED_UP_DEG, LINED_UP_DEG]) {
      expect(
        dockCorners({
          anchor: SEEN,
          ax: angle,
          ay: angle,
          aligned: true,
          docked: false,
        }).top?.colour,
      ).toBe(GO);
    }
    for (const angle of [-LINED_UP_DEG - 0.01, LINED_UP_DEG + 0.01]) {
      expect(
        dockCorners({
          anchor: SEEN,
          ax: angle,
          ay: angle,
          aligned: true,
          docked: false,
        }).top?.colour,
      ).toBe(OFF);
    }
  });

  it("outlines the triangles while the ports do not face each other head-on and fills them once they do", () => {
    const input = { anchor: SEEN, ax: 0, ay: 0, docked: false };
    expect(dockCorners({ ...input, aligned: false }).top?.dashed).toBe(true);
    expect(dockCorners({ ...input, aligned: true }).top?.dashed).toBe(false);
  });

  it("turns all four green and filled once the ports are joined, whatever the angles say", () => {
    const corners = dockCorners({
      anchor: SEEN,
      ax: 12,
      ay: -9,
      aligned: false,
      docked: true,
    });
    for (const side of sides) {
      expect(corners[side]).toEqual({ colour: GO, dashed: false });
    }
  });

  it("draws nothing for an axis whose angle is not reported", () => {
    const corners = dockCorners({
      anchor: SEEN,
      ax: undefined,
      ay: 0,
      aligned: true,
      docked: false,
    });
    expect(corners.left?.hidden).toBe(true);
    expect(corners.right?.hidden).toBe(true);
    expect(corners.top?.hidden).toBeUndefined();
  });

  it.each([
    ["out of frame", { inFrame: false, behind: false, occluded: false }],
    ["behind the lens", { inFrame: false, behind: true, occluded: false }],
    [
      "hidden behind something",
      { inFrame: true, behind: false, occluded: true },
    ],
    ["not checked for occlusion", { inFrame: true, behind: false }],
  ])("draws nothing while the port is %s, even once the ports are joined", (_, anchor) => {
    const corners = dockCorners({
      anchor,
      ax: 0,
      ay: 0,
      aligned: true,
      docked: true,
    });
    for (const side of sides) expect(corners[side]?.hidden).toBe(true);
  });
});
