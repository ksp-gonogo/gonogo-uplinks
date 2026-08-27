#!/usr/bin/env node
/**
 * Lays one Uplink's built assemblies out as the `GameData/<gamedata>/Plugins/`
 * tree KSP installs, and zips it as the artifact CKAN would fetch.
 *
 * Mirrors what `GameData` already holds on a live install: the plugin DLL and the
 * Uplink's OWN `.Contract` slice, and nothing else. `Sitrep.Contract.dll` is
 * deliberately absent, because GonogoCore installs it into
 * `GameData/Gonogo/Plugins/` and a second copy beside an Uplink is a second
 * assembly identity for the same types.
 *
 * The Uplink's `.netkan` travels with the zip rather than being generated: it is
 * the author's own CKAN declaration and belongs next to the Uplink, the same way
 * `uplink.json` does.
 */

import { execFileSync } from "node:child_process";
import { cpSync, existsSync, mkdirSync, readFileSync, rmSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");

const name = process.argv[2];
const outDir = resolve(process.argv[3] ?? join(ROOT, "artifacts"));
if (!name) {
  console.error("usage: package-uplink-mod.mjs <uplink-dir-name> [outDir]");
  process.exit(2);
}

const uplinkDir = join(ROOT, "uplinks", name);
const declared = JSON.parse(
  readFileSync(join(uplinkDir, "uplink.json"), "utf8"),
);
const modBin = join(uplinkDir, "mod", "bin", "Release");

/**
 * The plugin plus its contract slice, named from `uplink.json` rather than
 * discovered, so a build that emitted the wrong assembly fails here instead of
 * shipping a zip with a DLL nobody asked for.
 */
const required = [
  declared.dll,
  declared.dll.replace(/\.dll$/, ".Contract.dll"),
];

const missing = required.filter((dll) => !existsSync(join(modBin, dll)));
if (missing.length > 0) {
  console.error(
    `✖ ${declared.id}: ${missing.join(", ")} absent from ${modBin}.\n` +
      "  Nothing to package. Build the mod half first; an empty or partial zip installs cleanly\n" +
      "  and then does nothing in game, which is the failure that looks like success.",
  );
  process.exit(1);
}

const staging = join(outDir, "gamedata", declared.gamedata);
rmSync(join(outDir, "gamedata"), { recursive: true, force: true });
mkdirSync(join(staging, "Plugins"), { recursive: true });
for (const dll of required) {
  cpSync(join(modBin, dll), join(staging, "Plugins", dll));
}
for (const extra of ["LICENSE", `NOTICE-${declared.mod?.name ?? ""}.txt`]) {
  const from = join(uplinkDir, "mod", extra);
  if (existsSync(from)) cpSync(from, join(staging, extra));
}
const netkan = join(uplinkDir, "mod", `${declared.gamedata}.netkan`);
if (existsSync(netkan)) cpSync(netkan, join(outDir, `${declared.gamedata}.netkan`));

const zip = join(outDir, `${declared.gamedata}.zip`);
rmSync(zip, { force: true });
execFileSync("zip", ["-qr", zip, declared.gamedata], {
  cwd: join(outDir, "gamedata"),
});

console.log(`${declared.id}: GameData/${declared.gamedata} → ${zip}`);
for (const dll of required) console.log(`  Plugins/${dll}`);
