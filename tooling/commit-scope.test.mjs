/**
 * The commit scope rule, the comma scope split it relies on, and the starting
 * point that keeps older history out of the check.
 */
import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { after, test } from "node:test";
import { effectiveStart, scopeFor, rangeProblems, scopeProblem, SCOPE_CHECK_AFTER } from "./commit-scope.mjs";
import { scopeNames, uplinkCommits, uplinkNames } from "./uplink-commits.mjs";

const root = mkdtempSync(join(tmpdir(), "commit-scope-"));
after(() => rmSync(root, { recursive: true, force: true }));
const git = (...args) => execFileSync("git", args, { cwd: root, encoding: "utf8" }).trim();
for (const [dir, id] of [["alpha", "alpha"], ["beta-dir", "beta"], ["gamma", "gamma"]]) {
  mkdirSync(join(root, "uplinks", dir), { recursive: true });
  writeFileSync(join(root, "uplinks", dir, "uplink.json"), JSON.stringify({ id }));
}
const names = uplinkNames(root);
const all = ["uplinks/alpha/a", "uplinks/beta-dir/b", "uplinks/gamma/c"];

test("a comma scope is split into names", () => {
  assert.deepEqual(scopeNames("kerbcast, rp1"), ["kerbcast", "rp1"]);
  assert.deepEqual(scopeNames(undefined), []);
});

test("a scope naming exactly the touched Uplinks passes, by id or directory", () => {
  assert.equal(scopeProblem("fix(alpha): x", ["uplinks/alpha/a"], names), undefined);
  assert.equal(scopeProblem("fix(beta-dir): x", ["uplinks/beta-dir/a"], names), undefined);
  assert.equal(scopeProblem("fix(alpha,beta): x", all.slice(0, 2), names), undefined);
  assert.equal(scopeProblem("build(uplinks): x", all, names), undefined);
  assert.equal(scopeProblem("build(uplinks): x", all.slice(0, 3), names), undefined);
});

test("a scope that misses, adds or invents an Uplink is refused with the fix", () => {
  assert.match(scopeProblem("fix(alpha): x", all.slice(0, 2), names), /touches beta without naming it.*\(alpha,beta\)/);
  assert.match(scopeProblem("fix(alpha,beta): x", [all[0]], names), /names beta without touching it/);
  assert.match(scopeProblem("fix: x", [all[0]], names), /touches alpha without naming it/);
  assert.match(scopeProblem("fix(cameras): x", [all[0]], names), /"cameras", which is not an Uplink/);
  assert.match(scopeProblem("fix(uplinks): x", all.slice(0, 2), names), /3 or more Uplinks/);
});

test("a commit touching no Uplink, a release commit and a non-conventional subject keep their scope", () => {
  assert.equal(scopeProblem("ci(workflows): x", ["tooling/a.mjs"], names), undefined);
  assert.equal(scopeProblem("release: alpha v1.0.0", all, names), undefined);
  assert.equal(scopeProblem("not conventional", all, names), undefined);
});

test("a comma-scoped commit lands in the commit list of each Uplink it names", () => {
  git("init", "-q", "-b", "main");
  git("config", "user.email", "t@example.com");
  git("config", "user.name", "t");
  git("add", "-A");
  git("commit", "-q", "-m", "chore: start");
  const start = git("rev-parse", "HEAD");
  writeFileSync(join(root, "uplinks/alpha/a"), "1");
  writeFileSync(join(root, "uplinks/beta-dir/b"), "1");
  git("add", "-A");
  git("commit", "-q", "-m", "fix(alpha,beta): both");
  writeFileSync(join(root, "uplinks/alpha/a"), "2");
  git("add", "-A");
  git("commit", "-q", "-m", "fix(beta): wrong");
  for (const id of ["alpha", "beta"]) {
    assert.ok(uplinkCommits(root, id, start).some((c) => c.subject === "fix(alpha,beta): both"));
  }
  assert.ok(!uplinkCommits(root, "gamma", start).some((c) => c.subject.includes("both")));
  writeFileSync(join(root, "uplinks/alpha/a"), "3");
  writeFileSync(join(root, "uplinks/gamma/c"), "3");
  writeFileSync(join(root, "uplinks/beta-dir/b"), "3");
  git("add", "-A");
  git("commit", "-q", "-m", "build(uplinks): wide");
  assert.ok(uplinkCommits(root, "alpha", start).some((c) => c.subject === "build(uplinks): wide"));
  assert.ok(uplinkCommits(root, "gamma", start).some((c) => c.subject === "build(uplinks): wide"));
  assert.ok(uplinkCommits(root, "beta", start).some((c) => c.subject === "build(uplinks): wide"));
  const bad = rangeProblems(root, `${start}..HEAD`);
  assert.deepEqual(bad.map((b) => b.subject), ["fix(beta): wrong"]);
});

test("a check never starts before the fixed starting commit", () => {
  assert.equal(effectiveStart(root, "0".repeat(40)), SCOPE_CHECK_AFTER);
  assert.equal(effectiveStart(root, undefined), SCOPE_CHECK_AFTER);
});

test("the scope a bot commit uses passes the check it is held to", () => {
  for (const dirs of [[], ["alpha"], ["alpha", "beta-dir"], ["alpha", "beta-dir", "gamma"]]) {
    const files = dirs.map((d) => `uplinks/${d}/f`);
    const scope = scopeFor(files, names);
    const subject = `chore${scope ? `(${scope})` : ""}: regenerate Uplink pages`;
    assert.equal(scopeProblem(subject, files, names), undefined, subject);
  }
  assert.equal(scopeFor(["uplinks/alpha/a", "uplinks/beta-dir/b"], names), "alpha,beta");
  assert.equal(scopeFor(all, names), "uplinks");
});
