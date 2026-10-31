import type { SlotProps } from "@ksp-gonogo/sitrep-sdk";
import {
  readingOf,
  registerAugment,
  useTelemetry,
} from "@ksp-gonogo/sitrep-sdk";
import { Cluster, Text, Unit } from "@ksp-gonogo/ui-kit";
import {
  type KerbalismScienceInstrumentExt,
  readKerbalismScienceInstrumentExt,
} from "../science.js";
import { KERBALISM } from "../uplink.js";

/**
 * Science per game day an experiment is earning: its nominal data rate, scaled by
 * the share of it achieved, times the science per megabyte of its current
 * subject. A switched-off experiment earns a known zero whatever the last
 * achieved share was. Null when any figure the product needs was not given,
 * which is not the same as zero.
 */
function earningRate(
  running: boolean | null | undefined,
  ext: KerbalismScienceInstrumentExt,
) {
  const perSecond = ext.dataRateMBps;
  const perMegabyte = ext.sciencePerMB;
  if (perSecond == null || perMegabyte == null) return null;
  const nominal = perSecond.times(perMegabyte);
  if (running === false) return nominal.times(0).in("science/day");
  if (running !== true || ext.prodFactor == null) return null;
  return nominal.times(ext.prodFactor.magnitude).in("science/day");
}

/**
 * The `experiments.instrument` augment: the science a Kerbalism experiment is
 * earning and how long a run needs to finish its current subject. Drawn inside
 * the instrument's card. The earning rate is the nominal data rate times the
 * share of it achieved times the science each megabyte of the current subject is
 * worth, a known 0 while the experiment is switched off, and left out when the
 * game gave no current subject. Time to finish shows only while the experiment is
 * producing. The state itself (running, waiting and why) and how much of the
 * subject is collected are the row's own.
 */
function ExperimentProgressAugment({
  instrument,
}: SlotProps<"experiments.instrument">) {
  const reading = useTelemetry("science.instruments");
  if (reading.state !== "observed" && reading.state !== "held") return null;

  const entry = reading.value.find(
    (i) => i.partId === instrument.partId && i.experimentId === instrument.expId,
  );
  const ext = readKerbalismScienceInstrumentExt(entry);
  if (ext?.kind !== "experiment") return null;
  const remaining =
    instrument.running === true && instrument.producing === true
      ? ext.secondsToComplete
      : null;
  const earning = earningRate(instrument.running, ext);
  if (remaining == null && earning == null) return null;

  return (
    <Cluster
      wrap
      justify="start"
      role="group"
      aria-label={`${instrument.partTitle} earning rate`}
    >
      {earning != null && (
        <Text size="xs" level="muted">
          Earning <Unit value={readingOf(reading, () => earning)} />
        </Text>
      )}
      {remaining != null && (
        <Text size="xs" level="muted">
          To finish <Unit value={readingOf(reading, () => remaining)} />
        </Text>
      )}
    </Cluster>
  );
}

registerAugment({
  id: "experiments-instrument-progress",
  augments: "experiments.instrument",
  component: ExperimentProgressAugment,
  requires: "kerbalism",
  owner: KERBALISM,
});

export { ExperimentProgressAugment };
