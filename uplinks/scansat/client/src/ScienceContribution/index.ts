// SCANsat's science instruments, supplied to Experiments as a CONTRIBUTION.
//
// SCANsat manages its own experiment parts through
// `SCANexperiment`/`IScienceDataContainer`, so they never appear on
// `sci.instruments`, the stock experiment list Experiments reads. Without this
// they are invisible to the one widget whose whole subject is what science
// hardware is aboard.
//
// A CONTRIBUTION rather than an augment, because what is missing is DATA and
// not chrome. Experiments already knows how to draw an instrument row, group it
// by experiment, count it in the header totals and match it against the row
// filter, and it now offers `experiments.instruments` for exactly this: hand it
// the instruments, it draws them with its own row.
//
// What that replaced, and why it had to go: this used to be an augment on
// `experiments.actions`, the once-per-widget HEADER segment, which is a flex
// row beside the panel title. A row list cannot sit there, so it shipped a
// collapsed count badge that opened a floating list, and that list was clipped
// by the panel's own `overflow: hidden` before any z-index was consulted. The
// count could not be added to the widget's totals and the rows could not be
// reached by its filter, because an augment renders into a slot and takes no
// part in the host's own arithmetic.
//
// Nothing here imports a row component any more, which is the other half of the
// point: the row lives in `@ksp-gonogo/components` beside the widget that owns
// it, where an Uplink cannot reach it and no longer needs to.
//
// Presence-gated on `requires: "scansat"`, unchanged: an install without the
// SCANsat mod contributes nothing, so Experiments renders exactly as it does
// today for a non-SCANsat user.

import type { ContributionEntry } from "@ksp-gonogo/sitrep-sdk";
import { SCANSAT } from "../uplink";

/**
 * One instrument this Uplink supplies, structurally the slot's own entry.
 *
 * Written out here rather than aliased to
 * `ContributionEntry<"experiments.instruments">` so the parser below has a
 * PRECISE return type to be tested against: the slot is declared by the host,
 * and until an sdk carrying that declaration is published the alias resolves to
 * the undeclared-slot fallback (`Record<string, unknown>`), which types nothing.
 * `compute` returns these through the alias, so the assignability is checked in
 * whichever direction the installed sdk can check it.
 */
type ScanInstrument = {
  partId: string;
  partTitle: string;
  expId: string;
  deployed: boolean;
  hasData: boolean;
  rerunnable: boolean;
  inoperable: boolean;
};

/**
 * Parses `scansat.science` (`GonogoScansatUplink.ScanScienceEntry[]`, built by
 * `mod/ScanScience.cs`). Field names already match the slot's entry shape 1:1
 * (the mod-side builder deliberately names them to match), so this is a
 * straight nullable-wire -> plain-boolean normalisation, the same pattern as
 * Experiments's own `parseInstruments`: `bool?` -> `=== true`, missing
 * `partTitle`/`expId` -> a safe fallback, entries with no `partId` skipped.
 *
 * `deployed` and `inoperable` are always `false` on the wire and `rerunnable`
 * is always `true` (SCANsat map experiments have no deploy or inoperable
 * lifecycle, and SCANsat hard-codes `IsRerunnable()`, see `ScanScience.cs`'s own
 * doc comment), so a SCANsat row's DEPLOYED/INOPERABLE/ONE-SHOT badges never
 * show; only DATA does. Those three are still stated rather than omitted,
 * because the slot's booleans are the instrument's lifecycle and "no such
 * lifecycle" is said by declaring it, not by leaving a field out.
 */
export function parseScanScience(raw: unknown): ScanInstrument[] | null {
  if (raw === null || raw === undefined) return null;
  if (!Array.isArray(raw)) return null;
  const out: ScanInstrument[] = [];
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

SCANSAT.registerContribution<"experiments.instruments">({
  id: "science-instruments",
  contributes: "experiments.instruments",
  deps: ["scansat.science"],
  requires: "scansat",
  compute: (topics): readonly ContributionEntry<"experiments.instruments">[] =>
    parseScanScience(topics["scansat.science"]) ?? [],
});
