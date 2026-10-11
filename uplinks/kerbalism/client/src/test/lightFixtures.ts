import type { TopicPayload } from "@ksp-gonogo/sitrep-sdk";
import { value } from "@ksp-gonogo/sitrep-sdk";

export type Orbit = TopicPayload<"vessel.orbit">;
type Bodies = TopicPayload<"system.bodies">;

export const HOME_MU = 3.5316e12;
export const HOME_RADIUS = 600_000;
const STAR_MU = 1.1723328e18;
export const HOME_ORBIT_SMA = 13_599_840_256;

/** A star at the root and one planet on a circular orbit, placed at UT 0 on the +x axis from the star. */
export const BODIES = {
  bodies: [
    { index: 0, name: "Sun", gravParameter: value("m³/s²", STAR_MU) },
    {
      index: 1,
      name: "Home",
      parentIndex: 0,
      radius: value("m", HOME_RADIUS),
      gravParameter: value("m³/s²", HOME_MU),
      orbit: {
        sma: value("m", HOME_ORBIT_SMA),
        ecc: value("m", 0),
        inc: value("m", 0),
        lan: value("m", 0),
        argPe: value("m", 0),
        meanAnomalyAtEpoch: value("m", 0),
        epoch: value("m", 0),
      },
    },
  ],
} as unknown as Bodies;

export function circular(
  sma: number,
  meanAnomalyAtEpoch: number,
  overrides: Record<string, unknown> = {},
): Orbit {
  return {
    referenceBodyIndex: 1,
    sma: value("m", sma),
    ecc: value("1", 0),
    inc: value("deg", 0),
    lan: value("deg", 0),
    argPe: value("deg", 0),
    meanAnomalyAtEpoch: value("rad", meanAnomalyAtEpoch),
    epoch: value("ut", 0),
    mu: value("m³/s²", HOME_MU),
    ...overrides,
  } as unknown as Orbit;
}

export const period = (sma: number) =>
  2 * Math.PI * Math.sqrt(sma ** 3 / HOME_MU);
