import type { CameraState } from "@ksp-gonogo/kerbcast";
import { act, renderHook } from "@ksp-gonogo/sitrep-sdk/testing";
import { afterEach, describe, expect, it, vi } from "vitest";
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

afterEach(() => {
  vi.restoreAllMocks();
});

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

  it("moves on when the sidecar reports a new attach of the same camera", () => {
    const withAttach = (attach: number) => [{ ...cam(5), attach } as CameraState];
    const { result, rerender } = setup({ ...base, cameras: withAttach(1) });
    act(() => rerender({ ...base, cameras: withAttach(1) }));
    expect(result.current).toBe(0);
    act(() => rerender({ ...base, cameras: withAttach(2) }));
    expect(result.current).toBe(1);
  });

  it("does not move on when a camera is first seen with an attach", () => {
    const { result, rerender } = setup({ ...base, flightId: 5, cameras: [cam(5)] });
    act(() =>
      rerender({ ...base, cameras: [{ ...cam(5), attach: 3 } as CameraState] }),
    );
    expect(result.current).toBe(0);
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

  it("does not count the clock's first epoch as a new timeline, but counts the next change", () => {
    const { result, rerender } = setup({ ...base, ut: null, epoch: 0 });
    act(() => rerender({ ...base, ut: 1000, epoch: 5 }));
    expect(result.current).toBe(0);
    act(() => rerender({ ...base, ut: 1001, epoch: 6 }));
    expect(result.current).toBe(1);
  });

  it("logs the source of a bump with the epoch, capture time and whether the camera is listed", () => {
    const info = vi.spyOn(console, "info").mockImplementation(() => {});
    const { rerender } = setup(base);
    act(() => rerender({ ...base, epoch: 2 }));
    act(() => rerender({ ...base, epoch: 2, cameras: [] }));
    act(() => rerender({ ...base, epoch: 2, cameras: [cam(5)] }));

    const lines = info.mock.calls.map((c) => c.join(" "));
    expect(lines.some((l) => l.includes("bump: epoch"))).toBe(true);
    expect(lines.some((l) => l.includes("bump: camera-listed"))).toBe(true);
    expect(lines.find((l) => l.includes("bump: epoch"))).toContain("1000");
  });

  it("logs the first clock epoch it ignores", () => {
    const info = vi.spyOn(console, "info").mockImplementation(() => {});
    const { rerender } = setup({ ...base, ut: null, epoch: 0 });
    act(() => rerender({ ...base, ut: 1000, epoch: 5 }));

    const lines = info.mock.calls.map((c) => c.join(" "));
    expect(lines.some((l) => l.includes("ignored: first clock epoch"))).toBe(
      true,
    );
  });
});
