#!/usr/bin/env node
/**
 * The Uplink CI matrix, DISCOVERED from `uplinks/*` rather than hand-listed.
 *
 * Ported from `gonogo`'s `scripts/uplink-matrix.mjs`, which carries the reason
 * this shape matters: a hand-maintained list has no gate on its own
 * completeness, and that repo was bitten by it five times. Adding an Uplink here
 * is adding a directory, and no CI file changes.
 *
 * ## The floor is the whole point
 *
 * A discovery walk that matches nothing emits an empty matrix, GitHub Actions
 * skips the job, and a skipped matrix job reports as SUCCESSFUL. So the floor is
 * not a nicety: without it, breaking the walk turns every Uplink's CI green at
 * once. It is set below the current count so a deliberate removal does not trip
 * it, and far above zero so a broken walk does.
 *
 * ## Capability facts are computed HERE, from disk
 *
 * The Uplinks are ragged: one may be mod-only, another client-only, another
 * without a contract slice. A uniform matrix running every step everywhere
 * no-ops on the cells that do not apply and reports green, which is the failure
 * this exists to stop. A GitHub Actions `if:` is a string comparison against a
 * matrix value, so a condition that can never match reports as a correctly
 * skipped step. The facts are therefore emitted per leg, and a leg with no
 * applicable step FAILS rather than passing quietly.
 *
 * ## The Uplink declares its own CI contract
 *
 * `uplinks/<name>/uplink.json` carries the id, the parent mod, its CKAN
 * identifier and the version it was built against. CI reads it; CI never knows
 * about a particular Uplink. A central list of Uplink names in a workflow file
 * is the thing this repo exists to not have.
 *
 * Usage:
 *   node scripts/uplink-matrix.mjs             pretty JSON, for a human
 *   node scripts/uplink-matrix.mjs --github    `matrix=<json>` for $GITHUB_OUTPUT
 *   node scripts/uplink-matrix.mjs --ids       one id per line
 */

import { existsSync, readdirSync, readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
const UPLINKS = join(ROOT, "uplinks");

/** See the header: set below the current count, far enough above zero to catch a broken walk. */
const FLOOR = 1;

const readJson = (path) => {
  try {
    return JSON.parse(readFileSync(path, "utf8"));
  } catch {
    return null;
  }
};

const legs = readdirSync(UPLINKS, { withFileTypes: true })
  .filter((entry) => entry.isDirectory())
  .map((entry) => entry.name)
  .sort()
  .map((name) => {
    const dir = join(UPLINKS, name);
    const declared = readJson(join(dir, "uplink.json"));
    const clientManifest = readJson(join(dir, "client", "package.json"));
    const scripts = Object.keys(clientManifest?.scripts ?? {});
    const csproj = (subdir) => {
      const path = join(dir, subdir);
      if (!existsSync(path)) return "";
      const found = readdirSync(path).find((f) => f.endsWith(".csproj"));
      return found ? `uplinks/${name}/${subdir}/${found}` : "";
    };
    return {
      name,
      /** The id the client and the C# `[SitrepUplink]` attribute must agree on. */
      id: declared?.id ?? "",
      /** Read from uplink.json, never from a list in a workflow. See the header. */
      mod: declared?.mod ?? null,
      pkg: clientManifest?.name ?? "",
      client: clientManifest !== null,
      mod_csproj: csproj("mod"),
      contract_csproj: csproj("mod-contract"),
      codegen_csproj: csproj("mod-contract-codegen"),
      tests_csproj: csproj("mod-tests"),
      typecheck: scripts.includes("typecheck"),
      test: scripts.includes("test"),
      bundle: clientManifest !== null,
      docs_check: scripts.includes("docs:check"),
    };
  });

if (legs.length < FLOOR) {
  console.error(
    `✖ discovery found ${legs.length} Uplink(s) under ${UPLINKS}, expected at least ${FLOOR}.\n` +
      "  An empty matrix makes GitHub Actions skip the job, and a skipped matrix job reports as\n" +
      "  successful, so this refuses rather than emitting nothing. Either the layout moved (fix the\n" +
      "  walk above) or Uplinks were removed (lower FLOOR deliberately, in the same commit).",
  );
  process.exit(1);
}

/**
 * A leg with nothing to run is a mistake in the Uplink, and this saying so is
 * the only thing that will notice: every step would be skipped and the leg would
 * report green.
 */
const inert = legs.filter(
  (leg) => !leg.client && !leg.mod_csproj && !leg.tests_csproj,
);
if (inert.length > 0) {
  console.error(
    `✖ ${inert.map((l) => l.name).join(", ")}: neither a client nor a mod project. Every step in\n` +
      "  the leg would be skipped and the leg would pass having built and tested nothing.",
  );
  process.exit(1);
}

const missingId = legs.filter((leg) => !leg.id);
if (missingId.length > 0) {
  console.error(
    `✖ ${missingId.map((l) => l.name).join(", ")}: no id in uplinks/<name>/uplink.json. CI reads the\n` +
      "  Uplink's own declaration rather than knowing its name, so an Uplink that does not declare\n" +
      "  one cannot be built, published or version-checked.",
  );
  process.exit(1);
}

const args = process.argv.slice(2);
if (args.includes("--ids")) {
  for (const leg of legs) console.log(leg.id);
} else if (args.includes("--github")) {
  console.log(`matrix=${JSON.stringify({ include: legs })}`);
} else {
  console.log(JSON.stringify(legs, null, 2));
}
