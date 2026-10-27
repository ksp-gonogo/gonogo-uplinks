import type { ContributionEntry, TopicPayload } from "@ksp-gonogo/sitrep-sdk";
import { lastValue } from "../lastValue.js";
import { KERBALISM_TRANSMISSION_TOPIC } from "../topics.js";
import { KERBALISM } from "../uplink.js";

type LinkRateEntry = ContributionEntry<"comm-signal.link-rate">;

/**
 * The rate and target CommNet Signal draws for the craft's link, from what
 * Kerbalism reports. Pure and exported so a test can drive it against a plain
 * payload without the contribution registry.
 *
 * Nothing is drawn while Kerbalism reports no rate: a craft with no link, or a
 * relay it cannot see the rate of, has no rate to show, and a zero would claim
 * one. A target without a rate is not drawn alone, since the rate is what the
 * slot is for.
 */
export function kerbalismLinkRate(
  transmission: TopicPayload<"kerbalism.transmission"> | undefined,
  held?: LinkRateEntry["held"],
): LinkRateEntry[] | null {
  const rate = transmission?.dataRate?.magnitude;
  if (rate === undefined || !Number.isFinite(rate)) return null;
  const target = transmission?.target;
  return [
    {
      bitsPerSec: rate,
      ...(target ? { target } : {}),
      ...(held === undefined ? {} : { held }),
    },
  ];
}

/*
 * Left at the slot's default priority. A comms mod that models the link in more
 * detail registers above it, so the slot shows its rate whenever both are
 * installed, and this one fills it on a save running the stock network alone.
 */
KERBALISM.registerContribution({
  id: "comm-signal-link-rate",
  contributes: "comm-signal.link-rate",
  requires: "kerbalism",
  deps: [KERBALISM_TRANSMISSION_TOPIC],
  compute: (topics) =>
    kerbalismLinkRate(
      lastValue(topics[KERBALISM_TRANSMISSION_TOPIC]),
      topics[KERBALISM_TRANSMISSION_TOPIC],
    ),
});
