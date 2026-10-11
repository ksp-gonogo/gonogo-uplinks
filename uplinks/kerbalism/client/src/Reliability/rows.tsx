import { value } from "@ksp-gonogo/sitrep-sdk";
import { magnitudeOf, type Severity, Unit } from "@ksp-gonogo/ui-kit";
import type { ReactNode } from "react";
import type {
  KerbalismReliabilityBudget,
  KerbalismReliabilityPart,
} from "../__generated__/contract.js";

const seconds = (magnitude: number) => value("s", magnitude);

/** What one noteworthy part says: a severity, the badge word, and the sentence beside it. */
export interface Row {
  severity: Severity;
  word: string;
  clause: ReactNode;
}

/**
 * How far into its service clock a part has to be before it earns a row.
 * Nothing breaks at the line (Kerbalism only rolls for a failure once service
 * falls due), so the row arrives just before it rather than a quarter early.
 */
export const SERVICE_ATTENTION = 0.9;

/** The service clock, which is the only budget Kerbalism counts. */
function serviceBudget(
  part: KerbalismReliabilityPart,
): KerbalismReliabilityBudget | undefined {
  return (part.budgets ?? []).find((budget) => budget.kind === "schedule");
}

/**
 * Whether this part earns a row: a condition not plainly nominal, or a service
 * clock nearly run down. An UNRECOGNISED condition selects, and {@link rowFor}
 * is total so it still renders.
 */
export function isNoteworthy(part: KerbalismReliabilityPart): boolean {
  if (part.condition !== "nominal") return true;
  const consumed = magnitudeOf(serviceBudget(part)?.consumed);
  return consumed !== null && consumed >= SERVICE_ATTENTION;
}

/** "due in" or "overdue by", off the clock's own seconds, or nothing when they are not both there. */
function serviceClause(
  budget: KerbalismReliabilityBudget | undefined,
): ReactNode | undefined {
  const used = magnitudeOf(budget?.usedSeconds);
  const limit = magnitudeOf(budget?.limitSeconds);
  if (used === null || limit === null) return undefined;
  const label = budget?.label ?? "service";
  if (used >= limit) {
    return (
      <>
        {label} overdue by <Unit value={seconds(used - limit)} />
      </>
    );
  }
  return (
    <>
      {label} due in <Unit value={seconds(limit - used)} />
    </>
  );
}

/** Kerbalism's own word first, then the clock: "needs service · service overdue by 3d". */
function joined(
  detail: string | undefined,
  rest: ReactNode | undefined,
): ReactNode {
  if (detail && rest) {
    return (
      <>
        {detail} · {rest}
      </>
    );
  }
  return rest ?? detail;
}

/**
 * One row per noteworthy part, first match wins, and TOTAL: every selected
 * part renders something.
 *
 * A service-due part never shows a future countdown on its own: an EVA
 * inspection that finds a part worn makes it due NOW whatever its clock says,
 * so only an overdue clock is quoted beside the word.
 */
export function rowFor(part: KerbalismReliabilityPart): Row {
  const detail = part.conditionDetail ?? undefined;

  if (part.condition === "failed-critical") {
    return { severity: "nogo", word: "critical failure", clause: detail };
  }
  if (part.condition === "failed") {
    return { severity: "nogo", word: "failed", clause: detail };
  }
  if (part.condition === "service-due") {
    const budget = serviceBudget(part);
    const consumed = magnitudeOf(budget?.consumed);
    const overdue =
      consumed !== null && consumed >= 1 ? serviceClause(budget) : undefined;
    return {
      severity: "caution",
      word: "service due",
      clause: joined(detail, overdue),
    };
  }
  if (part.condition === "nominal") {
    return {
      severity: "caution",
      word: "service soon",
      clause: serviceClause(serviceBudget(part)),
    };
  }

  // "unknown", or any value never heard of: a condition we cannot interpret is not nominal.
  return { severity: "offline", word: "unreadable", clause: detail };
}
