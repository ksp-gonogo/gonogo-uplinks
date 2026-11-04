import { useTelemetry, useViewUt } from "@ksp-gonogo/sitrep-sdk";
import { DataLine, magnitudeOf, Text } from "@ksp-gonogo/ui-kit";
import type { Rp1BuildItemEntry } from "../__generated__/contract.js";
import { useMissionTrainingEnabled } from "../CrewSchedule/retirementSetting.js";
import { current } from "../shared/current.js";
import { crewAtFinish } from "./crewAtFinish.js";

/**
 * How many of the kerbals holding mission training would still be trained, out
 * of any course and not retired when this vehicle finishes integrating, as a
 * "Crew free / trained" line reading "2/4". Useful for showing the operator
 * whether a crew is ready by the time the vehicle can go to the pad. Used by the
 * vehicle card of a build in progress.
 *
 * Draws nothing when RP-1 gives the vehicle no finish time, when RP-1 does not
 * schedule crew on this save or does not require mission training, and when no
 * kerbal holds mission training. It counts the crew's training only: the
 * schedule has no notion of which craft a training is for, and nothing here
 * says a kerbal is not already assigned to a flight.
 */
export function CrewAtFinishLine({
  build,
}: Readonly<{ build: Rp1BuildItemEntry }>) {
  const crew = current(useTelemetry("rp1.crew"));
  const enabled = useMissionTrainingEnabled();
  const now = magnitudeOf(useViewUt());
  const left = magnitudeOf(build.timeLeftSeconds);

  if (crew == null || enabled === false || now === null || left === null) {
    return null;
  }
  const { free, trained } = crewAtFinish(crew, now + left);
  if (trained === 0) {
    return null;
  }
  return (
    <DataLine label="Crew free / trained">
      <Text>{`${free}/${trained}`}</Text>
    </DataLine>
  );
}
