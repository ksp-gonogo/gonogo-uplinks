import {
  type CelestialFacts,
  type ControlFrame,
  ControlFrameKind,
  type OrbitElements,
  solve,
} from "@ksp-gonogo/sitrep-sdk";
import {
  type LibrationAnswer,
  type LibrationOffset,
  type LibrationPair,
  type LibrationPoint,
  lagrangePointsAt,
  librationOffsetOf,
  type SystemInstant,
  toFrame,
  type Vec3Tuple,
} from "@ksp-gonogo/sitrep-sdk/frames";

/**
 * What a craft's state against its nearest point means: holding station on
 * it, drifting off it, or not station-keeping on it at all. `elsewhere` is not
 * a fault: a craft in low orbit is nearest some point in the arithmetic sense.
 */
export type LibrationStationKeeping = "on-station" | "drifting" | "elsewhere";

/** The SDK's geometric offset, with this module's station-keeping verdict on it. */
export type CraftOffset = Omit<LibrationOffset, "keeping"> & {
  keeping: LibrationStationKeeping;
};

export interface Resolved {
  answer: LibrationAnswer;
  /** `elsewhere` when the craft's velocity could not be placed in the frame. */
  offset: CraftOffset | null;
  station: LibrationStation | null;
}

/** A craft's root-centred inertial position, metres, and velocity, m/s. */
export interface VesselInertialState {
  position: Vec3Tuple;
  velocity: Vec3Tuple;
}

/**
 * The craft's root-centred inertial state, or null when it cannot be placed:
 * its elements solved about their body, plus that body's own state from the
 * same catalogue solve the frame is built on.
 */
export function vesselInertialAt(
  elements: OrbitElements | null,
  referenceBodyIndex: number | null | undefined,
  system: SystemInstant,
): VesselInertialState | null {
  if (elements === null || referenceBodyIndex == null) return null;
  if (!(elements.ecc >= 0 && elements.ecc < 1)) return null;
  const parent = system.positionByIndex.get(referenceBodyIndex);
  const parentVelocity = system.velocityByIndex.get(referenceBodyIndex);
  if (parent === undefined || parentVelocity === undefined) return null;
  const state = solve(elements, system.ut);
  return {
    position: [
      parent[0] + state.position[0],
      parent[1] + state.position[1],
      parent[2] + state.position[2],
    ],
    velocity: [
      parentVelocity[0] + state.velocity[0],
      parentVelocity[1] + state.velocity[1],
      parentVelocity[2] + state.velocity[2],
    ],
  };
}

/**
 * How far from a libration point its own neighbourhood reaches, metres. For L1
 * and L2 that is the point's distance from the secondary, about the
 * secondary's Hill radius. For L3, L4 and L5 it is the half-width of the
 * co-orbital region, `a·sqrt(8μ/3)`, the widest a tadpole or horseshoe orbit
 * about them swings across the track.
 */
export function librationRegionMetres(
  point: LibrationPoint,
  massRatio: number,
  separationMetres: number,
): number {
  if (point.name === "L1" || point.name === "L2") {
    return Math.abs(point.frame[0] - (1 - massRatio)) * separationMetres;
  }
  return Math.sqrt((8 * massRatio) / 3) * separationMetres;
}

/**
 * The in-plane frequency of small oscillations about a point, rad/s, from the
 * restricted three-body problem linearised there. For the collinear points it
 * is the oscillatory root of `λ⁴ + (2 - c₂)λ² + (1 + c₂ - 2c₂²) = 0`; for L4
 * and L5 it is the short-period root.
 */
export function librationFrequency(
  point: LibrationPoint,
  massRatio: number,
  meanMotion: number,
): number {
  const mu = massRatio;
  if (point.name === "L4" || point.name === "L5") {
    const root = Math.sqrt(Math.max(0, 1 - 27 * mu * (1 - mu)));
    return meanMotion * Math.sqrt((1 + root) / 2);
  }
  const x = point.frame[0];
  const c2 =
    (1 - mu) / Math.abs(x + mu) ** 3 + mu / Math.abs(x - 1 + mu) ** 3;
  return (
    meanMotion * Math.sqrt((2 - c2 + Math.sqrt(9 * c2 * c2 - 8 * c2)) / 2)
  );
}

/** What the craft's state against its nearest point amounts to, and the figures behind it. */
export interface LibrationStation {
  keeping: LibrationStationKeeping;
  /** The size of libration the craft's offset and velocity imply, metres. */
  excursionMetres: number;
  /** The point's neighbourhood, metres; see {@link librationRegionMetres}. */
  regionMetres: number;
  /** The craft's speed relative to the point in the pair's rotating frame, m/s. */
  relativeSpeed: number;
}

