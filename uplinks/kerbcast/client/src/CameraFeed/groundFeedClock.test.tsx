import { renderHook } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { useGroundCameraClock } from "./groundFeedClock.js";

const view = {
  confirmedEdgeUt: () => 90,
  utNowEstimate: () => 100,
  onFrame: () => () => {},
};

describe("useGroundCameraClock", () => {
  it("is absent for a camera that is not on the ground", () => {
    const { result } = renderHook(() => useGroundCameraClock(view, 4, false));

    expect(result.current).toBeUndefined();
  });

  it("is absent with no view clock mounted", () => {
    const { result } = renderHook(() => useGroundCameraClock(undefined, 4, true));

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
    const { result } = renderHook(() => useGroundCameraClock(view, undefined, true));

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
});
