import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import test from "node:test";
import { fileURLToPath } from "node:url";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
const read = (f) => readFileSync(join(ROOT, ".github", "workflows", f), "utf8");
const matrix = (...args) =>
  spawnSync("node", [join(ROOT, "scripts", "uplink-matrix.mjs"), ...args], { encoding: "utf8" });

test("--only narrows the matrix to the named Uplinks, by id or name", () => {
  const all = matrix("--ids").stdout.trim().split("\n");
  assert.ok(all.length > 2);
  const one = matrix("--ids", "--only", all[0]);
  assert.equal(one.status, 0);
  assert.deepEqual(one.stdout.trim().split("\n"), [all[0]]);
  const two = matrix("--github", "--only", `${all[0]}, ${all[1]}`);
  const parsed = JSON.parse(two.stdout.replace(/^matrix=/, ""));
  assert.equal(parsed.include.length, 2);
});

test("an empty --only runs every leg and an unknown name is refused", () => {
  const all = matrix("--ids").stdout;
  assert.equal(matrix("--ids", "--only", "").stdout, all);
  const bad = matrix("--ids", "--only", "no-such-uplink");
  assert.notEqual(bad.status, 0);
  assert.match(bad.stderr, /no-such-uplink/);
});

test("the scaffold sibling is an Uplink that has a client", () => {
  const out = matrix("--scaffold-sibling");
  assert.equal(out.status, 0);
  const legs = JSON.parse(matrix().stdout);
  assert.ok(legs.find((l) => l.name === out.stdout.trim())?.client);
});

test("a release is checked on the chosen Uplinks only, and the scaffold gates it from a job of its own", () => {
  const release = read("prepare-release.yml");
  const ci = release.slice(release.indexOf("  ci:"), release.indexOf("  release:"));
  assert.match(ci, /uses: \.\/\.github\/workflows\/ci\.yml/);
  assert.match(ci, /uplinks: \$\{\{ needs\.plan\.outputs\.ids \}\}/);
  assert.match(release, /needs: \[assemble, ci\]/);

  const workflow = read("ci.yml");
  assert.match(workflow, /--only "\$UPLINKS"/);
  assert.match(workflow, /\n  scaffold:\n/);
  assert.match(workflow, /scripts\/scaffold-proof\.sh/);
  assert.doesNotMatch(workflow, /matrix\.name == /, "no leg is picked by name");
  assert.doesNotMatch(read("_uplink-tasks.yml"), /scaffold/i, "the scaffold proof is in no Uplink's leg");
});

test("a push to staging still runs every leg", () => {
  const workflow = read("ci.yml");
  assert.match(workflow, /push: \{ branches: \[main, staging\] \}/);
  assert.match(workflow, /default: ""/, "no filter unless a caller passes one");
});
