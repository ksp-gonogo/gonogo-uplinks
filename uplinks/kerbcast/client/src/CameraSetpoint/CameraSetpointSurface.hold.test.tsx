/**
 * The rate-in half of the staged surface: a held input turns a wheel until it
 * is released, and nothing leaves the widget until the operator commits.
 *
 * Drives the real handle, the real interval and the real controlled `JogWheel`,
 * over the same stub wire the dispatch tests use. Fake timers because the thing
 * under test is what a held input does OVER TIME, and the only honest way to
 * ask that of a ticking control is to let time pass.
 */

import { act, render, screen } from "@ksp-gonogo/sitrep-sdk/testing";
import { createRef } from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  CameraSetpointSurface,
  type CameraSetpointSurfaceHandle,
} from "./CameraSetpointSurface.js";
import {
  SETPOINT_DEG_PER_SECOND,
  SETPOINT_TICK_MS,
} from "./setpointRate.js";

const bounds = {
  yawMin: -90,
  yawMax: 90,
  pitchMin: -45,
  pitchMax: 45,
  fovMin: 10,
  fovMax: 90,
};
const initial = { yaw: 0, pitch: 0, fov: 60 };

/** What the wheel is actually showing, off its own slider semantics. */
function wheel(name: RegExp): number {
  const el = screen.getByRole("slider", { name });
  return Number(el.getAttribute("aria-valuenow"));
}

function mount(ref: React.RefObject<CameraSetpointSurfaceHandle>) {
  return render(
    <CameraSetpointSurface
      ref={ref}
      cameraId={42}
      bounds={bounds}
      initial={initial}
      mode="staged"
    />,
  );
}

/** Let `ms` of held input pass, in the tick the surface actually runs at. */
async function hold(ms: number): Promise<void> {
  await act(async () => {
    await vi.advanceTimersByTimeAsync(ms);
  });
}

/**
 * How far a full-deflection hold carries the draft in `ms`.
 *
 * Whole ticks, and deliberately so: each tick applies a FIXED step rather than
 * a measured elapsed time, so a second of holding buys the sixteen ticks that
 * fit in it and not sixteen and two thirds. The draft therefore trails real
 * time slightly, which is the side of the trade a setpoint wants: the operator
 * can see a target that stopped short and nudge it, where one that over-ran
 * while the tab was throttled is a wrong command already composed.
 */
function degreesOver(ms: number): number {
  const ticks = Math.floor(ms / SETPOINT_TICK_MS);
  return (ticks * SETPOINT_DEG_PER_SECOND * SETPOINT_TICK_MS) / 1000;
}

describe("staged setpoint under a held input", () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("turns the yaw wheel for as long as the input is held, and stops on release", async () => {
    const ref = createRef<CameraSetpointSurfaceHandle>();
    mount(ref);
    expect(wheel(/yaw/i)).toBe(0);

    act(() => ref.current?.setAxisRate("yaw", 1));
    await hold(1000);
    expect(wheel(/yaw/i)).toBeCloseTo(degreesOver(1000), 6);

    // Still held: it keeps going, which is the whole point.
    await hold(1000);
    expect(wheel(/yaw/i)).toBeCloseTo(degreesOver(2000), 6);

    // Released, and a full second of nothing happening after it.
    act(() => ref.current?.setAxisRate("yaw", 0));
    const atRelease = wheel(/yaw/i);
    await hold(1000);
    expect(wheel(/yaw/i)).toBe(atRelease);
  });

  it("moves at the deflection, so half a stick is half the rate", async () => {
    const ref = createRef<CameraSetpointSurfaceHandle>();
    mount(ref);

    act(() => ref.current?.setAxisRate("pitch", -0.5));
    await hold(1000);

    expect(wheel(/pitch/i)).toBeCloseTo(-degreesOver(1000) / 2, 6);
  });

  it("pins at the envelope and comes straight back off it when the input reverses", async () => {
    const ref = createRef<CameraSetpointSurfaceHandle>();
    mount(ref);

    // Held at full for longer than the envelope is wide.
    act(() => ref.current?.setAxisRate("yaw", 1));
    await hold(10_000);
    expect(wheel(/yaw/i)).toBe(bounds.yawMax);

    // No fresh release needed: the rate is what changed, and the draft leaves
    // the bound on the next tick.
    act(() => ref.current?.setAxisRate("yaw", -1));
    await hold(1000);
    expect(wheel(/yaw/i)).toBeCloseTo(bounds.yawMax - degreesOver(1000), 6);
  });

  it("zooms the field of view down while held, since zooming in narrows it", async () => {
    const ref = createRef<CameraSetpointSurfaceHandle>();
    mount(ref);

    act(() => ref.current?.setAxisRate("fov", -1));
    await hold(1000);

    expect(wheel(/field of view/i)).toBeCloseTo(60 - degreesOver(1000), 6);
  });

  it("ignores a stick resting off centre rather than creeping on a stale event", async () => {
    const ref = createRef<CameraSetpointSurfaceHandle>();
    mount(ref);

    // One event, then silence: analog input is change-only.
    act(() => ref.current?.setAxisRate("yaw", 0.02));
    await hold(30_000);

    expect(wheel(/yaw/i)).toBe(0);
  });

  it("stops ticking when the surface unmounts under a held input", async () => {
    const ref = createRef<CameraSetpointSurfaceHandle>();
    const { unmount } = mount(ref);

    act(() => ref.current?.setAxisRate("yaw", 1));
    await hold(500);
    unmount();

    // Nothing left running: a timer that survived would be turning a wheel
    // nobody is holding, and in this widget would report an update outside act.
    expect(vi.getTimerCount()).toBe(0);
  });
});
