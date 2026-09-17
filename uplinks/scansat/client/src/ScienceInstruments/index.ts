// SCANsat's map-scanner experiments, CONTRIBUTED to Experiments.
//
// `science.instruments` is the STOCK experiment list. SCANsat runs its scanners
// through its own `SCANexperiment`/`IScienceDataContainer` module rather than
// the stock one, so none of them ever appear there, and the one widget whose
// whole subject is what science hardware is aboard could not see half a
// SCANsat vessel's.
//
// This hands Experiments the instruments it cannot observe for itself. The host
// widget draws the rows, counts them in its header and matches them against
// its own filter, so a SCANsat scanner reads exactly like a stock one.
//
// It used to be an augment on `experiments.actions`, rendering ui-kit's science
// row into a floating list that the host panel's `overflow: hidden` clipped,
// with a count that could not join the widget's totals. What was missing was
// DATA rather than chrome, and a contribution is how that is said.
//
// Presence-gated on `requires: "scansat"`, so an install without the SCANsat
// mod contributes nothing.

import type {
  ContributionEntry,
  ContributionTopics,
} from "@ksp-gonogo/sitrep-sdk";
import { SCANSAT } from "../uplink.js";

/**
 * The row shape the slot takes, named through the generic because the concrete
 * interface (`ExperimentsInstrumentEntry`) is declared inside the sdk's
 * `api/contribution-slots` module, which the barrel imports for its declaration
 * merge and does not re-export.
 */
type InstrumentEntry = ContributionEntry<"experiments.instruments">;

/**
 * What this contribution reads, declared once because it is read twice: `deps`
 * feeds it to the aggregation, and `computeScanScienceInstruments` names it to
 * get the topics bag typed.
 */
const DEPS = ["scansat.science"] as const;

/** The bag `compute` is handed. Exported so a test can build one without respelling the deps. */
export type ScienceInstrumentTopics = ContributionTopics<
  "experiments.instruments",
  typeof DEPS
>;

/**
 * Parses `scansat.science` (`GonogoScansatUplink.ScanScienceEntry[]`, built by
 * `mod/GonogoScansatUplink/ScanScience.cs`) into the slot's row shape. Field
 * names already match it 1:1 (the mod-side builder deliberately names them to
 * match), so the flags are read straight and the strings fall back.
 *
 * The slot's four lifecycle flags are plain booleans with no third state: the
 * host widget draws a badge per flag, so there is nowhere on a row to put "nobody
 * read this". That is what made `=== true` a lie by construction rather than a
 * convenience, because it turns an absent flag into a definite OFF, and an
 * absent `rerunnable` in particular flips a SCANsat scanner's badge to
 * ONE-SHOT. So an entry that does not carry all four as real booleans is not
 * an entry in the shape this Uplink speaks, and the whole FRAME declines: no
 * row fabricates a badge, and no row goes quietly missing either, since a
 * short list drawn as complete is the same defect one rung along and the host
 * widget counts these rows in its own header.
 *
 * `null` is therefore "this frame is not readable", the answer this function
 * already gives for a payload that is not a list, and it stays distinct from
 * the empty list that means "this vessel carries no SCANsat scanners".
 *
 * Takes `unknown` rather than the decoded payload type because this is the one
 * place this Uplink decides what a malformed frame means, and a shape assertion
 * would put that decision somewhere nothing runs.
 */
export function parseScanScience(raw: unknown): InstrumentEntry[] | null {
  if (raw === null || raw === undefined) return null;
  if (!Array.isArray(raw)) return null;
  const out: InstrumentEntry[] = [];
  for (const entry of raw) {
    if (!entry || typeof entry !== "object" || Array.isArray(entry)) return null;
    const e = entry as Record<string, unknown>;
    // partId is the row's React key and the host widget's identity for it, so an
    // entry without one cannot be drawn at all.
    if (typeof e.partId !== "string") return null;
    if (
      typeof e.deployed !== "boolean" ||
      typeof e.hasData !== "boolean" ||
      typeof e.rerunnable !== "boolean" ||
      typeof e.inoperable !== "boolean"
    ) {
      return null;
    }
    out.push({
      partId: e.partId,
      partTitle: typeof e.partTitle === "string" ? e.partTitle : "Unknown part",
      expId: typeof e.expId === "string" ? e.expId : "",
      deployed: e.deployed,
      hasData: e.hasData,
      rerunnable: e.rerunnable,
      inoperable: e.inoperable,
    });
  }
  return out;
}

/**
 * Exported because it is PURE, which makes it the cheapest thing here to test:
 * hand it a topics bag, assert the rows.
 *
 * There is no staleness to judge. A contribution is handed payloads rather than
 * `Reading`s, and how old a row is belongs to the host widget: it draws the
 * rows, so it is the one that can say.
 */
export function computeScanScienceInstruments(
  topics: ScienceInstrumentTopics,
): readonly InstrumentEntry[] | null {
  return parseScanScience(topics["scansat.science"]);
}

SCANSAT.registerContribution({
  id: "science-instruments",
  contributes: "experiments.instruments",
  requires: "scansat",
  deps: DEPS,
  compute: computeScanScienceInstruments,
});
