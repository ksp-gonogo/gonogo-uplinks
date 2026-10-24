import type { SlotProps } from "@ksp-gonogo/sitrep-sdk";
import {
  readingOf,
  registerAugment,
  useTelemetry,
} from "@ksp-gonogo/sitrep-sdk";
import { Cluster, Text, Unit } from "@ksp-gonogo/ui-kit";
import { readKerbalismScienceInstrumentExt } from "../science.js";
import { KERBALISM } from "../uplink.js";

/**
 * The `experiments.instrument` augment: how far a Kerbalism experiment has got
 * collecting its current subject, and how long a run needs to finish it.
 * Drawn under the instrument's row, only while the experiment is switched on
 * and Kerbalism reported both figures. The state itself (running, waiting and
 * why) is the row's own.
 */
function ExperimentProgressAugment({
  instrument,
}: SlotProps<"experiments.instrument">) {
  const reading = useTelemetry("science.instruments");
  if (reading.state !== "observed" && reading.state !== "held") return null;
  if (instrument.running !== true) return null;

  const entry = reading.value.find(
    (i) => i.partId === instrument.partId && i.experimentId === instrument.expId,
  );
  const ext = readKerbalismScienceInstrumentExt(entry);
  if (ext?.kind !== "experiment") return null;
  const progress = ext.progressFraction;
  const remaining = ext.secondsToComplete;
  if (progress == null && remaining == null) return null;

  return (
    <li aria-label={`${instrument.partTitle} collection progress`}>
      <Cluster wrap justify="start">
        {progress != null && (
          <Text size="xs" level="muted">
            Collected <Unit value={readingOf(reading, () => progress)} />
          </Text>
        )}
        {remaining != null && instrument.producing === true && (
          <Text size="xs" level="muted">
            To finish <Unit value={readingOf(reading, () => remaining)} />
          </Text>
        )}
      </Cluster>
    </li>
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
