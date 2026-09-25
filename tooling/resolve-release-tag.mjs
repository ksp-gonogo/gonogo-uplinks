#!/usr/bin/env node
/**
 * Turns a release tag (`<uplink id>-v<version>`) into the one Uplink it releases,
 * and refuses a tag whose version the Uplink's own `client.url` does not carry.
 *
 * The URL is baked into the DLL, so it is what every install fetches for the
 * life of that release. A tag of 0.0.3 on a tree whose URL still names 0.0.2
 * would publish into 0.0.2's directory, which the never-overwrite rule then
 * refuses, or worse, succeeds when 0.0.2 was never published and ships a 0.0.3
 * DLL fetching a directory named for another version.
 *
 * Usage:
 *   resolve-release-tag.mjs <tag>            human summary
 *   resolve-release-tag.mjs <tag> --github   key=value lines for $GITHUB_OUTPUT
 */

import { spawnSync } from "node:child_process";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { readFileSync } from "node:fs";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");

const tag = process.argv[2];
const match = tag && /^(.+)-v(\d+\.\d+\.\d+(?:-[0-9A-Za-z.-]+)?)$/.exec(tag);
if (!match) {
  console.error(
    `✖ ${tag ?? "(no tag)"} is not a release tag. A release tag is <uplink id>-v<semver>, e.g. scansat-v0.0.2.`,
  );
  process.exit(2);
}
const [, id, version] = match;

const matrix = spawnSync("node", [join(ROOT, "scripts", "uplink-matrix.mjs")], {
  encoding: "utf8",
});
if (matrix.status !== 0) {
  process.stderr.write(matrix.stderr);
  process.exit(1);
}
const leg = JSON.parse(matrix.stdout).find((l) => l.id === id);
if (!leg) {
  console.error(`✖ ${tag}: no Uplink under uplinks/ declares the id ${id}.`);
  process.exit(1);
}
if (!leg.client || !leg.mod_csproj) {
  console.error(
    `✖ ${tag}: ${leg.name} has ${leg.client ? "no mod project" : "no client"}. A release publishes a\n` +
      "  client bundle and the DLL that vouches for its hash, so it needs both halves.",
  );
  process.exit(1);
}

const url = JSON.parse(
  readFileSync(join(ROOT, "uplinks", leg.name, "uplink.json"), "utf8"),
).client?.url;
if (!url?.split("/").includes(version)) {
  console.error(
    `✖ ${tag}: uplinks/${leg.name}/uplink.json declares client.url\n` +
      `    ${url ?? "(none)"}\n` +
      `  which has no /${version}/ directory. The URL is baked into the DLL, so this release would\n` +
      "  fetch a client published for some other version. Point client.url at\n" +
      `  .../@releases/${id}/${version}/${id}.client.js and tag that commit.`,
  );
  process.exit(1);
}

const out = { name: leg.name, id, version, url, leg: JSON.stringify(leg) };
if (process.argv.includes("--github")) {
  for (const [key, value] of Object.entries(out)) console.log(`${key}=${value}`);
} else {
  console.log(`${tag}: ${leg.name} ${version}\n  client ${url}`);
}
