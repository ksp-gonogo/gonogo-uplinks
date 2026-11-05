import { magnitudeOf } from "@ksp-gonogo/ui-kit";
import type { Rp1CrewEntry } from "../__generated__/contract.js";

/** How many kerbals hold mission training, and how many of those are usable at one instant. */
export interface CrewAtFinish {
  readonly free: number;
  readonly trained: number;
}

/**
 * Of the kerbals RP-1 tracks that hold mission training, how many are still
 * trained, not retired and out of any course at `finishUt`.
 *
 * A kerbal counts when their soonest lapse and their retirement fall after
 * `finishUt` and any course they are on has a finish date at or before it. A
 * date RP-1 has not given never holds a kerbal back, except a course's: a
 * course with no finish date has not begun, so it cannot be done by then. The
 * count is conservative for a kerbal holding several trainings, because only
 * the soonest lapse is published.
 */
export function crewAtFinish(
  crew: readonly Rp1CrewEntry[],
  finishUt: number,
): CrewAtFinish {
  let trained = 0;
  let free = 0;
  for (const kerbal of crew) {
    const lapse = magnitudeOf(kerbal.nextTrainingExpiryUt);
    const held = magnitudeOf(kerbal.trainingExpiryCount);
    /* An unsent count is not zero: a lapse date is evidence the training exists. */
    const hasTraining = held === null ? lapse !== null : held >= 1;
    if (kerbal.retired === true || !hasTraining) {
      continue;
    }
    trained += 1;
    const retires = magnitudeOf(kerbal.retiresAtUt);
    const courseEnds = magnitudeOf(kerbal.trainingFinishesAtUt);
    const clearOfCourse =
      kerbal.trainingCourse == null ||
      (courseEnds !== null && courseEnds <= finishUt);
    if (
      clearOfCourse &&
      (lapse === null || lapse > finishUt) &&
      (retires === null || retires > finishUt)
    ) {
      free += 1;
    }
  }
  return { free, trained };
}
