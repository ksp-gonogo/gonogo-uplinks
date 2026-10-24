/**
 * What a release dispatch is allowed to ask for, and the shape of the workflows
 * that carry it out. The workflows are read as text because their rules are
 * their shape: a guard that is not there cannot be exercised by running it.
 */
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { test } from "node:test";
import { fileURLToPath } from "node:url";
import { planLegs, prepareArgs, releaseSubject } from "./release-plan.mjs";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
const workflow = (name) =>
  readFileSync(join(ROOT, ".github", "workflows", name), "utf8");

const leg = (id, over = {}) => ({
  name: id.toLowerCase(),
  id,
  client: true,
  mod_csproj: `uplinks/${id}/mod/x.csproj`,
  ...over,
});
const legs = [leg("kos"), leg("kerbcast"), leg("scansat"), leg("modonly", { client: false })];
const major = (table) => (l) => table[l.id] ?? 46;

test("a candidate is the default, and full needs saying", () => {
  assert.deepEqual(prepareArgs({ bump: "auto", full: false }), ["--bump", "auto", "--rc"]);
  assert.deepEqual(prepareArgs({ bump: "auto", full: true }), ["--bump", "auto"]);
  assert.deepEqual(prepareArgs({ version: "1.0.0-rc.5", full: false }), [
    "--version",
    "1.0.0-rc.5",
  ]);
});

test("a version and full must agree", () => {
  assert.throws(() => prepareArgs({ version: "1.0.0", full: false }), /full release/);
  assert.throws(() => prepareArgs({ version: "1.0.0-rc.1", full: true }), /candidate/);
  assert.throws(() => prepareArgs({ version: "1.0", full: false }), /not a version/);
  assert.throws(() => prepareArgs({ bump: "huge", full: false }), /none of them/);
});

test("all means every Uplink that has both halves, in id order", () => {
  assert.deepEqual(planLegs(legs, ["all"], major({})).map((l) => l.id), [
    "kerbcast",
    "kos",
    "scansat",
  ]);
});

test("an unknown Uplink, or one with a missing half, is refused by name", () => {
  assert.throws(() => planLegs(legs, ["nope"], major({})), /no Uplink .* nope/);
  assert.throws(() => planLegs(legs, ["modonly"], major({})), /no client/);
});

test("a set pinned to two contract Majors names the odd one out", () => {
  assert.throws(
    () => planLegs(legs, ["all"], major({ kos: 45 })),
    /kos to 45, where the rest are on 46/,
  );
  assert.deepEqual(planLegs(legs, ["kos"], major({ kos: 45 })).map((l) => l.id), ["kos"]);
});

test("the release commit's subject is one line a changelog can hold", () => {
  assert.equal(releaseSubject([{ id: "kerbcast", version: "1.0.0-rc.5" }]), "release: kerbcast v1.0.0-rc.5");
  assert.equal(
    releaseSubject([
      { id: "kos", version: "1.0.0" },
      { id: "kerbcast", version: "1.0.0" },
    ]),
    "release: 2 uplinks to 1.0.0",
  );
  const many = Array.from({ length: 12 }, (_, i) => ({ id: `uplink${i}`, version: `1.${i}.0` }));
  const subject = releaseSubject(many);
  assert.ok(subject.length <= 100);
  assert.equal(subject, "release: 12 uplinks");
});

test("prepare-release runs on staging only and refuses a full release without the operator's switch", () => {
  const text = workflow("prepare-release.yml");
  assert.match(text, /refs\/heads\/staging/);
  assert.match(text, /ALLOW_FULL_RELEASE/);
  assert.match(text, /merge-base --is-ancestor/);
  assert.ok(
    text.indexOf("ALLOW_FULL_RELEASE") < text.indexOf("release-plan.mjs plan"),
    "the full-release switch is read before anything is planned",
  );
});

test("only the writer job pushes, and only when the run is not a dry run", () => {
  const text = workflow("prepare-release.yml");
  const pushes = text.split("\n").filter((line) => /git push/.test(line) && !/^\s*#/.test(line));
  assert.ok(pushes.length >= 2, "found the pushes");
  const jobs = text.split(/^  (?=[a-z-]+:\n)/m);
  for (const job of jobs.filter((j) => /git push/.test(j))) {
    assert.match(job, /dry_run != 'true'|inputs\.dry_run == false|dry_run == 'false'/);
  }
});

test("a release's history is fetched whole, as a string, since 0 is falsy in an expression", () => {
  assert.match(
    workflow("_uplink-tasks.yml"),
    /fetch-depth: \$\{\{ inputs\.prepare_args != '' && '0' \|\| '1' \}\}/,
  );
});

test("a prepare leg runs no task step but its own, so it cannot publish or push", () => {
  const text = workflow("_uplink-tasks.yml");
  const prepare = text.split(/^(?=      - )/m).filter((step) => /prepare_args != ''/.test(step) && /name: Prepare the release/.test(step));
  assert.equal(prepare.length, 1);
  assert.doesNotMatch(prepare[0], /git push|gh release|publish/);
  assert.doesNotMatch(workflow("prepare-release.yml").split(/^  assemble:/m)[0].split(/^  prepare:/m)[1] ?? "", /git push/);
});
