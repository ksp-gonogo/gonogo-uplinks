/**
 * A capture that runs without a snapshot takes the LIVE clock, never the
 * epoch. Year 1 day 1 is a real instant, so a reading stamped with it does not
 * say the time is unknown, it says the reading is from the start of the game.
 * The guard is written one way in an Uplink,
 * `snapshot?.Ut ?? _host!.NowUt()`, and this holds every Uplink's production
 * sources to zero epoch fallbacks with no debt list.
 *
 * The shape is caught whatever the receiver is called, because rp1 once
 * shipped `raw?.Ut ?? 0.0` on its courier handles and a scan keyed on the name
 * `snapshot` passes it. A bare literal is refused and any call is
 * accepted, so the live clock passes however the host is reached.
 *
 * Reads tracked and untracked sources alike, so a new file is checked before
 * it is staged. Test projects are left out: they plant the shape on purpose.
 */
import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { test } from "node:test";
import { fileURLToPath } from "node:url";

/**
 * A null-conditional `.Ut` coalescing to a numeric literal or `default`. The
 * word boundary spares a longer member such as `?.UtOffset`.
 */
const EPOCH_FALLBACK =
  /\?\s*\.\s*Ut\b\s*\?\?\s*(?:[-+]?\d+(?:\.\d+)?(?:[eE][-+]?\d+)?[dfmDFM]?|default\b(?:\s*\(\s*double\s*\))?)/g;

/** The live-clock form every Uplink capture takes. */
const ACCEPTED_FORM = "snapshot?.Ut ?? _host!.NowUt()";

const FORBIDDEN_PLANTS = [
  "var ut = snapshot?.Ut ?? 0.0;",
  "Record(snapshot?.Ut ?? 0);",
  "var ut = snapshot ?. Ut ?? 0.0d;",
  "var stamp = raw?.Ut ?? 0.0;",
  "var stamp = observation?.Ut ?? default;",
  "var stamp = observation?.Ut ?? default(double);",
];

const SPARED_PLANTS = [
  `private double UtOf(KspSnapshot? snapshot) => ${ACCEPTED_FORM};`,
  "var ut = raw?.Ut ?? host.NowUt();",
  "var offset = snapshot?.UtOffset ?? 0.0;",
];

const here = fileURLToPath(import.meta.url);
const root = execFileSync("git", ["rev-parse", "--show-toplevel"], {
  cwd: dirname(here),
  encoding: "utf8",
}).trim();

/** Repo-relative paths of every production C# source under an Uplink. */
function productionSources() {
  return execFileSync(
    "git",
    [
      "ls-files",
      "--cached",
      "--others",
      "--exclude-standard",
      "--",
      ":(glob)uplinks/*/mod/**/*.cs",
      ":(glob)uplinks/*/mod-devtools/**/*.cs",
    ],
    { cwd: root, encoding: "utf8", maxBuffer: 1024 * 1024 * 64 },
  )
    .split("\n")
    .filter(Boolean);
}

/** Every Uplink that has a `mod` project, by directory name. */
function uplinksWithAMod() {
  return execFileSync(
    "git",
    ["ls-files", "--", ":(glob)uplinks/*/mod/*.csproj"],
    { cwd: root, encoding: "utf8" },
  )
    .split("\n")
    .filter(Boolean)
    .map((path) => path.split("/")[1]);
}

function matches(text) {
  return [...text.matchAll(EPOCH_FALLBACK)].map((m) => m[0]);
}

const paths = productionSources();
const sources = paths.map((path) => ({
  path,
  text: readFileSync(join(root, path), "utf8"),
}));

test("no Uplink capture falls back to the epoch for its instant", () => {
  const offenders = sources.flatMap(({ path, text }) =>
    matches(text).map((hit) => `${path}: ${hit}`),
  );
  assert.deepEqual(
    offenders,
    [],
    "A capture with no snapshot must take the live clock, not the epoch. Year 1 " +
      "day 1 is a real instant, so these stamp a reading with a time nobody " +
      `measured. Guard it as ${ACCEPTED_FORM}, the host held from Register.`,
  );
});

test("sees every planted epoch fallback and spares the live clock", () => {
  for (const plant of FORBIDDEN_PLANTS) {
    assert.equal(matches(plant).length, 1, `the scan cannot see: ${plant}`);
  }
  for (const plant of SPARED_PLANTS) {
    assert.deepEqual(matches(plant), [], `the scan now refuses: ${plant}`);
  }
});

test("reads every Uplink's production sources", () => {
  const uplinks = uplinksWithAMod();
  assert.ok(uplinks.length > 0, "found no Uplink with a mod project to scan");
  for (const uplink of uplinks) {
    assert.ok(
      paths.some((path) => path.startsWith(`uplinks/${uplink}/mod/`)),
      `the scan read no source of ${uplink}'s mod project`,
    );
  }
});

test("the guard still exists in its accepted form", () => {
  assert.ok(
    sources.some(({ text }) => text.includes(ACCEPTED_FORM)),
    `No production file guards with ${ACCEPTED_FORM} any more. Either every ` +
      "capture stopped needing it, in which case this scan is obsolete and " +
      "should go, or the walk has stopped reading the sources it thinks it reads.",
  );
});
