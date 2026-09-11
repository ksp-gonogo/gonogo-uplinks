/**
 * Rate in, position out: what a held analog input does to the DRAFT setpoint.
 *
 * The staged surface holds a target the operator is composing, not a readback
 * of where the camera is, so an input bound to it cannot be a "set this value"
 * action: there is no value to set, there is a wheel to turn. A held stick
 * therefore moves the draft continuously and lets go when the input returns to
 * rest, which is the same gesture the SDK's live pan ball answers with a pan
 * RATE, pointed at a number instead of at a camera.
 *
 * Pure arithmetic, no React and no clock, so the rate policy is readable and
 * testable on its own and the surface only owns when to tick it.
 */

import type { CameraSetpoint, CameraSetpointBounds } from "./CameraSetpointInput.js";

/** The three axes the cluster's wheels dial, as an input may drive them. */
export type SetpointAxis = "yaw" | "pitch" | "fov";

/** Held rate per axis, each normalised to -1..1 as an analog action arrives. */
export type AxisRates = Record<SetpointAxis, number>;

/** Nothing held. */
export const REST_RATES: AxisRates = { yaw: 0, pitch: 0, fov: 0 };

/**
 * Degrees of DRAFT movement per second at full deflection.
 *
 * Deliberately not the ~90 deg/s the plugin pans a camera at (the figure the
 * kerbcast SDK sizes `settleTimeoutMs` against). That number is chosen for
 * watching a camera swing; this one is chosen for reading a number before
 * committing it, and at 90 the smallest controlled press of a thumb crosses
 * nine degrees while the wheel's own step is one.
 *
 * 30 is ui-kit's `DEFAULT_STEPS_PER_SECOND`: what the kit's own `JogWheel`
 * moves at when its handle is held at full in rate mode. The same primitive
 * answering the same question with two speeds is how the two drift, so this
 * takes the kit's answer rather than inventing a second one. It crosses a
 * +/-90 yaw envelope in six seconds, moves 1.8 degrees per tick at full so the
 * caret visibly turns every tick, and gives a fifth of a degree per tick at a
 * fifth deflection, which is the trim end of the range.
 */
export const SETPOINT_DEG_PER_SECOND = 30;

/**
 * How often a held input moves the draft, ms.
 *
 * ui-kit's `RATE_TICK_MS` exactly, for the reason above, and a timer rather
 * than `requestAnimationFrame` because what is moving is a number being read,
 * not an animation: a frame-rate loop would re-render the cluster and its
 * preview SVG at display rate on top of a decoding video, for digits that are
 * no more legible at 60Hz than at 16.7.
 */
export const SETPOINT_TICK_MS = 60;

/**
 * Magnitude below which a held axis counts as released.
 *
 * Load-bearing rather than defensive: analog events are CHANGE-only (the
 * gamepad transport diffs against its last value and suppresses anything under
 * its own epsilon), and the deadzone a device type applies defaults to zero. So
 * a stick that settles at 0.02 emits that once and then nothing ever again, and
 * without a rest band here the draft would creep on a stale event for as long
 * as the widget stayed mounted. 0.05 is the kerbcast SDK's own
 * `analogDeadzone` default, which is the same band on the live path.
 */
export const REST_DEADZONE = 0.05;

/** A held rate, or rest when the input is close enough to centre. */
export function settleRate(rate: number): number {
  if (!Number.isFinite(rate)) return 0;
  return Math.abs(rate) < REST_DEADZONE ? 0 : Math.max(-1, Math.min(1, rate));
}

/** Is anything held? */
export function anyHeld(rates: AxisRates): boolean {
  return rates.yaw !== 0 || rates.pitch !== 0 || rates.fov !== 0;
}

function clamp(v: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, v));
}

/**
 * Move the draft by however far the held rates carry it in `seconds`.
 *
 * Clamped at the bounds rather than stopped there. Three reasons, and the third
 * is the one that decides it: the bounds are the camera's real gimbal limits,
 * so pinning at one is the honest reading of where it could actually point;
 * `JogWheel`'s own `applyDelta` clamps, so every other way into this value
 * already behaves this way; and a held input that LATCHED OFF at a bound would
 * need a fresh event to come back, which is exactly what a stick pushed past
 * the limit and then pulled back does not produce.
 *
 * Not snapped to the wheel's step. Snapping each tick to a whole degree would
 * round a fifth-deflection trim (0.18 degrees per tick) to zero every tick and
 * kill the fine end of the range outright; the caret already reads to the
 * degree through its own formatter, and the command carries a float either way.
 *
 * Returns the SAME object when nothing moved (every axis at rest or pinned), so
 * a caller holding this in state re-renders only on a real change.
 */
export function advanceSetpoint(
  setpoint: CameraSetpoint,
  rates: AxisRates,
  bounds: CameraSetpointBounds,
  seconds: number,
): CameraSetpoint {
  const step = SETPOINT_DEG_PER_SECOND * seconds;
  const next: CameraSetpoint = {
    yaw: clamp(setpoint.yaw + rates.yaw * step, bounds.yawMin, bounds.yawMax),
    pitch: clamp(
      setpoint.pitch + rates.pitch * step,
      bounds.pitchMin,
      bounds.pitchMax,
    ),
    fov: clamp(setpoint.fov + rates.fov * step, bounds.fovMin, bounds.fovMax),
  };
  if (
    next.yaw === setpoint.yaw &&
    next.pitch === setpoint.pitch &&
    next.fov === setpoint.fov
  ) {
    return setpoint;
  }
  return next;
}
