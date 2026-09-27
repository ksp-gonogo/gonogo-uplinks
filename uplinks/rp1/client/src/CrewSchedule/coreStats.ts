import type {
  ContributionEntry,
  Reading,
  TopicPayload,
  TopicReading,
} from "@ksp-gonogo/sitrep-sdk";
import { value } from "@ksp-gonogo/sitrep-sdk";
import { magnitudeOf } from "@ksp-gonogo/ui-kit";
import type { Rp1CrewEntry, Rp1CrewProgram } from "../__generated__/contract.js";
import { RP1 } from "../uplink.js";
import "../topics.js";

/**
 * What RP-1 considers as core about the Astronaut Complex as funds, the hire
 * price and the roster cap.
 *
 * <para>Those three are the whole of what STOCK has to say about a complex, and
 * they are the whole of what the host widget's own strip carries. Under RP-1 the
 * complex is a scheduling problem: the number an operator wants first is how
 * much of the roster is unavailable because it is mid-course, and the second is
 * how many qualifications are about to expire out from under a crew that is
 * currently assigned. Neither is derivable from the stock roster, and neither
 * belongs in the vanilla widget's own code.</para>
 *
 * <para><b>Data, not React.</b> These are `StatEntry` rows on the host widget's
 * `astronaut-complex.readouts` contribution slot, so it draws them with its own
 * `Stat` in its own grid and a figure of RP-1's lands in the same row and the
 * same treatment as the vanilla three. An augment would have rendered its own
 * markup into a slot beside them, which is how a strip ends up reading as two
 * widgets sharing a line.</para>
 *
 * <para><b>The settings are HONOURED, not reported.</b> A save with mission
 * training switched off has no perishable training at all: RP-1 stops checking
 * it, so a lapse count there is a number about a mechanic nobody is running.
 * The cell is absent rather than reading zero.</para>
 */
type StatEntry = ContributionEntry<"astronaut-complex.readouts">;

/**
 * The courses line under the in-training count.
 *
 * <para>Unstarted courses are called out because RP-1 lets a course sit enrolled
 * and unstarted indefinitely, and the difference decides whether the crew on it
 * are actually becoming available on a schedule. Silent when every course has
 * begun, which is the ordinary case and needs no sentence.</para>
 */
function coursesDetail(
  program: Rp1CrewProgram | undefined,
): string | undefined {
  const courses = magnitudeOf(program?.courses);
  if (courses === null || courses === 0) return undefined;
  const noun = courses === 1 ? "course" : "courses";
  const started = magnitudeOf(program?.coursesStarted);
  if (started === null || started >= courses) return `${courses} ${noun}`;
  return `${courses} ${noun} · ${courses - started} not started`;
}

/** Kerbals holding a mission training with a date on it. */
function lapsingCrew(crew: readonly Rp1CrewEntry[]): number {
  return crew.filter((c) => magnitudeOf(c.nextTrainingExpiryUt) !== null)
    .length;
}

/** Joins a figure's qualifier with the held note, either of which may be absent. */
function withHeld(detail: string | undefined, held: boolean) {
  if (!held) return detail;
  return detail === undefined
    ? HELD_DETAIL
    : `${detail} · ${HELD_DETAIL}`;
}

// A stat's value is a bare quantity, so the kit cannot mark a held one itself.
const HELD_DETAIL = "HELD";

export function crewCoreStats(
  program: Rp1CrewProgram | undefined,
  crew: readonly Rp1CrewEntry[] | undefined,
  held: { program: boolean; crew: boolean } = { program: false, crew: false },
): readonly StatEntry[] {
  const stats: StatEntry[] = [];

  const inTraining = magnitudeOf(program?.crewInTraining);
  if (inTraining !== null) {
    stats.push({
      id: "in-training",
      label: "In Training",
      value: value("count", inTraining),
      detail: withHeld(coursesDetail(program), held.program),
    });
  }

  // An absent roster is a reading that has not arrived, which is not a career
  // with nothing lapsing: an empty crew array IS that career, and says zero.
  if (crew !== undefined && program?.missionTrainingEnabled !== false) {
    const lapsing = lapsingCrew(crew);
    stats.push({
      id: "training-lapsing",
      label: "Training Lapsing",
      value: value("count", lapsing),
      detail: withHeld(undefined, held.crew),
      // Toned only when there is something to act on. A permanent amber zero
      // is an alarm about nothing, and it spends the emphasis the strip needs
      // for the case where the figure is real.
      tone: lapsing > 0 ? "warn" : "neutral",
    });
  }

  return stats;
}

function lastValue<T>(
  reading: TopicReading<T> | Reading<T> | undefined,
): T | undefined {
  return reading?.state === "observed" || reading?.state === "stale"
    ? reading.value
    : undefined;
}

/*
 * The two channels with their currency, since a contribution's own topic deps
 * arrive as bare payloads and a stat cannot carry a reading.
 */
const CREW_READING = RP1.registerProcessor({
  id: "crew-reading",
  deps: [{ reading: "rp1.crew" }] as const,
  compute: ([reading]: readonly [TopicReading<TopicPayload<"rp1.crew">>]) =>
    lastValue(reading),
});

const CREW_PROGRAM_READING = RP1.registerProcessor({
  id: "crew-program-reading",
  deps: [{ reading: "rp1.crewProgram" }] as const,
  compute: ([reading]: readonly [
    TopicReading<TopicPayload<"rp1.crewProgram">>,
  ]) => lastValue(reading),
});

RP1.registerContribution({
  id: "crew-core-stats",
  contributes: "astronaut-complex.readouts",
  deps: [CREW_READING, CREW_PROGRAM_READING],
  /*
   * The domain gate rather than a dep on `rp1.available`: the aggregation
   * subscribes it itself for anything naming `requires`, so the cells appear and
   * disappear with RP-1 while this stays a plain function of the two channels.
   */
  requires: "rp1",
  compute: (topics) => {
    const program = topics[CREW_PROGRAM_READING.id];
    const crew = topics[CREW_READING.id];
    return crewCoreStats(lastValue(program), lastValue(crew), {
      program: program?.state === "stale",
      crew: crew?.state === "stale",
    });
  },
});
