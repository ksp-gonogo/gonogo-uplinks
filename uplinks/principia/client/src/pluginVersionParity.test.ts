// @vitest-environment node
//
// Node realm: this reads C# and TypeScript sources off disk and compares strings.
import { existsSync, readdirSync, readFileSync, statSync } from "node:fs";
import { dirname, join, relative } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

/**
 * Every client-side `pluginVersion` fixture must carry the build the Principia
 * Uplink's read gate is pinned to, because that is the only string the field can
 * ever hold.
 *
 * `PrincipiaSession.TryBind` refuses outright unless Principia's own `GetVersion`
 * returns a string ordinally equal to `AnalysedPluginVersion`, and only then
 * stamps `Session.Version`. That value is what `CaptureSettingsOnMain` puts on
 * `SettingsObservation.PluginVersion`, which `SettingsBuilder` writes to the wire
 * as `pluginVersion`. So the field is not "usually" the constant, it is the
 * constant or there is no session at all, and a fixture holding anything else
 * depicts a payload the mod cannot produce.
 *
 * Scans only this Uplink's own client: nothing outside it can produce a
 * `pluginVersion` fixture for a session this mod's read gate governs.
 */

const HERE = dirname(fileURLToPath(import.meta.url));
const UPLINK_ROOT = join(HERE, "..", "..");

const SESSION_CS = join(UPLINK_ROOT, "mod", "PrincipiaSession.cs");

/**
 * Where a `pluginVersion` literal may legitimately appear. A root rather than a
 * file list, so a NEW fixture is covered the day it is added instead of the day
 * somebody remembers this file exists.
 */
const SCAN_ROOTS = [join(UPLINK_ROOT, "client", "src")];

/**
 * Generated mirrors of the contract declare the field as a plain string type,
 * naming its UNIT rather than a value, and that declaration matches the
 * literal scan below exactly, so they are excluded by path rather than
 * filtered on what the value looks like: a rule that skipped anything not
 * resembling a version would also skip the stale value this test exists to
 * catch. This file's own doc comments must never spell the scanned pattern
 * out literally either, since `SCAN_ROOTS` includes the directory this file
 * lives in and a literal example would match itself.
 */
const EXCLUDED_DIR = "__generated__";

function readAnalysedPluginVersion(): string {
  if (!existsSync(SESSION_CS)) {
    throw new Error(
      `principia-plugin-version-parity: ${relative(UPLINK_ROOT, SESSION_CS)} does not exist. ` +
        "The file was renamed or moved; point this test at it rather than " +
        "deleting the check, or the client fixtures go back to being unchecked.",
    );
  }
  const src = readFileSync(SESSION_CS, "utf8");
  const match =
    /public\s+const\s+string\s+AnalysedPluginVersion\s*=\s*"([^"]+)"\s*;/.exec(
      src,
    );
  if (!match) {
    throw new Error(
      `principia-plugin-version-parity: no "public const string AnalysedPluginVersion" ` +
        `in ${relative(UPLINK_ROOT, SESSION_CS)}. The declaration was renamed or ` +
        "reshaped; point this test at it rather than deleting the check.",
    );
  }
  return match[1];
}

function sourceFilesUnder(root: string): string[] {
  if (!existsSync(root)) {
    throw new Error(
      `principia-plugin-version-parity: scan root ${relative(UPLINK_ROOT, root)} does not ` +
        "exist. A root that has moved makes this check silently match nothing, " +
        "so it fails here instead.",
    );
  }
  const found: string[] = [];
  const walk = (dir: string): void => {
    for (const entry of readdirSync(dir)) {
      if (entry === EXCLUDED_DIR || entry === "node_modules") continue;
      const path = join(dir, entry);
      if (statSync(path).isDirectory()) {
        walk(path);
      } else if (/\.(ts|tsx|json)$/.test(entry)) {
        found.push(path);
      }
    }
  };
  walk(root);
  return found;
}

/** Every `pluginVersion` string literal in the tree, with where it was found. */
function pluginVersionSites(): { path: string; value: string }[] {
  const sites: { path: string; value: string }[] = [];
  for (const root of SCAN_ROOTS) {
    for (const path of sourceFilesUnder(root)) {
      const src = readFileSync(path, "utf8");
      for (const m of src.matchAll(/"?pluginVersion"?\s*:\s*"([^"]*)"/g)) {
        sites.push({ path: relative(UPLINK_ROOT, path), value: m[1] });
      }
    }
  }
  return sites;
}

describe("Principia client fixtures pin the build the mod is gated to", () => {
  it("finds the read gate's constant in the mod source", () => {
    expect(readAnalysedPluginVersion()).not.toBe("");
  });

  it("finds fixtures to check at all", () => {
    /**
     * The blindness guard, and the reason it is its own case. This check is a
     * text scan over a tree it does not own: a fixture file renamed, a root
     * moved, or the field spelled differently would leave the scan matching
     * nothing and reporting green, which is the failure mode that let the drift
     * this test was written for survive in the first place. Zero sites is
     * therefore a failure, not a clean tree.
     */
    expect(pluginVersionSites().length).toBeGreaterThan(0);
  });

  it("every pluginVersion fixture carries AnalysedPluginVersion verbatim", () => {
    const expected = readAnalysedPluginVersion();
    const stale = pluginVersionSites()
      .filter((s) => s.value !== expected)
      .map((s) => `${s.path}: ${s.value}`);

    expect(
      stale,
      "These fixtures depict a `principia.settings` payload the mod cannot " +
        "produce. `PrincipiaSession.TryBind` refuses any build whose GetVersion " +
        "is not ordinally equal to AnalysedPluginVersion, and a bound session " +
        "stamps that same string onto the wire's `pluginVersion`, so the only " +
        `value this field can hold is "${expected}". If the mod's pin has moved, ` +
        "move these with it; if a fixture means to depict an unbound session, " +
        "the field is absent rather than holding another build.",
    ).toEqual([]);
  });
});
