import type { TopicPayload } from "@ksp-gonogo/sitrep-sdk";
import {
  bodyAtIndex,
  buildElements,
  deriveCelestialFacts,
  poseAtIndex,
  propagateVesselOrbit,
  systemPosesAt,
} from "@ksp-gonogo/sitrep-sdk";

type Orbit = TopicPayload<"vessel.orbit">;
type Bodies = TopicPayload<"system.bodies">;

/** Samples taken across one revolution to find the first crossing. */
const SAMPLES_PER_REVOLUTION = 720;
/** Bisection steps once a crossing is bracketed: well under a millisecond for any orbit. */
const BISECTION_STEPS = 40;

export interface LightChange {
  /** Seconds from the anchor to the craft's next move between sunlight and shadow. */
  readonly seconds: number;
  /** What the craft does at that moment. */
  readonly enters: "shadow" | "sunlight";
}

type Vec3 = readonly [number, number, number];

/**
 * Whether a craft at `position` (relative to its body, metres) sits in the
 * body's shadow, treated as a cylinder of the body's radius pointing away from
 * the star along `sunward`, a unit vector from the body towards the star.
 */
function inShadow(position: Vec3, sunward: Vec3, radius: number): boolean {
  const along =
    position[0] * sunward[0] +
    position[1] * sunward[1] +
    position[2] * sunward[2];
  if (along >= 0) return false;
  const px = position[0] - along * sunward[0];
  const py = position[1] - along * sunward[1];
  const pz = position[2] - along * sunward[2];
  return Math.hypot(px, py, pz) < radius;
}

/**
 * When the craft next crosses between sunlight and its parent body's shadow,
 * counted from `anchorUt`, or `null` when no such crossing can be shown.
 *
 * Used by the consumable-rate reckoner of `vessel.resources` to end a held net
 * rate at the moment solar charging starts or stops, instead of at a flat
 * span. Nothing is shown for an orbit around the star itself, an open orbit,
 * one that dips into the body, a body or star position the catalogue cannot
 * place, or a closed orbit that stays in one state for a whole revolution (no
 * crossing recurs within the sun's slow drift).
 *
 * The star's direction is taken from the body's catalogue position at the
 * anchor and held fixed across one revolution.
 */
export function nextLightChange(
  orbit: Orbit | null | undefined,
  bodies: Bodies | null | undefined,
  anchorUt: number,
): LightChange | null {
  if (orbit == null || bodies?.bodies == null) return null;
  const facts = deriveCelestialFacts(bodies.bodies);
  const body = bodyAtIndex(facts, orbit.referenceBodyIndex);
  const radius = body?.radius;
  if (body == null || radius == null || !(radius > 0)) return null;

  const pose = poseAtIndex(
    systemPosesAt(facts, anchorUt, null),
    orbit.referenceBodyIndex,
  );
  if (pose?.position == null || pose.currency === "withdrawn") return null;
  const [bx, by, bz] = pose.position;
  const distance = Math.hypot(bx, by, bz);
  if (!(distance > 0)) return null;
  const sunward: Vec3 = [-bx / distance, -by / distance, -bz / distance];

  const elements = buildElements(orbit);
  const { sma, ecc, mu } = elements;
  if (![sma, ecc, mu].every(Number.isFinite) || ecc >= 1 || sma <= 0) {
    return null;
  }
  if (sma * (1 - ecc) <= radius) return null;
  const period = 2 * Math.PI * Math.sqrt((sma * sma * sma) / mu);
  if (!(period > 0)) return null;

  const shadowedAt = (ut: number): boolean | null => {
    const state = propagateVesselOrbit(orbit, ut);
    return state === null ? null : inShadow(state.position, sunward, radius);
  };

  const start = shadowedAt(anchorUt);
  if (start === null) return null;
  const step = period / SAMPLES_PER_REVOLUTION;
  for (let i = 1; i <= SAMPLES_PER_REVOLUTION; i++) {
    const ut = anchorUt + i * step;
    const here = shadowedAt(ut);
    if (here === null) return null;
    if (here === start) continue;
    let lo = ut - step;
    let hi = ut;
    for (let n = 0; n < BISECTION_STEPS; n++) {
      const mid = (lo + hi) / 2;
      if (shadowedAt(mid) === start) lo = mid;
      else hi = mid;
    }
    return { seconds: hi - anchorUt, enters: start ? "sunlight" : "shadow" };
  }
  return null;
}
