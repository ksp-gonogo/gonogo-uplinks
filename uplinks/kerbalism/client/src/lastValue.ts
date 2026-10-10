import type { TopicCurrency } from "@ksp-gonogo/sitrep-sdk";

/**
 * The value a reading carries, observed or held, so a figure keeps drawing
 * while its Topic is stale. The entry it feeds passes the reading as `held`,
 * which is what marks the figure.
 */
export function lastValue<Payload>(
  reading: TopicCurrency<Payload>,
): Payload | undefined {
  return reading.state === "observed" || reading.state === "held"
    ? reading.value
    : undefined;
}
