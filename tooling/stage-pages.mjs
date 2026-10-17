#!/usr/bin/env node
/**
 * Stage a regenerated page for the commit-back, split by what `docs --check` reads.
 *
 * A generated page has two halves and they want opposite rules.
 *
 * **Deterministic, derived from the registrations.** The README prose, the
 * manifest, and `render-shape.json`. These are staged BY BYTES, unconditionally.
 * `render-shape.json` is not an asset at all despite sitting in the asset
 * directory: it is the record `docs --check` compares a fresh render against, so
 * discarding a change to it leaves the checker failing on a page the generator
 * has already fixed, and the heal reports success having committed nothing.
 *
 * **Rasterised by a browser.** The PNGs and GIFs. Their bytes are not
 * comparable between machines and a motion scene re-encodes differently from an
 * unchanged tree, so staging every byte change would put a churn commit on main
 * on every push forever, and a commit that always appears is a commit nobody
 * reads.
 *
 * ## The predicate for the second half is the shape, not the file extension
 *
 * An asset ADDED or DELETED is drift either way. For one whose bytes merely
 * moved, the question is whether the picture is still a picture of this code,
 * and `render-shape.json` answers exactly that: it records what the mounted
 * widget computes, excluding everything a glyph rasteriser measures. So the rule
 * is shape changed, commit the new bytes; shape identical, discard them.
 *
 * Splitting on the extension instead would need PNGs to re-render
 * byte-identically on the runner, which nothing here can show, and it would
 * exempt the GIFs permanently: a motion scene whose behaviour changed would get
 * a fresh shape record, satisfy the check, and keep showing the old animation.
 *
 * An asset with no entry in the new record is DISCARDED, because nothing can
 * distinguish its churn from its drift. That is the pre-existing rule, and it
 * applies to nothing today.
 *
 *   node tooling/stage-pages.mjs
 */

import { execFileSync } from "node:child_process";
import { readFileSync } from "node:fs";
import { dirname, join, posix } from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");

/** The shape record, committed beside the assets it describes. */
const SHAPE_RECORD_FILE = "render-shape.json";

/**
 * Everything the commit-back carries, as git pathspecs.
 *
 * Each contains a wildcard, and that is load-bearing: a git pathspec containing
 * one is matched as a PATTERN against whole paths rather than resolved as a
 * directory prefix.
 */
const DETERMINISTIC = [
  "README.md",
  "uplinks/*/client/README.md",
  "uplinks/*/client/gonogo-uplink.json",
  `uplinks/*/client/docs/assets/${SHAPE_RECORD_FILE}`,
];
const ASSETS = "uplinks/*/client/docs/assets/*";

const git = (...args) =>
  execFileSync("git", args, { cwd: ROOT, encoding: "utf8" });

/**
 * What to do with one changed asset.
 *
 * A pure function of a status and two hashes, so the self-check below can drive
 * it through every outcome without a repository. A predicate that can only be
 * run against the real tree cannot be shown to fail, and a check that cannot
 * fail reports success.
 *
 * @param {string} code two-character porcelain status
 * @param {string|undefined} was the shape hash in the committed record
 * @param {string|undefined} now the shape hash in the regenerated record
 * @returns {"stage"|"discard"}
 */
export function assetVerdict(code, was, now) {
  if (code.includes("?") || code.includes("D")) return "stage";
  if (now === undefined) return "discard";
  return was === now ? "discard" : "stage";
}

/** Prove the predicate separates churn from drift before trusting its verdict. */
function selfCheck() {
  const cases = [
    ["??", undefined, "abc", "stage", "a new asset is drift"],
    [" D", "abc", undefined, "stage", "a removed asset is drift"],
    [" M", "abc", "abc", "discard", "bytes moved and the shape did not"],
    [" M", "abc", "def", "stage", "the shape moved, so the picture is stale"],
    [" M", undefined, "abc", "stage", "newly recorded, so commit the picture"],
    [" M", "abc", undefined, "discard", "no new record, so nothing can be said"],
  ];
  const faults = [];
  for (const [code, was, now, want, why] of cases) {
    const got = assetVerdict(code, was, now);
    if (got !== want) faults.push(`${why}: wanted ${want}, got ${got}`);
  }
  if (faults.length > 0) {
    console.error(
      "✖ the staging predicate cannot tell churn from drift, so its verdict about the\n" +
        "  real assets means nothing:\n" +
        faults.map((f) => `    ${f}`).join("\n"),
    );
    process.exit(1);
  }
}

