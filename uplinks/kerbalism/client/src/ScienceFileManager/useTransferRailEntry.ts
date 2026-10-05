import type { ExperimentEntry, TopicReading } from "@ksp-gonogo/sitrep-sdk";
import { useTelemetry } from "@ksp-gonogo/sitrep-sdk";
import { useRailEntry } from "@ksp-gonogo/ui-kit";
import { useRef } from "react";
import type { KerbalismScienceExperimentExt } from "../science.js";
import {
  EMPTY_TRANSFER_TRACE,
  foldTransferObservation,
  KERBALISM_TRANSFER_TAGS,
  TRANSFER_STEP_SECONDS,
  type TransferTrace,
  transferAmplitudes,
  transferTraceVisible,
} from "./transferTrace.js";

/**
 * Put one file's data transfer on the nearest panel's delay rail.
 *
 * Fed only by `observed` readings of the drive, each folded in at the UT it was
 * read. A held reading adds nothing, so a quiet link leaves the trace where the
 * last arrival left it rather than extending it, and a rate Kerbalism did not
 * report is never drawn as idle.
 */
export function useTransferRailEntry(
  experimentsReading: TopicReading<ExperimentEntry[]>,
  file: KerbalismScienceExperimentExt | undefined,
  subjectId: string,
  label: string,
): void {
  const delay = useTelemetry("comms.delay");
  const oneWaySeconds =
    delay.state === "observed"
      ? (delay.value.oneWaySeconds?.magnitude ?? null)
      : null;

  const trace = useRef<TransferTrace>(EMPTY_TRANSFER_TRACE);
  const lastFolded = useRef<unknown>(null);
  if (
    experimentsReading.state === "observed" &&
    lastFolded.current !== experimentsReading
  ) {
    lastFolded.current = experimentsReading;
    trace.current = file
      ? foldTransferObservation(
          trace.current,
          experimentsReading.atUt.magnitude,
          file.transmitRateMBps?.magnitude ?? null,
          file.transmitting ?? null,
        )
      : trace.current;
  }

  const current = trace.current;
  const ribbonLabel = `${label} transferring to the ground`;
  useRailEntry(
    transferTraceVisible(current)
      ? {
          inFlight: [],
          tags: KERBALISM_TRANSFER_TAGS,
          effectiveDelaySeconds: oneWaySeconds,
          ariaLabel: ribbonLabel,
          ribbons: [
            {
              id: `kerbalism.transfer.${subjectId}`,
              label: ribbonLabel,
              oneWaySeconds,
              amplitudes: transferAmplitudes(current),
              ...(oneWaySeconds === null
                ? {}
                : { spanSamples: oneWaySeconds / TRANSFER_STEP_SECONDS }),
              tags: KERBALISM_TRANSFER_TAGS,
            },
          ],
        }
      : null,
  );
}
