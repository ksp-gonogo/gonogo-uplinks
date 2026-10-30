import type { CameraState } from "@ksp-gonogo/kerbcast";
import { act, renderHook } from "@ksp-gonogo/sitrep-sdk/testing";
import { describe, expect, it } from "vitest";
import { useSourceGeneration } from "./useSourceGeneration.js";

function cam(flightId: number, lifecycle = "active"): CameraState {
  return { flightId, lifecycle } as CameraState;
}

interface Props {
  flightId: number | null;
  cameras: CameraState[];
  ut: number | null;
  epoch: number;
}

function setup(initial: Props) {
  return renderHook(
    (p: Props) => useSourceGeneration(p.flightId, p.cameras, p.ut, p.epoch),
    { initialProps: initial },
  );
}

const base: Props = { flightId: 5, cameras: [cam(5)], ut: 1000, epoch: 1 };

describe("useSourceGeneration", () => {
  it("stays put while the capture time advances", () => {
    const { result, rerender } = setup(base);
    rerender({ ...base, ut: 1001 });
    rerender({ ...base, ut: 1002 });
    expect(result.current).toBe(0);
  });

  it("moves on when the capture time goes backwards, as on a relaunch of the same camera", () => {
    const { result, rerender } = setup(base);
    act(() => rerender({ ...base, ut: 1010 }));
    act(() => rerender({ ...base, ut: 200 }));
    expect(result.current).toBe(1);
  });

  it("ignores a step back of under a second", () => {
    const { result, rerender } = setup(base);
    act(() => rerender({ ...base, ut: 1000.5 }));
    expect(result.current).toBe(0);
  });

  it("moves on when the clock epoch changes", () => {
    const { result, rerender } = setup(base);
    act(() => rerender({ ...base, epoch: 2 }));
    expect(result.current).toBe(1);
  });

  it("moves on when the camera returns to the list after being gone", () => {
    const { result, rerender } = setup(base);
    act(() => rerender({ ...base, cameras: [] }));
    expect(result.current).toBe(0);
    act(() => rerender({ ...base, cameras: [cam(5)] }));
    expect(result.current).toBe(1);
  });

  it("counts a camera first listed after an empty list, but not a different camera being picked", () => {
    const { result, rerender } = setup({ ...base, cameras: [] });
    act(() => rerender({ ...base, cameras: [cam(5)] }));
    expect(result.current).toBe(1);
    act(() => rerender({ ...base, flightId: 9, cameras: [cam(5), cam(9)] }));
    expect(result.current).toBe(1);
  });
});
