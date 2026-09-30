#!/usr/bin/env node
/**
 * The gonogo half of Saga #727 (gonogo/packages/core/src/contract-reader-coverage.scan.ts)
 * cannot see this repo: it scans `packages/*` and `mod/*\/client` inside gonogo
 * only, so a contract field or command that ONLY an Uplink here reads is
 * invisible to it and would otherwise sit in gonogo's debt list forever as
 * "no reader found", even once a real reader exists. gonogo's debt list
 * (`packages/core/src/contract-reader-coverage.debt.ts`) is allowed to carry
 * an entry reasoned `Uplink-read: <name>` for exactly that case, but nothing
 * in gonogo can check the claim is still true — a later refactor here that
 * drops the read would leave that reason lying, with no gate on either side
 * to catch it going stale.
 *
 * This script is the other half: it reads `contract-reader-debt-claims.json`
 * in this directory, and for each claim, checks that Uplink's OWN client
 * source still names the field or command. Run it in CI here (and by hand
 * before adding or removing a claim) so the claim and the code cannot drift
 * apart silently.
 *
 * ## Keeping the two repos in sync
 *
 * There is no shared checkout, so nothing can check the two lists against
 * each other automatically. The convention is manual and symmetric:
 *
 *   - Every entry in `contract-reader-debt-claims.json` here needs a matching
 *     `"Uplink-read: <name>"` line in gonogo's `contract-reader-coverage.debt.ts`.
 *   - Every `"Uplink-read: <name>"` line there needs a matching entry here.
 *
 * Add or remove both in the same sitting. This script only proves the HALF
 * it can see (the claim is backed by real source in this repo); it cannot
 * prove the other repo's debt list still carries the matching line.
 *
 * ## What "backed by real source" means here
 *
 * A field claim (`field:<topic>.<path>`) is backed when the named Uplink's
 * `client/src` (tests and `__generated__` excluded) contains BOTH the Topic
 * prefix (everything before the field path's last segment) as a substring,
 * AND the leaf identifier (the last dotted segment) as a whole word — the
 * same two-part signal gonogo's own scan uses (a file that never mentions the
 * Topic cannot be reading a field of it, and a leaf name check without the
 * Topic would match on a coincidence). A command claim (`command:<id>`) is
 * backed when the exact id appears as a quoted string literal anywhere in
 * that source. This is a TEXTUAL check, matching this repo's existing
 * `held-wording.test.mjs` style rather than a full AST walk: a false OMISSION
 * here (a real read this cannot see) only means a claim is not yet provable,
 * which fails loud and gets investigated; a false POSITIVE would let a stale
 * claim stand, which the word-boundary + Topic-prefix pairing guards against
 * for the common case at least as well as a name-only grep would.
 */
import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { readFileSync } from "node:fs";
import { dirname, join, relative } from "node:path";
import { test } from "node:test";
import { fileURLToPath } from "node:url";

const HERE = dirname(fileURLToPath(import.meta.url));
const ROOT = execFileSync("git", ["rev-parse", "--show-toplevel"], {
  cwd: HERE,
  encoding: "utf8",
}).trim();

const CLAIMS_PATH = join(HERE, "contract-reader-debt-claims.json");

/** @typedef {{ key: string; uplink: string; reason?: string }} Claim */

/** @returns {Claim[]} */
export function readClaims(path = CLAIMS_PATH) {
  const parsed = JSON.parse(readFileSync(path, "utf8"));
  if (!Array.isArray(parsed)) {
    throw new Error(`${path} must be a JSON array of claims`);
  }
  for (const claim of parsed) {
    if (typeof claim.key !== "string" || typeof claim.uplink !== "string") {
      throw new Error(`${path}: every claim needs a string "key" and "uplink": ${JSON.stringify(claim)}`);
    }
  }
  return parsed;
}

/** `uplinks/<name>/client/src`, or `null` when that Uplink has no client. */
export function clientSrcDir(root, uplink) {
  const dir = join(root, "uplinks", uplink, "client", "src");
  return dir;
}

function isTextFile(rel) {
  return /\.(ts|tsx)$/.test(rel) && !/\.test\.tsx?$/.test(rel) && !/(?:^|\/)__generated__\//.test(rel);
}

/** Every non-test, non-generated `.ts`/`.tsx` file's text under `dir`, tracked or not. */
export function sourceTextOf(root, dir) {
  let rel;
  try {
    rel = relative(root, dir);
  } catch {
    return [];
  }
  let listed;
  try {
    listed = execFileSync("git", ["ls-files", "-z", "--", rel], {
      cwd: root,
      encoding: "utf8",
    })
      .split("\0")
      .filter(Boolean);
  } catch {
    return [];
  }
  return listed.filter(isTextFile).map((f) => {
    try {
      return readFileSync(join(root, f), "utf8");
    } catch {
      return "";
    }
  });
}

