/**
 * A figure that has stopped arriving is HELD, and the tree says so in one
 * word. The other phrasing for it is banned everywhere: operator-facing copy,
 * identifiers, data attributes, comments and test names alike, so the
 * vocabulary is one thing rather than two. "Currently" is ordinary English and
 * stays.
 *
 * Scans every file git sees, untracked included, so a new file is checked
 * before it is staged. This file is the only one allowed to spell the phrase,
 * because it carries the plants below.
 */
import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { dirname, relative } from "node:path";
import { test } from "node:test";
import { fileURLToPath } from "node:url";

const PATTERN = "not[ _-]?current(?!ly)|no longer current";

/**
 * Every spelling the pattern must catch, and one it must not. Each sits alone
 * on its own line of this file, so the scan's hits on this file are the proof
 * that it can see each one.
 */
const PLANTS = [
  "plant: not current",
  "plant: no longer current",
  "plant: valueNotCurrent",
  "plant: NOT_CURRENT",
  "plant: data-not-current",
];
const SPARED = "plant: not currently";

const here = fileURLToPath(import.meta.url);
const root = execFileSync("git", ["rev-parse", "--show-toplevel"], {
  cwd: dirname(here),
  encoding: "utf8",
}).trim();
const self = relative(root, here);

/** `path:line text` for every matching line in the repo. */
function hits() {
  try {
    return execFileSync(
      "git",
      ["grep", "--untracked", "-I", "-n", "-i", "-P", PATTERN, "--", "."],
      { cwd: root, encoding: "utf8", maxBuffer: 1024 * 1024 * 64 },
    )
      .split("\n")
      .filter(Boolean);
  } catch (err) {
    if (err?.status === 1) return [];
    throw err;
  }
}

const all = hits();
const own = all.filter((h) => h.startsWith(`${self}:`));
const offenders = all.filter((h) => !h.startsWith(`${self}:`));

test("names a figure that stopped arriving held, in every file", () => {
  assert.deepEqual(
    offenders,
    [],
    `Found the banned phrasing on ${offenders.length} line(s). Say "held" ` +
      "(an identifier `xHeld`, an attribute `data-held`).",
  );
});

test("sees every planted spelling", () => {
  for (const plant of PLANTS) {
    assert.ok(
      own.some((h) => h.includes(`"${plant}"`)),
      `the scan cannot see "${plant}"`,
    );
  }
});

test("spares the adverb", () => {
  assert.ok(SPARED.includes("current"));
  assert.equal(
    own.some((h) => h.includes(`"${SPARED}"`)),
    false,
  );
});
