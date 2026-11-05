/**
 * The release notes of an Uplink: its own commits, grouped as its CHANGELOG.md
 * groups them, from the previous full release up to the tag being released.
 */
import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { after, test } from "node:test";
import { notesFor, releaseNotes } from "./uplink-notes.mjs";

test("breaking changes lead, then features, fixes and performance, each by description", () => {
  const text = releaseNotes([
    { subject: "fix(alpha): a crash", breaking: false },
    { subject: "feat(alpha): a widget", breaking: false },
    { subject: "perf(alpha): a faster redraw", breaking: false },
    { subject: "feat(alpha)!: a rename", breaking: true },
    { subject: "fix(alpha): a thing", breaking: true },
  ]);
  assert.equal(
    text,
    [
      "### Breaking changes",
      "",
      "- a rename",
      "- a thing",
      "",
      "### Features",
      "",
      "- a widget",
      "",
      "### Fixes",
      "",
      "- a crash",
      "",
      "### Performance",
      "",
      "- a faster redraw",
      "",
    ].join("\n"),
  );
});

test("documentation, tests, build and subjects that are not conventional are left out", () => {
  const text = releaseNotes([
    { subject: "docs(alpha): a page", breaking: false },
    { subject: "test(alpha): a case", breaking: false },
    { subject: "chore: a bump", breaking: false },
    { subject: "not conventional", breaking: false },
    { subject: "fix(alpha): kept", breaking: false },
  ]);
  assert.equal(text, "### Fixes\n\n- kept\n");
});

test("commits scoped only to developer work, or to nothing, are left out whatever their type", () => {
  const text = releaseNotes([
    { subject: "feat!: build against contract 19", breaking: true },
    { subject: "fix(codegen): regenerate every slice", breaking: false },
    { subject: "feat(release): client URLs name their version", breaking: false },
    { subject: "fix(vendor,codegen): bump the reference set", breaking: false },
    { subject: "fix(add-ons): each add-on reports its version", breaking: false },
    { subject: "fix(kerbcast,codegen): a player fix that also regenerated", breaking: false },
    { subject: "fix(uplinks): command buttons show SENT", breaking: false },
  ]);
  assert.equal(
    text,
    "### Fixes\n\n- a player fix that also regenerated\n- command buttons show SENT\n",
  );
});

test("a chore that says which Gonogo version it supports is listed under Compatibility, any other is not", () => {
  const text = releaseNotes([
    { subject: "chore: update to support gonogo 1.2", breaking: false },
    { subject: "chore(vendor): support Gonogo v1.3.0-rc.1", breaking: false },
    { subject: "chore(uplinks): rebuild every Uplink against the Gonogo 1.0.0-rc.40 packages", breaking: false },
    { subject: "chore: Uplinks build against Gonogo contract 50", breaking: false },
    { subject: "chore: support gonogo", breaking: false },
    { subject: "fix(alpha): a thing", breaking: false },
  ]);
  assert.equal(
    text,
    "### Fixes\n\n- a thing\n\n### Compatibility\n\n- update to support gonogo 1.2\n- support Gonogo v1.3.0-rc.1\n",
  );
});

test("two commits with the same description make one line", () => {
  const text = releaseNotes([
    { subject: "fix(alpha): a thing", breaking: false },
    { subject: "fix(alpha): a thing", breaking: false },
  ]);
  assert.equal(text, "### Fixes\n\n- a thing\n");
});

test("nothing that reaches a player says so", () => {
  assert.equal(releaseNotes([]), "No changes that reach players.\n");
  assert.equal(
    releaseNotes([{ subject: "docs: words", breaking: false }]),
    "No changes that reach players.\n",
  );
});

const root = mkdtempSync(join(tmpdir(), "uplink-notes-"));
after(() => rmSync(root, { recursive: true, force: true }));
const git = (...args) => execFileSync("git", args, { cwd: root, encoding: "utf8" }).trim();
for (const id of ["alpha", "beta"]) {
  mkdirSync(join(root, "uplinks", id), { recursive: true });
  writeFileSync(join(root, "uplinks", id, "uplink.json"), JSON.stringify({ id }));
}
git("init", "-q", "-b", "main");
git("config", "user.email", "t@example.com");
git("config", "user.name", "t");
let n = 0;
function commit(subject, dir) {
  writeFileSync(join(root, "uplinks", dir, `f${++n}.txt`), String(n));
  git("add", "-A");
  git("commit", "-q", "-m", subject);
}
commit("feat(alpha): in the first release", "alpha");
git("tag", "alpha-v1.0.0");
commit("feat(alpha): a camera widget", "alpha");
commit("fix(beta): beta's own fix", "beta");
commit("fix(alpha): a fix inside alpha", "alpha");
git("tag", "alpha-v1.1.0-rc.1");
commit("release: alpha v1.1.0", "alpha");
git("tag", "alpha-v1.1.0");
commit("feat(alpha): after the release", "alpha");

test("a release tag's notes run from the full release before it, up to the tag", () => {
  assert.equal(
    notesFor(root, "alpha", { tag: "alpha-v1.1.0" }),
    "### Features\n\n- a camera widget\n\n### Fixes\n\n- a fix inside alpha\n",
  );
});

test("a candidate's notes hold everything since the last full release", () => {
  assert.equal(
    notesFor(root, "alpha", { tag: "alpha-v1.1.0-rc.1" }),
    "### Features\n\n- a camera widget\n\n### Fixes\n\n- a fix inside alpha\n",
  );
});

test("an Uplink with no earlier full release has no change list, a candidate's included", () => {
  assert.equal(notesFor(root, "beta"), "First release.\n");
  git("tag", "beta-v1.0.0-rc.1");
  assert.equal(notesFor(root, "beta", { tag: "beta-v1.0.0-rc.1" }), "First release.\n");
});

test("another Uplink's commits never appear in a release's notes", () => {
  assert.ok(!notesFor(root, "alpha", { tag: "alpha-v1.1.0" }).includes("beta"));
});

test("without a tag the notes run from the latest full release to HEAD", () => {
  assert.equal(notesFor(root, "alpha"), "### Features\n\n- after the release\n");
});