function leafOf(path) {
  const segments = path.split(".");
  return segments[segments.length - 1] ?? path;
}

function wordBoundaryIncludes(text, word) {
  return new RegExp(`(?<![A-Za-z0-9_$])${word.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}(?![A-Za-z0-9_$])`).test(text);
}

/**
 * Whether `texts` (one Uplink's whole client source) backs `claim`.
 *
 * Exported so the self-test below can plant both a backed and an unbacked
 * claim against a literal string, rather than only against real Uplink
 * source that could drift out from under the test.
 */
export function claimIsBacked(claim, texts) {
  const [kind, ...rest] = claim.key.split(":");
  const id = rest.join(":");
  const joined = texts.join("\n");

  if (kind === "command") {
    return joined.includes(`"${id}"`) || joined.includes(`'${id}'`);
  }
  if (kind === "field") {
    const lastDot = id.lastIndexOf(".");
    if (lastDot === -1) return false;
    const topic = id.slice(0, lastDot);
    const leaf = leafOf(id);
    return joined.includes(topic) && wordBoundaryIncludes(joined, leaf);
  }
  throw new Error(`claim key must start with "field:" or "command:": ${claim.key}`);
}

function verify(claims, root = ROOT) {
  const results = claims.map((claim) => {
    const dir = clientSrcDir(root, claim.uplink);
    const texts = sourceTextOf(root, dir);
    return { claim, dir, filesSeen: texts.length, backed: claimIsBacked(claim, texts) };
  });
  return results;
}

// Run the real check whenever this file is executed directly (not imported by the self-test below).
if (process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1]) {
  const claims = readClaims();
  if (claims.length === 0) {
    console.info(
      "[verify-contract-reader-debt] no claims registered in contract-reader-debt-claims.json; nothing to verify.",
    );
  }
  const results = verify(claims);
  const stale = results.filter((r) => !r.backed);
  for (const r of results) {
    const verdict = r.backed ? "OK" : "STALE";
    console.info(`[verify-contract-reader-debt] ${verdict}  ${r.claim.key} (${r.claim.uplink}, ${r.filesSeen} files seen)`);
  }
  if (stale.length > 0) {
    console.error(
      `\n${stale.length} claim(s) no longer backed by source. Either the Uplink stopped reading the ` +
        "field/command (delete the claim here AND the matching Uplink-read line in gonogo's debt list), " +
        "or this checker's textual match missed a real read (investigate before assuming the claim is dead).",
    );
    process.exitCode = 1;
  }
}

// Self-test: `node tooling/verify-contract-reader-debt.mjs --test`, or picked
// up by `node --test tooling/`. Plants both verdicts so the check is proven
// to see each one, not just assumed to.
if (process.argv.includes("--test") || process.env.NODE_TEST_CONTEXT) {
  test("a field claim is backed when the Topic and the leaf both appear", () => {
    const texts = ['useTelemetry("planted.topic");', "const leaf = payload.plantedLeaf;"];
    assert.equal(
      claimIsBacked({ key: "field:planted.topic.plantedLeaf", uplink: "planted" }, texts),
      true,
    );
  });

  test("a field claim is NOT backed when the leaf never appears", () => {
    const texts = ['useTelemetry("planted.topic");'];
    assert.equal(
      claimIsBacked({ key: "field:planted.topic.neverWritten", uplink: "planted" }, texts),
      false,
    );
  });

  test("a field claim is NOT backed by a leaf name inside a longer identifier", () => {
    const texts = ['useTelemetry("planted.topic");', "const plantedLeafSuffix = 1;"];
    assert.equal(
      claimIsBacked({ key: "field:planted.topic.plantedLeaf", uplink: "planted" }, texts),
      false,
    );
  });

  test("a command claim is backed by its quoted literal", () => {
    const texts = ['useCommand("planted.command.id");'];
    assert.equal(claimIsBacked({ key: "command:planted.command.id", uplink: "planted" }, texts), true);
  });

  test("a command claim is NOT backed with no matching literal", () => {
    const texts = ['useCommand("planted.command.other");'];
    assert.equal(claimIsBacked({ key: "command:planted.command.id", uplink: "planted" }, texts), false);
  });

  test("the live claims file parses as an array of {key, uplink}", () => {
    const claims = readClaims();
    assert.equal(Array.isArray(claims), true);
    for (const claim of claims) {
      assert.match(claim.key, /^(field|command):/);
      assert.equal(typeof claim.uplink, "string");
    }
  });
}