/**
 * Holding station, drifting, or not station-keeping on the point at all, from
 * the craft's offset AND velocity in the pair's rotating frame. The two fold
 * into one length, the excursion `sqrt(d² + (v/ω)²)`: the size of the
 * libration orbit that state is on, with `ω` the point's own oscillation
 * frequency. A craft passing through the point at speed has a large excursion
 * however small its offset. Holding station is an excursion within half the
 * point's neighbourhood, drifting is within the whole of it.
 */
export function librationStationOf(
  answer: LibrationAnswer,
  offset: Pick<LibrationOffset, "nearest" | "distanceMetres">,
  vessel: VesselInertialState,
): LibrationStation | null {
  const frame = answer.frame;
  const point = answer.points.find((p) => p.name === offset.nearest);
  if (frame === null || point === undefined) return null;
  const a = frame.unitLength;
  const [wx, wy, wz] = frame.angularVelocity;
  const meanMotion = Math.sqrt(wx * wx + wy * wy + wz * wz);
  if (!(a > 0) || !(meanMotion > 0)) return null;
  const inFrame = toFrame(frame, vessel.position, vessel.velocity);
  // The point stands still in the pulsating frame, so the craft's velocity there is its velocity relative to the point.
  const [vx, vy, vz] = inFrame.velocity;
  const relativeSpeed = Math.sqrt(vx * vx + vy * vy + vz * vz) * a;
  const omega = librationFrequency(point, answer.massRatio, meanMotion);
  const regionMetres = librationRegionMetres(point, answer.massRatio, a);
  if (
    !Number.isFinite(relativeSpeed) ||
    !(omega > 0) ||
    !(regionMetres > 0)
  ) {
    return null;
  }
  const drift = relativeSpeed / omega;
  const excursionMetres = Math.sqrt(
    offset.distanceMetres * offset.distanceMetres + drift * drift,
  );
  const keeping: LibrationStationKeeping =
    excursionMetres <= regionMetres / 2
      ? "on-station"
      : excursionMetres <= regionMetres
        ? "drifting"
        : "elsewhere";
  return { keeping, excursionMetres, regionMetres, relativeSpeed };
}

export function resolveFor(
  facts: CelestialFacts | undefined,
  secondaryIndex: number | null,
  ut: number,
  system: SystemInstant | null,
  vessel: VesselInertialState | null,
): Resolved {
  const answer = lagrangePointsAt(
    facts,
    secondaryIndex,
    ut,
    system ?? undefined,
  );
  const offset = librationOffsetOf(answer, vessel?.position);
  if (offset === null || vessel === null) {
    return { answer, offset: null, station: null };
  }
  const station = librationStationOf(answer, offset, vessel);
  return {
    answer,
    offset: { ...offset, keeping: station?.keeping ?? "elsewhere" },
    station,
  };
}

/**
 * The pair a rotating Control Frame turns with, as the secondary's index, or
 * null when the frame names no pair or names one the catalogue has no
 * libration points for. Both heads must match a candidate: a frame turning
 * two bodies that are not parent and child has no five points to follow. The
 * target frame arrives with no kind, so the kind check already excludes it.
 */
export function controlFramePair(
  frame: ControlFrame | null | undefined,
  candidates: readonly LibrationPair[],
): number | null {
  if (frame == null) return null;
  if (
    frame.kind !== ControlFrameKind.BarycentricRotating &&
    frame.kind !== ControlFrameKind.RotatingPulsating
  ) {
    return null;
  }
  const pair = candidates.find(
    (p) =>
      p.secondaryName === frame.secondaryBody &&
      p.primaryName === frame.primaryBody,
  );
  return pair?.secondaryIndex ?? null;
}

/**
 * The pair `"auto"` picks. The live Control Frame's pair first, when it turns
 * with one of the candidates, since the operator has already chosen that view
 * in game. Otherwise the nearest as a fraction of each pair's own separation,
 * since in metres the widest pair would win almost everywhere. With no craft,
 * the craft's own body if it can be half of a pair, then the catalogue's
 * first pair.
 */
export function autoPair(
  facts: CelestialFacts | undefined,
  candidates: readonly LibrationPair[],
  ut: number,
  system: SystemInstant | null,
  vessel: VesselInertialState | null,
  vesselBodyIndex: number | null | undefined,
  controlFrame?: ControlFrame | null,
): number | null {
  if (candidates.length === 0) return null;
  const followed = controlFramePair(controlFrame, candidates);
  if (followed !== null) return followed;
  if (vessel !== null && system !== null) {
    let best: { index: number; units: number } | null = null;
    for (const pair of candidates) {
      const { offset } = resolveFor(
        facts,
        pair.secondaryIndex,
        ut,
        system,
        vessel,
      );
      if (offset === null) continue;
      if (best === null || offset.distanceUnits < best.units) {
        best = { index: pair.secondaryIndex, units: offset.distanceUnits };
      }
    }
    if (best !== null) return best.index;
  }
  const own = candidates.find((p) => p.secondaryIndex === vesselBodyIndex);
  return own?.secondaryIndex ?? candidates[0].secondaryIndex;
}
