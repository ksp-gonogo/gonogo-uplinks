import type { Reading, TopicReading, Value } from "@ksp-gonogo/sitrep-sdk";
import { deriveReading } from "@ksp-gonogo/sitrep-sdk";
import { magnitudeOf } from "@ksp-gonogo/ui-kit";
import type { PrincipiaPlan } from "./__generated__/contract.js";

/**
 * How long until the burn at `burnIndex` ignites, derived from the plan reading.
 *
 * To IGNITION, never to a node: Principia anchors a burn to its start. The
 * observation counts from the received edge; where a model carries the plan
 * past it, the model's figure counts from the craft's present and is drawn
 * beside it with the modelled mark. No value where the burn or its ignition
 * instant is unknown.
 */
export function untilIgnition(
  plan: TopicReading<PrincipiaPlan>,
  burnIndex: number | null,
  receivedUt: Value<"ut"> | undefined,
): Reading<Value<"s">> {
  const ignitionOf = (p: PrincipiaPlan): Value<"ut"> | undefined => {
    if (burnIndex === null) return undefined;
    const ignition = p.burns?.find(
      (burn) => magnitudeOf(burn.index) === burnIndex,
    )?.ignitionUt;
    return ignition?.isFinite() === true ? ignition : undefined;
  };
  return deriveReading(
    plan,
    (p) =>
      receivedUt === undefined ? undefined : ignitionOf(p)?.minus(receivedUt),
    (p, atUt) => ignitionOf(p)?.minus(atUt),
  );
}
