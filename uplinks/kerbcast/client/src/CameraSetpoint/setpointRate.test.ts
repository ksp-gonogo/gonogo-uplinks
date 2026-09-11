import { describe, expect, it } from "vitest";
import {
  advanceSetpoint,
  anyHeld,
  REST_DEADZONE,
  REST_RATES,
  SETPOINT_DEG_PER_SECOND,
  settleRate,
} from "./setpointRate.js";

const bounds = {
  yawMin: -90,
  yawMax: 90,
  pitchMin: -45,
  pitchMax: 45,
  fovMin: 10,
  fovMax: 90,
};
const centred = { yaw: 0, pitch: 0, fov: 60 };

describe("settleRate", () => {
  it("passes a real deflection through, sign kept", () => {
    expect(settleRate(1)).toBe(1);
    expect(settleRate(-0.4)).toBe(-0.4);
  });

  it("treats a stick resting off centre as released", () => {
    // The case this exists for: analog events are change-only, so a stick that
    // settles at 0.02 emits it once and never again. Integrated, that is a
    // draft that creeps for as long as the widget is mounted.
    expect(settleRate(0.02)).toBe(0);
    expect(settleRate(-(REST_DEADZONE / 2))).toBe(0);
  });

  it("clamps past full deflection and refuses a non-finite rate", () => {
    expect(settleRate(2.5)).toBe(1);
    expect(settleRate(Number.NaN)).toBe(0);
  });
});

describe("anyHeld", () => {
  it("is false at rest and true for any one axis", () => {
    expect(anyHeld(REST_RATES)).toBe(false);
    expect(anyHeld({ ...REST_RATES, pitch: -0.2 })).toBe(true);
  });
});

describe("advanceSetpoint", () => {
  it("moves an axis by the rate times the elapsed degrees", () => {
    const next = advanceSetpoint(
      centred,
      { ...REST_RATES, yaw: 1 },
      bounds,
      1,
    );
    expect(next.yaw).toBe(SETPOINT_DEG_PER_SECOND);
    expect(next.pitch).toBe(0);
    expect(next.fov).toBe(60);
  });

  it("scales with deflection rather than snapping, so trim survives", () => {
    // A fifth of a stick over one 60ms tick is 0.36 of a degree. Rounded to the
    // wheel's own step that would be zero every tick, and the fine end of the
    // range would be dead.
    const next = advanceSetpoint(
      centred,
      { ...REST_RATES, yaw: 0.2 },
      bounds,
      0.06,
    );
    expect(next.yaw).toBeCloseTo(0.36, 6);
  });

  it("clamps at the envelope instead of overshooting it", () => {
    const next = advanceSetpoint(
      { yaw: 85, pitch: -44, fov: 12 },
      { yaw: 1, pitch: -1, fov: -1 },
      bounds,
      1,
    );
    expect(next.yaw).toBe(90);
    expect(next.pitch).toBe(-45);
    expect(next.fov).toBe(10);
  });

  it("leaves a pinned axis free to reverse the moment the rate does", () => {
    const pinned = { yaw: 90, pitch: 0, fov: 60 };
    const back = advanceSetpoint(
      pinned,
      { ...REST_RATES, yaw: -1 },
      bounds,
      0.06,
    );
    expect(back.yaw).toBeCloseTo(90 - SETPOINT_DEG_PER_SECOND * 0.06, 6);
  });

  it("cannot move a camera with no pitch envelope", () => {
    // There is no `supportsPitch` flag on a CameraState: a fixed-pitch camera
    // publishes a zero-width envelope, and the clamp is the whole no-op.
    const fixedPitch = { ...bounds, pitchMin: 0, pitchMax: 0 };
    const next = advanceSetpoint(
      centred,
      { ...REST_RATES, pitch: 1 },
      fixedPitch,
      1,
    );
    expect(next).toBe(centred);
  });

  it("returns the same object when nothing moved", () => {
    expect(advanceSetpoint(centred, REST_RATES, bounds, 1)).toBe(centred);
    expect(
      advanceSetpoint(
        { yaw: 90, pitch: 0, fov: 60 },
        { ...REST_RATES, yaw: 1 },
        bounds,
        1,
      ).yaw,
    ).toBe(90);
  });
});
