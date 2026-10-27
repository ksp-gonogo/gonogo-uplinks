import type { ContributionEntry, TopicPayload } from "@ksp-gonogo/sitrep-sdk";
import { lastValue } from "../lastValue.js";
import { KERBALISM_TRANSMISSION_TOPIC } from "../topics.js";
import { KERBALISM } from "../uplink.js";

type ReadoutEntry = ContributionEntry<"science-data.archive-readouts">;

/**
 * The stat the Science Data widget draws above its Archive table: the science
 * Kerbalism says the craft has transmitted. Pure and exported so a test can drive
 * it against a plain payload without the contribution registry.
 *
 * A total Kerbalism did not report draws nothing rather than a zero, since an
 * unread total is not a total of nothing.
 */
export function scienceTransmittedReadouts(
  transmission: TopicPayload<"kerbalism.transmission"> | undefined,
  held?: ReadoutEntry["held"],
): ReadoutEntry[] | null {
  const total = transmission?.scienceTransmitted;
  if (total == null) return null;
  return [
    {
      id: "science-transmitted",
      label: "Transmitted",
      value: total,
      ...(held === undefined ? {} : { held }),
    },
  ];
}

KERBALISM.registerContribution({
  id: "science-transmitted",
  contributes: "science-data.archive-readouts",
  requires: "kerbalism",
  deps: [KERBALISM_TRANSMISSION_TOPIC],
  compute: (topics) =>
    scienceTransmittedReadouts(
      lastValue(topics[KERBALISM_TRANSMISSION_TOPIC]),
      topics[KERBALISM_TRANSMISSION_TOPIC],
    ),
});
