#!/usr/bin/env node
/**
 * What the SpaceDock upload decides before it logs in, for one Uplink's release
 * tag (`<uplink id>-v<version>`).
 *
 *   spacedock-release.mjs eligible <tag>                  exit 0 for a full release, 1 for anything else
 *   spacedock-release.mjs version <tag>                   the version SpaceDock gets
 *   spacedock-release.mjs mod-id <uplink.json>            the SpaceDock listing id, or nothing
 *   spacedock-release.mjs require-mod-id <uplink.json>    the listing id; exit 1 saying so when there is none
 *   spacedock-release.mjs holds <listing.json> <version>  `held` or `absent`
 *   spacedock-release.mjs changelog <previous tag or ""> <uplink dir>  the player changelog
 *
 * SpaceDock feeds CKAN, so whatever reaches SpaceDock reaches players. A tag is
 * eligible only when its version is plain `X.Y.Z`: a release candidate, or any
 * other prerelease suffix, is never uploaded. The workflow's `if:` says the same
 * thing, and this is the check behind it that does not depend on an expression
 * staying written correctly.
 *
 * A full release of an Uplink with no listing id fails before anything is
 * published: an id is never guessed, and a release that cannot reach SpaceDock
 * is not half done.
 *
 * The listing id lives in the Uplink's own uplink.json as `spacedock.modId`,
 * because it is a fact about that Uplink and travels with it when it leaves
 * this repository. A repository variable per id would stay behind.
 */
import { execFileSync } from "node:child_process";
import { readFileSync } from "node:fs";

const TAG = /^(.+)-v(\d+\.\d+\.\d+)(-[0-9A-Za-z.-]+)?$/;

/** The parts of a release tag, or undefined when it is not one. */
export function parseTag(tag) {
  const match = TAG.exec(tag);
  if (!match) return undefined;
  return { id: match[1], core: match[2], prerelease: match[3]?.slice(1) };
}

/** Whether a tag may be uploaded to SpaceDock: a tag with a plain X.Y.Z version. */
export function eligible(tag) {
  const parts = parseTag(tag);
  return parts !== undefined && parts.prerelease === undefined;
}

/** The version string SpaceDock lists, always bare: CKAN reads it as written. */
export function spacedockVersion(tag) {
  const parts = parseTag(tag);
  if (!parts) throw new Error(`${tag} is not a release tag`);
  if (parts.prerelease !== undefined) {
    throw new Error(
      `${tag} is a prerelease (${parts.prerelease}), and a prerelease is never uploaded to SpaceDock`,
    );
  }
  return parts.core;
}

/** The SpaceDock listing id an uplink.json declares, as a string, or "" when it declares none. */
export function modIdOf(declared) {
  const id = declared?.spacedock?.modId;
  if (id === undefined || id === null || id === "") return "";
  if (!/^\d+$/.test(String(id))) {
    throw new Error(
      `uplink.json's spacedock.modId is ${JSON.stringify(id)}, and a SpaceDock listing id is a number`,
    );
  }
  return String(id);
}

/** Whether a public `GET /api/mod/<id>` reply already lists `version`. */
export function listingHolds(listing, version) {
  if (!listing || !Array.isArray(listing.versions)) {
    throw new Error(
      `the SpaceDock reply carries no versions list: ${JSON.stringify(listing).slice(0, 200)}`,
    );
  }
  return listing.versions.some((v) => v.friendly_version === version);
}

/**
 * What a player reads on the SpaceDock version: the features and fixes of the
 * conventional commits that touched this Uplink, newest first. Everything else
 * is one line saying other changes exist.
 */
export function changelogOf(subjects) {
  const groups = { Features: [], "Bug Fixes": [] };
  let other = 0;
  for (const subject of subjects) {
    const match = /^(feat|fix)(?:\(([^)]*)\))?!?: (.+)$/.exec(subject);
    if (!match) {
      other += 1;
      continue;
    }
    const entry = `- ${match[3]}`;
    groups[match[1] === "feat" ? "Features" : "Bug Fixes"].push(entry);
  }
  const out = [];
  for (const [name, entries] of Object.entries(groups)) {
    if (entries.length === 0) continue;
    out.push(`**${name}**`, "", ...entries, "");
  }
  if (other > 0) out.push("Other changes: maintenance, documentation and tests.", "");
  return out.length > 0 ? `${out.join("\n").trimEnd()}\n` : "First release.\n";
}

export function main(argv) {
  const [command, ...rest] = argv;
  if (command === "eligible" && rest.length === 1) {
    return eligible(rest[0]) ? 0 : 1;
  }
  if (command === "version" && rest.length === 1) {
    console.log(spacedockVersion(rest[0]));
    return 0;
  }
  if (command === "mod-id" && rest.length === 1) {
    const id = modIdOf(JSON.parse(readFileSync(rest[0], "utf8")));
    if (id) console.log(id);
    return 0;
  }
  if (command === "require-mod-id" && rest.length === 1) {
    const declared = JSON.parse(readFileSync(rest[0], "utf8"));
    const id = modIdOf(declared);
    if (!id) {
      console.error(
        `${rest[0]} has no spacedock.modId, and a full release of ${declared.id ?? "this Uplink"} is uploaded to SpaceDock. ` +
          'Create its SpaceDock listing and add its numeric id as "spacedock": { "modId": <id> }. Nothing was published.',
      );
      return 1;
    }
    console.log(id);
    return 0;
  }
  if (command === "holds" && rest.length === 2) {
    const listing = JSON.parse(readFileSync(rest[0], "utf8"));
    console.log(listingHolds(listing, rest[1]) ? "held" : "absent");
    return 0;
  }
  if (command === "changelog" && rest.length === 2) {
    const [previous, dir] = rest;
    const range = previous ? [`${previous}..HEAD`] : [];
    const log = execFileSync(
      "git",
      ["log", "--format=%s", ...range, "--", dir],
      { encoding: "utf8" },
    );
    process.stdout.write(changelogOf(log.split("\n").filter(Boolean)));
    return 0;
  }
  console.error(
    "usage: spacedock-release.mjs eligible <tag> | version <tag> | mod-id <uplink.json> | require-mod-id <uplink.json> | holds <listing.json> <version> | changelog <previous tag> <uplink dir>",
  );
  return 2;
}

if (import.meta.url === `file://${process.argv[1]}`) {
  try {
    process.exit(main(process.argv.slice(2)));
  } catch (error) {
    console.error(error instanceof Error ? error.message : String(error));
    process.exit(2);
  }
}
