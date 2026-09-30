import { value } from "@ksp-gonogo/sitrep-sdk";
import { magnitudeOf, type Severity, Unit } from "@ksp-gonogo/ui-kit";
import type { ReactNode } from "react";
import type {
  TestFlightReliabilityBudget,
  TestFlightReliabilityPart,
} from "../__generated__/contract.js";

const seconds = (magnitude: number) => value("s", magnitude);
const ratio = (magnitude: number) => value("ratio", magnitude);

/** What one noteworthy engine says: a severity, the badge word, and the sentence beside it. */
export interface Row {
  severity: Severity;
  word: string;
  clause: ReactNode;
}

/**
 * How far into a rated burn an engine has to be before it earns a row. Past its
 * rating TestFlight's failure chance starts climbing, so the row arrives with a
 * quarter of the rating still to go.
 */
export const BURN_ATTENTION = 0.75;

/** Below this survival chance an engine earns a row at all. */
export const SURVIVAL_ATTENTION = 0.95;

/** Below this it is a warning rather than a caution. A forward probability never justifies calling it failed. */
export const SURVIVAL_WARNING = 0.85;

/** The rated burn that has gone furthest past the attention line, if any has. */
function drivingBudget(
  part: TestFlightReliabilityPart,
): TestFlightReliabilityBudget | undefined {
  let best: TestFlightReliabilityBudget | undefined;
  let bestConsumed = -1;
  for (const budget of part.budgets ?? []) {
    const consumed = magnitudeOf(budget.consumed);
    if (consumed === null || consumed < BURN_ATTENTION) continue;
    if (consumed > bestConsumed) {
      best = budget;
      bestConsumed = consumed;
    }
  }
  return best;
}

/**
 * Whether this engine earns a row: a condition not plainly nominal, a rated burn
 * nearly spent, or a survival chance worth mentioning. An UNRECOGNISED condition
 * selects, and {@link rowFor} is total so it still renders.
 */
export function isNoteworthy(part: TestFlightReliabilityPart): boolean {
  if (part.condition !== "nominal") return true;
  if (drivingBudget(part)) return true;
  const survival = magnitudeOf(part.survival);
  return survival !== null && survival < SURVIVAL_ATTENTION;
}

/** "40 s of 255 s continuous rated burn left", or how far past the rating it has run. */
function burnRow(budget: TestFlightReliabilityBudget): Row {
  const label = budget.label ?? "rated burn";
  const used = magnitudeOf(budget.usedSeconds);
  const limit = magnitudeOf(budget.limitSeconds);
  if (used === null || limit === null) {
    return { severity: "warn", word: "wear", clause: `${label} nearly spent` };
  }
  if (used >= limit) {
    return {
      severity: "warn",
      word: "wear",
      clause: (
        <>
          past {label} rating by <Unit value={seconds(used - limit)} />
        </>
      ),
    };
  }
  return {
    severity: "warn",
    word: "wear",
    clause: (
      <>
        <Unit value={seconds(limit - used)} /> of{" "}
        <Unit value={seconds(limit)} /> {label} left
      </>
    ),
  };
}

/**
 * One row per noteworthy engine, first match wins, and TOTAL: every selected
 * engine renders something. TestFlight grades no failure above another, so a
 * failed engine is simply "failed", in its failures' own titles.
 */
export function rowFor(part: TestFlightReliabilityPart): Row {
  const detail = part.conditionDetail ?? undefined;

  if (part.condition === "failed") {
    return { severity: "nogo", word: "failed", clause: detail };
  }
  if (part.condition === "nominal") {
    const budget = drivingBudget(part);
    if (budget) return burnRow(budget);

    const survival = magnitudeOf(part.survival);
    const horizon = magnitudeOf(part.survivalHorizonSeconds);
    if (survival !== null && horizon !== null) {
      // The horizon is IN the sentence: a survival chance means nothing without the span it is over.
      return {
        severity: survival >= SURVIVAL_WARNING ? "caution" : "warn",
        word: "survival",
        clause: (
          <>
            <Unit value={ratio(survival)} /> to survive{" "}
            <Unit value={seconds(horizon)} /> of operation
          </>
        ),
      };
    }
    // Unreachable by construction; here so the table is total.
    return { severity: "caution", word: "wear", clause: undefined };
  }

  // "unknown", or any value never heard of: a condition we cannot interpret is not nominal.
  return { severity: "offline", word: "unreadable", clause: detail };
}
