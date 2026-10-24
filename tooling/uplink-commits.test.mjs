/**
 * Which commits a release of one Uplink is made of: those scoped to it, and
 * those that touched its directory without being scoped to another Uplink.
 */
import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { after, test } from "node:test";
import { lastRelease, uplinkCommits } from "./uplink-commits.mjs";

const root = mkdtempSync(join(tmpdir(), "uplink-commits-"));
after(() => rmSync(root, { recursive: true, force: true }));
const git = (...args) => execFileSync("git", args, { cwd: root, encoding: "utf8" }).trim();

for (const [dir, id] of [["alpha", "alpha"], ["beta-dir", "beta"]]) {
  mkdirSync(join(root, "uplinks", dir), { recursive: true });
  writeFileSync(join(root, "uplinks", dir, "uplink.json"), JSON.stringify({ id }));
}
git("init", "-q", "-b", "main");
git("config", "user.email", "t@example.com");
git("config", "user.name", "t");

let n = 0;
function commit(subject, touching, body = "") {
  for (const dir of touching) {
    writeFileSync(join(root, "uplinks", dir, `f${++n}.txt`), String(n));
  }
  git("add", "-A");
  git("commit", "-q", "--allow-empty", "-m", subject + (body ? `\n\n${body}` : ""));
}

commit("feat(alpha): before the release", ["alpha"]);
git("tag", "alpha-v1.0.0");
commit("feat(alpha): a camera widget", ["alpha"]);
commit("fix: an unscoped fix inside alpha", ["alpha"]);
commit("feat(beta): beta only", ["beta-dir"]);
commit("fix(beta): touched both, scoped to beta", ["alpha", "beta-dir"]);
commit("refactor: touched both, scoped to none", ["alpha", "beta-dir"]);
commit("docs(alpha): scoped but touches no directory of it", []);
commit("feat(alpha): a widget that was backed out", ["alpha"]);
commit("revert(alpha): a widget that was backed out", ["alpha"]);
commit("feat(alpha)!: a rename", ["alpha"]);
commit("fix(alpha): a thing", ["alpha"], "BREAKING CHANGE: the old name is gone");
commit("release: alpha v1.1.0-rc.1", ["alpha"]);
commit("not a conventional subject", ["alpha"]);

test("the default start is the latest full release", () => {
  git("tag", "alpha-v1.1.0-rc.1");
  assert.equal(lastRelease(root, "alpha"), "alpha-v1.0.0");
  assert.equal(lastRelease(root, "beta"), undefined);
});

test("an Uplink gets its scoped commits and its own unscoped ones", () => {
  assert.deepEqual(
    uplinkCommits(root, "alpha", "alpha-v1.0.0").map((c) => c.subject),
    [
      "feat(alpha): a camera widget",
      "fix: an unscoped fix inside alpha",
      "refactor: touched both, scoped to none",
      "docs(alpha): scoped but touches no directory of it",
      "feat(alpha)!: a rename",
      "fix(alpha): a thing",
    ],
  );
});

test("a commit scoped to another Uplink is not this one's, though it touched both", () => {
  const beta = uplinkCommits(root, "beta").map((c) => c.subject);
  assert.deepEqual(beta, [
    "feat(beta): beta only",
    "fix(beta): touched both, scoped to beta",
    "refactor: touched both, scoped to none",
  ]);
});

test("a revert removes itself and the commit it undoes, and a release commit is dropped", () => {
  const subjects = uplinkCommits(root, "alpha", "alpha-v1.0.0").map((c) => c.subject);
  assert.ok(!subjects.some((s) => s.includes("backed out") || s.startsWith("release")));
});

test("a breaking footer or a bang marks the commit breaking", () => {
  const breaking = uplinkCommits(root, "alpha", "alpha-v1.0.0")
    .filter((c) => c.breaking)
    .map((c) => c.subject);
  assert.deepEqual(breaking, ["feat(alpha)!: a rename", "fix(alpha): a thing"]);
});

test("an unknown Uplink is refused", () => {
  assert.throws(() => uplinkCommits(root, "nope"), /no Uplink/);
});
