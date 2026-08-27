#!/usr/bin/env node
/**
 * Builds one Uplink's shippable pair, in the order the hash forces.
 *
 * ## Why this is two passes and cannot be one
 *
 * The DLL vouches for the client bundle by carrying its sha256
 * (`ExpectedClientHash`), so the bundle has to exist and be hashed BEFORE the
 * DLL is compiled. Building the DLL first and hashing afterwards gives a DLL
 * that vouches for nothing, which is the state every first-party Uplink has been
 * in: `mod/scripts/bake-client-hash.mjs` is written, unit-tested and documented
 * to authors, and nothing has ever invoked it.
 *
 *   1. bundle the client, and hash the bytes
 *   2. bake Url + DevPath + that hash into generated C#
 *   3. compile the DLL, which now carries all three
 *   4. package GameData
 *
 * ## The dev loop is the same four steps with one flag
 *
 * `--dev-path <url>` puts a machine-local address into the DLL. The loader
 * prefers `DevPath` over `Url` when it is non-empty, so this is how an author
 * points a running app at a bundle they are editing. It is also how a released
 * DLL sends every user to somebody's laptop, so the bake step says so loudly and
 * this refuses to package a dev build unless `--allow-dev-package` is passed.
 *
 * Usage:
 *   release-uplink.mjs <uplink-dir-name> [--dev-path <url>] [--allow-dev-package]
 */

import { spawnSync } from "node:child_process";
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");

const args = process.argv.slice(2);
const name = args[0];
const devPath = args.includes("--dev-path")
  ? args[args.indexOf("--dev-path") + 1]
  : "";
const allowDevPackage = args.includes("--allow-dev-package");

if (!name) {
  console.error(
    "usage: release-uplink.mjs <uplink-dir-name> [--dev-path <url>] [--allow-dev-package]",
  );
  process.exit(2);
}

const step = (label, cmd, cmdArgs) => {
  console.log(`\n== ${label}`);
  const result = spawnSync(cmd, cmdArgs, { cwd: ROOT, stdio: "inherit" });
  if (result.status !== 0) {
    console.error(`\n✖ ${label} failed, so nothing after it ran.`);
    process.exit(1);
  }
};

const uplinkDir = join(ROOT, "uplinks", name);
const declared = JSON.parse(
  readFileSync(join(uplinkDir, "uplink.json"), "utf8"),
);

step("1/4 bundle the client", "node", [
  "tooling/bundle-uplink-client.mjs",
  name,
]);

/*
 * Read back from the artifact rather than recomputing: the number baked into the
 * DLL must be the hash of the bytes that were actually written, and a second
 * computation is a second chance to hash something else.
 */
const hash = readFileSync(
  join(ROOT, "artifacts", declared.id, `${declared.id}.client.js.sha256`),
  "utf8",
).trim();

step("2/4 bake ClientSource + ExpectedClientHash", "node", [
  "tooling/bake-client-source.mjs",
  name,
  "--hash",
  hash,
  ...(devPath ? ["--dev-path", devPath] : []),
]);

step("3/4 compile the plugin", "dotnet", [
  "build",
  join("uplinks", name, "mod", `${declared.gamedata}.csproj`),
  "-c",
  "Release",
  "--nologo",
  "-v",
  "quiet",
]);

/*
 * Confirm the compiled DLL actually carries what step 2 generated.
 *
 * A bake that wrote the file and a compile that picked it up are different
 * events, and a stale `obj/`, an excluded file or a failed regeneration leaves
 * the DLL vouching for nothing while every step above prints success. The app
 * then loads the Uplink as mod-only with no widget and nothing says why.
 *
 * Literals live in the metadata as UTF-16, so the needle is encoded rather than
 * compared as ASCII. That is not a detail: searching the DLL as ASCII finds
 * nothing at all, and decoding the whole file as UTF-16 from offset zero
 * misaligns every string that starts on an odd byte, so it reports SOME of them
 * absent. Both readings look like a broken bake and neither is.
 */
const dll = join(
  ROOT, "uplinks", name, "mod", "bin", "Release", declared.dll,
);
const compiled = readFileSync(dll);
const baked = [["Url", declared.client.url], ["hash", hash]];
if (devPath) baked.push(["DevPath", devPath]);
const absent = baked.filter(
  ([, value]) => !compiled.includes(Buffer.from(value, "utf16le")),
);
if (absent.length > 0) {
  console.error(
    `\n✖ ${declared.id}: the compiled DLL does not contain ${absent.map(([w]) => w).join(", ")},\n` +
      "  which step 2 baked. The generated C# is on disk and did not reach the assembly: check that\n" +
      "  mod/*.g.cs is in the compile set and that obj/ is not stale. Refusing to package a DLL that\n" +
      "  does not vouch for its own client bundle.",
  );
  process.exit(1);
}
console.log(`\n  verified in ${declared.dll}: ${baked.map(([w]) => w).join(", ")}`);

if (devPath && !allowDevPackage) {
  console.log(
    `\n== 4/4 packaging SKIPPED\n` +
      `  This DLL carries DevPath ${devPath}, which the loader prefers over the release Url, so the\n` +
      "  zip would send every user to that address. Rebuild without --dev-path to package, or pass\n" +
      "  --allow-dev-package if you are deliberately handing a dev build to one machine.",
  );
  console.log(
    `\n${declared.id}: dev build ready. Install the GameData tree by hand, or re-run with\n` +
      "  --allow-dev-package to get a zip.",
  );
  process.exit(0);
}

step("4/4 package GameData", "node", [
  "tooling/package-uplink-mod.mjs",
  name,
]);

console.log(
  `\n${declared.id}: both halves built.\n` +
    `  client  artifacts/${declared.id}/${declared.id}.client.js  (+ gonogo-uplink.json beside it)\n` +
    `  mod     artifacts/${declared.gamedata}.zip\n` +
    `  hash    ${hash}, baked into the DLL${devPath ? `\n  DevPath ${devPath} (DEV BUILD)` : ""}`,
);