/** Every asset's shape hash in one record, or an empty map if there is none. */
function shapesIn(json) {
  if (json === undefined) return new Map();
  const assets = JSON.parse(json).assets ?? {};
  return new Map(Object.entries(assets).map(([file, s]) => [file, s.hash]));
}

/** The record as HEAD has it, or undefined where the Uplink has none yet. */
function committedRecord(assetDir) {
  try {
    return git("show", `HEAD:${posix.join(assetDir, SHAPE_RECORD_FILE)}`);
  } catch {
    return undefined;
  }
}

/** The record the run just wrote, or undefined if it wrote none. */
function regeneratedRecord(assetDir) {
  try {
    return readFileSync(join(ROOT, assetDir, SHAPE_RECORD_FILE), "utf8");
  } catch {
    return undefined;
  }
}

/**
 * Paths git reports as changed under a pathspec, with their status.
 *
 * `-z` rather than the default, so a path is never quoted or split on a space.
 * A rename arrives as two records and the second is the destination, which is
 * the one to judge.
 */
function changed(pathspec) {
  const out = git("status", "--porcelain", "-z", "--", pathspec);
  const fields = out.split("\0").filter((f) => f.length > 0);
  const rows = [];
  for (let i = 0; i < fields.length; i++) {
    const code = fields[i].slice(0, 2);
    rows.push({ code, path: fields[i].slice(3) });
    // A rename or copy spends a second field on the source path.
    if (code[0] === "R" || code[0] === "C") i++;
  }
  return rows;
}

selfCheck();

git("add", "--", ...DETERMINISTIC);

/** Shape maps are read once per Uplink rather than once per asset. */
const recordCache = new Map();
const shapesFor = (assetDir) => {
  if (!recordCache.has(assetDir)) {
    recordCache.set(assetDir, {
      was: shapesIn(committedRecord(assetDir)),
      now: shapesIn(regeneratedRecord(assetDir)),
    });
  }
  return recordCache.get(assetDir);
};

const staged = [];
const discarded = [];

for (const { code, path } of changed(ASSETS)) {
  const file = posix.basename(path);
  // Staged by bytes above, along with the rest of the deterministic half.
  if (file === SHAPE_RECORD_FILE) continue;

  const { was, now } = shapesFor(posix.dirname(path));
  if (assetVerdict(code, was.get(file), now.get(file)) === "stage") {
    git("add", "-A", "--", path);
    staged.push(`${code} ${path}`);
  } else {
    git("checkout", "--", path);
    discarded.push(path);
  }
}

console.log(
  `${staged.length} asset(s) staged, ${discarded.length} discarded as re-encoding churn.`,
);
for (const row of staged) console.log(`  stage   ${row}`);
for (const row of discarded) console.log(`  discard ${row}`);

/**
 * Nothing the page is made of may be left changed and unstaged.
 *
 * The commit carries the INDEX and `docs --check` reads the WORKING TREE, so the
 * two must agree about every path this touched or the guard that follows is
 * asked about a tree nobody is committing. Every path above was either staged or
 * restored, so a surviving worktree modification means a pathspec here stopped
 * matching something the generator writes.
 */
const limbo = [...changed(ASSETS), ...DETERMINISTIC.flatMap(changed)].filter(
  ({ code }) => code[1] !== " ",
);
if (limbo.length > 0) {
  console.error(
    "✖ the index and the working tree disagree about the page, so what `--check` is\n" +
      "  about to read is not what would be committed:\n" +
      limbo.map(({ code, path }) => `    ${code} ${path}`).join("\n"),
  );
  process.exit(1);
}
