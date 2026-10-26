#!/usr/bin/env node
/**
 * Writes the internal .ckan CKAN reads out of an Uplink's release zip:
 *
 *   internal-ckan.mjs <uplink-dir-name> --zip <release zip>   add it to the zip
 *   internal-ckan.mjs <uplink-dir-name>                       print it
 *
 * NetKAN downloads the SpaceDock archive and copies the keys of a .ckan inside
 * it onto the listing, except keys the listing already declares, so the listing
 * must not carry a `depends` of its own. The file declares what the Uplink needs
 * at the version it was built against, which a release changes and a listing
 * kept outside the zip cannot follow.
 *
 * The mod's CKAN identifier comes from uplink.json (`mod.ckan`), and the version
 * from the client's gonogo-uplink.json when the Uplink has one, otherwise from
 * uplink.json. An Uplink whose mod is not on CKAN (`tier: "manual"`) depends on
 * GonogoCore alone. Any other mod the code needs at runtime, such as the
 * Harmony library an Uplink's assembly references, is listed in uplink.json as
 * `ckanDepends`, entries in CKAN's own relationship form.
 *
 * `min_version` is `mod.ckanVersion` when the Uplink has one: the pinned release
 * in the spelling CKAN lists it under, with its epoch and leading `v`, which
 * `uplink-tools deps bump` and `deps pin-ckan` write. CKAN orders the epoch first
 * and a `v` above no prefix, so the bare `builtAgainst` of a mod CKAN lists as
 * `v4.7.0.0` or `1:1.6.0.1` is met by every release of it.
 *
 * GonogoCore carries no version: the Uplinks build against a pinned gonogo
 * commit (vendor/gonogo-ref), which is not a GonogoCore release, and a
 * min_version CKAN cannot find a release for would make the Uplink
 * uninstallable.
 */
import { execFileSync } from "node:child_process";
import { existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");

function readJson(path) {
  return JSON.parse(readFileSync(path, "utf8"));
}

/** The facts the file is generated from, for one Uplink directory. */
export function readUplink(name, root = ROOT) {
  const dir = join(root, "uplinks", name);
  const uplink = readJson(join(dir, "uplink.json"));
  const manifestPath = join(dir, "client", "gonogo-uplink.json");
  const manifest = existsSync(manifestPath) ? readJson(manifestPath) : undefined;
  return { uplink, manifest };
}

/** The internal .ckan as an object. */
export function internalCkan({ uplink, manifest }) {
  const depends = [];
  const mod = uplink.mod ?? {};
  if (mod.ckan) {
    const builtAgainst = manifest?.mod?.builtAgainst ?? mod.builtAgainst;
    if (!builtAgainst) {
      throw new Error(`${uplink.id} names the CKAN mod ${mod.ckan} but no builtAgainst version`);
    }
    depends.push({ name: mod.ckan, min_version: mod.ckanVersion ?? builtAgainst });
  }
  depends.push(...(uplink.ckanDepends ?? []), { name: "GonogoCore" });
  return { depends };
}

export function renderInternalCkan(facts) {
  return `${JSON.stringify(internalCkan(facts), null, 2)}\n`;
}

function listZip(zip) {
  return execFileSync("unzip", ["-Z1", zip], { encoding: "utf8" })
    .split("\n")
    .filter(Boolean);
}

/** Adds GameData/<gamedata>/<gamedata>.ckan to a release zip and returns its path inside the zip. */
export function addToZip(zip, facts) {
  const { gamedata } = facts.uplink;
  const entries = listZip(zip);
  if (!entries.some((entry) => entry.startsWith(`GameData/${gamedata}/`))) {
    throw new Error(`${zip} holds nothing under GameData/${gamedata}/, so it is not this Uplink's release zip`);
  }
  const existing = entries.filter((entry) => entry.endsWith(".ckan"));
  if (existing.length > 0) {
    throw new Error(`${zip} already holds ${existing.join(", ")}; CKAN refuses an archive with more than one`);
  }
  const entry = `GameData/${gamedata}/${gamedata}.ckan`;
  const stage = mkdtempSync(join(tmpdir(), "internal-ckan-"));
  try {
    mkdirSync(join(stage, "GameData", gamedata), { recursive: true });
    writeFileSync(join(stage, entry), renderInternalCkan(facts));
    execFileSync("zip", ["-q", resolve(zip), entry], { cwd: stage });
  } finally {
    rmSync(stage, { recursive: true, force: true });
  }
  return entry;
}

/** The text of the .ckan inside a release zip. */
export function readFromZip(zip) {
  const found = listZip(zip).filter((entry) => entry.endsWith(".ckan"));
  if (found.length !== 1) {
    throw new Error(`${zip} holds ${found.length} .ckan files, CKAN needs exactly one`);
  }
  return execFileSync("unzip", ["-p", zip, found[0]], { encoding: "utf8" });
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  const [name, flag, zip] = process.argv.slice(2);
  if (!name) {
    console.error("usage: internal-ckan.mjs <uplink-dir-name> [--zip <release zip>]");
    process.exit(2);
  }
  const facts = readUplink(name);
  if (flag === "--zip" && zip) {
    console.log(`added ${addToZip(zip, facts)} to ${zip}`);
  } else {
    process.stdout.write(renderInternalCkan(facts));
  }
}
