import type { ContributionEntry, TopicPayload } from "@ksp-gonogo/sitrep-sdk";
import { COMMS_DATA_RATE_TOPIC } from "../topics.js";
import { REALANTENNAS } from "../uplink.js";

type LinkRateEntry = ContributionEntry<"comm-signal.link-rate">;

/**
 * The rate CommNet Signal draws for the craft's link: the downlink rate
 * RealAntennas works the link out at. Pure and exported so a test can drive it
 * against a plain payload without the contribution registry.
 *
 * RealAntennas names no target for the link, so none is given and the slot
 * draws its rate row alone.
 */
export function realAntennasLinkRate(
  rate: TopicPayload<"comms.dataRate"> | undefined,
): LinkRateEntry[] | null {
  const bits = rate?.downBitsPerSec?.magnitude;
  if (bits === undefined || !Number.isFinite(bits)) return null;
  return [{ bitsPerSec: bits }];
}

/*
 * Above the default priority, so with another Uplink also filling the slot this
 * one's rate is the one drawn: RealAntennas works the rate out from the link
 * budget and the other reads a simpler figure.
 *
 * Only a current observation is drawn. A rate held from before a gap asserts a
 * link that may be gone, and no published model carries it forward.
 */
REALANTENNAS.registerContribution({
  id: "comm-signal-link-rate",
  contributes: "comm-signal.link-rate",
  requires: "realantennas",
  priority: 2,
  deps: [COMMS_DATA_RATE_TOPIC],
  compute: (topics) => {
    const reading = topics[COMMS_DATA_RATE_TOPIC];
    return reading.state === "observed"
      ? realAntennasLinkRate(reading.value)
      : null;
  },
});
