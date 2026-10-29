import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { test } from "node:test";
import { fileURLToPath } from "node:url";

const text = readFileSync(
  join(dirname(fileURLToPath(import.meta.url)), "..", ".github/workflows/ci-dev-check.yml"),
  "utf8",
);

/** The text of each top-level job, by id. */
function jobs() {
  const body = text.slice(text.indexOf("\njobs:\n") + 1);
  const out = {};
  for (const match of body.matchAll(/^ {2}([a-z-]+):\n((?: {4}.*\n|\n)*)/gm)) out[match[1]] = match[2];
  return out;
}

const STAGING = "github.ref == 'refs/heads/staging'";

test("a scheduled run only dispatches on staging", () => {
  const { trampoline } = jobs();
  assert.match(trampoline, /if: github\.event_name == 'schedule'/);
  assert.match(trampoline, /gh workflow run ci-dev-check\.yml .*--ref staging/);
});

test("every real job runs only off the schedule and only on staging", () => {
  const all = jobs();
  const real = Object.keys(all).filter((id) => id !== "trampoline");
  assert.deepEqual(real.sort(), ["pack", "report", "uplink"]);
  // uplink inherits the guard through needs: pack, which is skipped off staging.
  assert.match(all.uplink, /needs: pack/);
  for (const id of ["pack", "report"]) {
    assert.ok(all[id].includes(STAGING), `${id} is not guarded to staging`);
    assert.ok(all[id].includes("github.event_name != 'schedule'"), `${id} runs on the schedule`);
  }
});
