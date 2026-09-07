// SCANsat's map-scanner experiments, CONTRIBUTED to Experiments.
//
// `science.instruments` is the STOCK experiment list. SCANsat runs its scanners
// through its own `SCANexperiment`/`IScienceDataContainer` module rather than
// the stock one, so none of them ever appear there, and the one widget whose
// whole subject is what science hardware is aboard could not see half a
// SCANsat vessel's.
//
// This hands Experiments the instruments it cannot observe for itself. The host
// draws the rows, counts them in its header and matches them against its own
// filter, so a SCANsat scanner reads exactly like a stock one.
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
 * match), so this is a straight nullable-wire -> plain-boolean normalisation:
 * `bool?` -> `=== true`, missing `partTitle`/`expId` -> a safe fallback,
 * entries with no `partId` skipped.
 *
 * The slot wants plain booleans rather than the wire's optionals, and this
 * Uplink can honour that outright: `deployed` and `inoperable` are always
 * `false` on the wire and `rerunnable` is always `true`, because a SCANsat map
 * experiment has no deploy or inoperable lifecycle and SCANsat hard-codes
 * `IsRerunnable()` (see `ScanScience.cs`'s own doc comment). So a SCANsat row's
 * DEPLOYED/INOPERABLE/ONE-SHOT badges never show; only DATA does.
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
    if (!entry || typeof entry !== "object" || Array.isArray(entry)) continue;
    const e = entry as Record<string, unknown>;
    const partId = typeof e.partId === "string" ? e.partId : null;
    if (partId === null) continue;
    out.push({
      partId,
      partTitle: typeof e.partTitle === "string" ? e.partTitle : "Unknown part",
      expId: typeof e.expId === "string" ? e.expId : "",
      deployed: e.deployed === true,
      hasData: e.hasData === true,
      rerunnable: e.rerunnable === true,
      inoperable: e.inoperable === true,
    });
  }
  return out;
}

/**
 * Exported because it is PURE, which makes it the cheapest thing here to test:
 * hand it a topics bag, assert the rows.
 *
 * There is no staleness to judge. A contribution is handed payloads rather than
 * `Reading`s, and how old a row is belongs to the host: it draws the rows, so it
 * is the one that can say.
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
