import {
  CameraKind,
  CameraLifecycle,
  type CameraState,
} from "@ksp-gonogo/kerbcast";
import { act, renderHook } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  FOLLOW_SETTLE_MS,
  useFollowedPartCamera,
} from "./useFollowedPartCamera.js";

vi.mock("@ksp-gonogo/sitrep-sdk", async (importOriginal) => {
  const actual = await importOriginal<Record<string, unknown>>();
  const log = { info: vi.fn(), debug: vi.fn(), warn: vi.fn() };
  return { ...actual, logger: { tag: () => log } };
});

function cam(over: Partial<CameraState> & { flightId: number }): CameraState {
  return {
    cameraName: "Tail Cam",
    vesselName: "Kerbal X",
    kind: CameraKind.Part,
    lifecycle: CameraLifecycle.Active,
    ...over,
  } as CameraState;
}

const HELD = cam({ flightId: 44 });
const OTHER = cam({ flightId: 42, cameraName: "Nose Cam" });

function mount(initial: CameraState[], requested = 44) {
  const onFollow = vi.fn();
  const view = renderHook(
    ({ cameras }) => useFollowedPartCamera(cameras, requested, onFollow),
    { initialProps: { cameras: initial } },
  );
  return { onFollow, ...view };
}

function settle() {
  act(() => {
    vi.advanceTimersByTime(FOLLOW_SETTLE_MS + 50);
  });
}

describe("useFollowedPartCamera", () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });
  afterEach(() => {
    vi.useRealTimers();
  });

  it("does not move the tile for a list that empties for one snapshot", () => {
    const { onFollow, rerender } = mount([HELD, OTHER]);
    rerender({ cameras: [] });
    rerender({ cameras: [HELD, OTHER] });
    settle();
    expect(onFollow).not.toHaveBeenCalled();
  });

  it("does not move the tile when the list is only reordered", () => {
    const { onFollow, rerender } = mount([HELD, OTHER]);
    rerender({ cameras: [OTHER, HELD] });
    settle();
    expect(onFollow).not.toHaveBeenCalled();
  });

  it("does not move the tile for a single snapshot that lists the camera as destroyed beside a live one", () => {
    const { onFollow, rerender } = mount([HELD, OTHER]);
    rerender({
      cameras: [
        cam({ flightId: 44, lifecycle: CameraLifecycle.Destroyed }),
        cam({ flightId: 91 }),
        OTHER,
      ],
    });
    rerender({ cameras: [HELD, OTHER] });
    settle();
    expect(onFollow).not.toHaveBeenCalled();
  });

  it("does not move the tile to a camera on another craft that is listed for one snapshot while the held one is missing", () => {
    const { onFollow, rerender } = mount([HELD, OTHER]);
    rerender({
      cameras: [cam({ flightId: 77, vesselName: "Kerbal X Debris" }), OTHER],
    });
    rerender({ cameras: [HELD, OTHER] });
    settle();
    expect(onFollow).not.toHaveBeenCalled();
  });

  it("moves the tile once, after the camera has stayed gone for the settle time", () => {
    const { onFollow, rerender } = mount([HELD, OTHER]);
    const relaunched = [cam({ flightId: 91 }), OTHER];
    rerender({ cameras: relaunched });
    act(() => {
      vi.advanceTimersByTime(FOLLOW_SETTLE_MS - 100);
    });
    expect(onFollow).not.toHaveBeenCalled();
    settle();
    expect(onFollow).toHaveBeenCalledTimes(1);
    expect(onFollow).toHaveBeenCalledWith(91);
  });

  it("starts the wait again when the replacement changes", () => {
    const { onFollow, rerender } = mount([HELD, OTHER]);
    rerender({ cameras: [cam({ flightId: 91 }), OTHER] });
    act(() => {
      vi.advanceTimersByTime(FOLLOW_SETTLE_MS - 100);
    });
    rerender({ cameras: [cam({ flightId: 92 }), OTHER] });
    act(() => {
      vi.advanceTimersByTime(FOLLOW_SETTLE_MS - 100);
    });
    expect(onFollow).not.toHaveBeenCalled();
    settle();
    expect(onFollow).toHaveBeenCalledWith(92);
  });
});
