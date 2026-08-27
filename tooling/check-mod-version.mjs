#!/usr/bin/env node
/**
 * Reports the parent mod version this Uplink declares it was built against, and
 * whether anything can find out that a newer one exists.
 *
 * ## This is the SEAM, not the mechanism
 *
 * The compatibility mechanism itself (what a guard asserts against a loaded
 * assembly, how a rename becomes a build error rather than a silent no-op) is
 * owned elsewhere and is not reimplemented here. What this file settles is the
 * question that mechanism needs answered and could not answer from inside
 * `gonogo`: **where does the declaration live in a world where the Uplink is its
 * own repository?**
 *
 * It lives in `uplinks/<name>/uplink.json`, in a `mod` block, next to the Uplink
 * rather than in any central list. The matrix (`scripts/uplink-matrix.mjs`)
 * carries it through to CI verbatim, so CI reads the Uplink's own declaration and
 * never knows an Uplink's name. Adding the second Uplink is adding a `mod` block
 * to its own `uplink.json`, which is the cost test that design was set.
 *
 * ## Three states, and the third must not read like either neighbour
 *
 * - **pinned**: the declared version is what the guards ran against. True whether
 *   it is current or two years old, and it does not decay: "built and tested
 *   against SCANsat 20.4" stays true forever
 *   - **newer available**: CKAN tier only, because only there can anything find
 *   out. NOT a failure. It means nobody has checked the new one yet
 * - **could not check**: loud, and never collapsible into either of the above. A
 *   check that cannot say it failed to look reports success it did not earn
 *
 * The tiers differ in ONE thing only: whether a newer version is discoverable.
 * Both are verified against a stated version. A manual tier is not a weaker
 * claim, it is the same claim about a version no machine can enumerate:
 * Principia's named releases are distributed off CKAN with no semver to compare,
 * so `tier: "manual"` is the honest answer there rather than a shortfall.
 *
 * Exit codes: 0 pinned or newer-available, 1 could-not-check or misdeclared.
 */

import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
const CKAN_META =
  "https://raw.githubusercontent.com/KSP-CKAN/CKAN-meta/master/";

const name = process.argv[2];
if (!name) {
  console.error("usage: check-mod-version.mjs <uplink-dir-name>");
  process.exit(2);
}

const declared = JSON.parse(
  readFileSync(join(ROOT, "uplinks", name, "uplink.json"), "utf8"),
);
const mod = declared.mod;

/**
 * An Uplink that wraps nothing has nothing to be compatible with, which is a
 * legitimate shape (a pure-Gonogo Uplink reading only the shared snapshot). It is
 * stated rather than inferred from an absent block, because "declares no parent
 * mod" and "forgot to declare one" would otherwise print the same line.
 */
if (mod === null || mod === undefined) {
  console.log(`${declared.id}: no parent mod declared, nothing to check`);
  process.exit(0);
}

if (!mod.builtAgainst || !mod.tier) {
  console.error(
    `✖ ${declared.id}: uplink.json's mod block needs both "tier" ("ckan" or "manual") and\n` +
      '  "builtAgainst". Without a declared version there is no claim to verify, and a check with\n' +
      "  nothing to compare against passes while meaning nothing.",
  );
  process.exit(1);
}

console.log(
  `${declared.id}: PINNED to ${mod.name} ${mod.builtAgainst} (tier: ${mod.tier})`,
);

if (mod.tier === "manual") {
  console.log(
    `  ${mod.name} is not on CKAN, so nothing can enumerate its versions. The declared version is\n` +
      "  the whole claim and it does not expire. A newer release is invisible here by nature, not\n" +
      "  by omission.",
  );
  process.exit(0);
}

if (mod.tier !== "ckan") {
  console.error(`✖ ${declared.id}: unknown tier "${mod.tier}"`);
  process.exit(1);
}

if (!mod.ckan) {
  console.error(
    `✖ ${declared.id}: tier is "ckan" but no "ckan" identifier is declared, so the resolution below\n` +
      "  cannot run. That is a could-not-check, and it fails rather than printing a version.",
  );
  process.exit(1);
}

/**
 * CKAN's metadata repository, not a mod page. It is structured, versioned and
 * meant to be read by tools; scraping a SpaceDock page is a gate that breaks when
 * somebody changes their markup, and a flaky gate gets switched off.
 */
let versions;
try {
  const response = await fetch(
    `https://api.github.com/repos/KSP-CKAN/CKAN-meta/contents/${mod.ckan}`,
    { headers: { accept: "application/vnd.github+json" } },
  );
  if (!response.ok) throw new Error(`HTTP ${response.status}`);
  const entries = await response.json();
  versions = entries
    .filter((entry) => entry.name.endsWith(".ckan"))
    .map((entry) => entry.name.replace(/\.ckan$/, ""));
} catch (err) {
  console.error(
    `✖ ${declared.id}: COULD NOT CHECK whether a newer ${mod.name} exists. ${err instanceof Error ? err.message : err}\n` +
      `  ${CKAN_META}${mod.ckan} was unreachable, or the identifier "${mod.ckan}" is wrong, or the mod\n` +
      "  was delisted. This is reported as loudly as a mismatch on purpose: the pin above is still\n" +
      "  true, and this line is the only thing that distinguishes it from a checked pin.",
  );
  process.exit(1);
}

if (versions.length === 0) {
  console.error(
    `✖ ${declared.id}: COULD NOT CHECK. CKAN-meta lists no .ckan file under "${mod.ckan}", so the\n` +
      "  comparison would be against an empty set and would report agreement.",
  );
  process.exit(1);
}

const known = versions.some((v) => v.includes(mod.builtAgainst));
console.log(`  CKAN carries ${versions.length} release(s) of ${mod.ckan}`);
console.log(
  known
    ? `  the declared ${mod.builtAgainst} is among them`
    : `  the declared ${mod.builtAgainst} is NOT among the release names CKAN lists, which usually\n` +
      "  means the declaration and CKAN spell the version differently rather than that it is gone",
);
console.log(
  "  a newer release is INFORMATION, not a failure: it means nobody has run the guards against\n" +
    "  it yet. Re-run them with -p:ModGameData=<an install carrying the new version> and move\n" +
    "  builtAgainst when they pass.",
);
