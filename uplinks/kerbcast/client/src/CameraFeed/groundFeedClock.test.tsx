import {
  type ClockFormulaSnapshot,
  computeConfirmedEdgeUt,
} from "@ksp-gonogo/sitrep-sdk";
import { renderHook } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { useGroundCameraClock } from "./groundFeedClock.js";

const craftSnapshot: ClockFormulaSnapshot = {
  epoch: 1,
  anchorWall: 1000,
  anchorUt: 500,
  maxSampleUt: 500,
  delaySeconds: 12,
  warpRate: 1,
  slackSeconds: 0,
};

const view = {
  confirmedEdgeUt: () => 90,
  utNowEstimate: () => 100,
  onFrame: () => () => {},
  snapshot: () => craftSnapshot,
};

/** The UT the delay worker would release up to, `seconds` after the snapshot's anchor. */
function releaseEdge(snapshot: ClockFormulaSnapshot, seconds: number): number {
  return computeConfirmedEdgeUt(snapshot, (snapshot.anchorWall ?? 0) + seconds);
}

describe("useGroundCameraClock", () => {
  it("is absent for a camera that is not on the ground", () => {
    const { result } = renderHook(() => useGroundCameraClock(view, 4, false));

    expect(result.current).toBeUndefined();
  });

  it("is absent with no view clock mounted", () => {
    const { result } = renderHook(() =>
      useGroundCameraClock(undefined, 4, true),
    );

    expect(result.current).toBeUndefined();
  });

  it("releases at the game's present less the camera's own delay", () => {
    const { result } = renderHook(() => useGroundCameraClock(view, 4, true));

    expect(result.current?.confirmedEdgeUt()).toBe(96);
  });

  it("releases live where the screen views from the camera's own centre", () => {
    const { result } = renderHook(() => useGroundCameraClock(view, 0, true));

    expect(result.current?.confirmedEdgeUt()).toBe(100);
  });

  it("holds every frame when no route reaches the camera", () => {
    const { result } = renderHook(() => useGroundCameraClock(view, null, true));

    expect(result.current?.confirmedEdgeUt()).toBe(Number.NEGATIVE_INFINITY);
  });

  it("leaves the shared clock in charge before the roster has arrived", () => {
    const { result } = renderHook(() =>
      useGroundCameraClock(view, undefined, true),
    );

    expect(result.current?.confirmedEdgeUt()).toBe(90);
  });

  it("follows a delay that changes without a new clock", () => {
    const { result, rerender } = renderHook(
      ({ d }) => useGroundCameraClock(view, d, true),
      { initialProps: { d: 4 as number | null } },
    );
    const first = result.current;
    rerender({ d: 10 });

    expect(result.current).toBe(first);
    expect(result.current?.confirmedEdgeUt()).toBe(90);
  });

  it("reports the game's present, which the capture clock health check reads", () => {
    const { result } = renderHook(() => useGroundCameraClock(view, 4, true));

    expect(
      (result.current as { utNowEstimate?: () => number } | undefined)
        ?.utNowEstimate?.(),
    ).toBe(100);
  });

  describe("snapshot, which the delay worker follows", () => {
    it("is offered, so a ground feed is delayed in the worker and not dropped to the main thread", () => {
      const { result } = renderHook(() => useGroundCameraClock(view, 4, true));

      expect(typeof result.current?.snapshot).toBe("function");
    });

    it("releases at the camera's own delay while the craft's snapshot says another", () => {
      const { result } = renderHook(() => useGroundCameraClock(view, 4, true));
      const snapshot = result.current?.snapshot();

      expect(snapshot && releaseEdge(snapshot, 10)).toBe(506);
      expect(releaseEdge(craftSnapshot, 10)).toBe(498);
    });

    it("follows a delay that changes", () => {
      const { result, rerender } = renderHook(
        ({ d }) => useGroundCameraClock(view, d, true),
        { initialProps: { d: 4 as number | null } },
      );
      rerender({ d: 1 });
      const snapshot = result.current?.snapshot();

      expect(snapshot && releaseEdge(snapshot, 10)).toBe(509);
    });

    it("keeps presenting through a craft blackout, where the craft's own samples stop", () => {
      const { result } = renderHook(() => useGroundCameraClock(view, 4, true));
      const snapshot = result.current?.snapshot();

      expect(snapshot && releaseEdge(snapshot, 600)).toBe(1096);
      expect(releaseEdge(craftSnapshot, 600)).toBe(500);
    });

    it("resumes releasing after the game's clock jumps back to an earlier epoch", () => {
      let current = craftSnapshot;
      const reverting = { ...view, snapshot: () => current };
      const { result } = renderHook(() =>
        useGroundCameraClock(reverting, 4, true),
      );
      current = {
        ...craftSnapshot,
        epoch: 2,
        anchorUt: 100,
        maxSampleUt: 100,
      };
      const snapshot = result.current?.snapshot();

      expect(snapshot?.epoch).toBe(2);
      expect(snapshot && releaseEdge(snapshot, 10)).toBe(106);
    });

    it("holds every frame when no route reaches the camera", () => {
      const { result } = renderHook(() =>
        useGroundCameraClock(view, null, true),
      );
      const snapshot = result.current?.snapshot();

      expect(snapshot && releaseEdge(snapshot, 10)).toBe(
        Number.NEGATIVE_INFINITY,
      );
    });

    it("is the craft's own snapshot before the roster has arrived", () => {
      const { result } = renderHook(() =>
        useGroundCameraClock(view, undefined, true),
      );

      expect(result.current?.snapshot()).toEqual(craftSnapshot);
    });

    it("holds the picture until the game's clock is known, with no craft sample yet", () => {
      const cold = {
        ...view,
        utNowEstimate: () => 0,
        snapshot: () => ({
          ...craftSnapshot,
          anchorWall: undefined,
          anchorUt: undefined,
          maxSampleUt: Number.NEGATIVE_INFINITY,
        }),
      };
      const { result } = renderHook(() => useGroundCameraClock(cold, 4, true));
      const snapshot = result.current?.snapshot();

      expect(snapshot && computeConfirmedEdgeUt(snapshot, 5000)).toBe(0 - 4);
    });
  });
});
