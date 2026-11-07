#!/usr/bin/env node
/**
 * Turns a release tag (`<uplink id>-v<version>`) into the one Uplink it releases,
 * and the `client.url` the release will carry.
 *
 * What is committed holds the placeholder version in the URL, and a release
 * stamps the tag's version over it before it builds. The URL is baked into the
 * DLL, so it is what every install fetches for the life of that release. A tree
 * whose URL names some other version than the placeholder would be stamped
 * wrongly or not at all, and ship a DLL fetching a directory named for another
 * version, so it is refused.
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

const PLACEHOLDER = "0.0.0-development";
const committed = JSON.parse(
  readFileSync(join(ROOT, "uplinks", leg.name, "uplink.json"), "utf8"),
).client?.url;
if (!committed?.split("/").includes(PLACEHOLDER)) {
  console.error(
    `✖ ${tag}: uplinks/${leg.name}/uplink.json declares client.url\n` +
      `    ${committed ?? "(none)"}\n` +
      `  which has no /${PLACEHOLDER}/ directory. A release stamps its version over that folder, so\n` +
      "  what is committed must name the placeholder: " +
      `.../@releases/uplinks/releases/${id}/${PLACEHOLDER}/${id}.client.js`,
  );
  process.exit(1);
}
const url = committed.split(`/${PLACEHOLDER}/`).join(`/${version}/`);

const out = { name: leg.name, id, version, url, leg: JSON.stringify(leg) };
if (process.argv.includes("--github")) {
  for (const [key, value] of Object.entries(out)) console.log(`${key}=${value}`);
} else {
  console.log(`${tag}: ${leg.name} ${version}\n  client ${url}`);
}
