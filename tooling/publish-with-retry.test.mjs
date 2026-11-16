/**
 * A refused push to `releases` retries from the committed release, and a
 * failure with no committed release behind it still fails. Real git
 * repositories stand in for the remote and the Uplink's `.releases` checkout;
 * only `uplink-tools publish` is replaced.
 */
import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { mkdirSync, mkdtempSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { test } from "node:test";
import { publishWithRetry } from "./publish-with-retry.mjs";

/* The throwaway repositories here have no use for a machine's global hooks. */
process.env.GIT_CONFIG_COUNT = "1";
process.env.GIT_CONFIG_KEY_0 = "core.hooksPath";
process.env.GIT_CONFIG_VALUE_0 = "/dev/null";

const git = (dir, ...args) =>
  execFileSync("git", ["-C", dir, "-c", "user.name=t", "-c", "user.email=t@t", ...args], { encoding: "utf8" }).trim();

const silent = { error() {}, warn() {} };
const messages = () => {
  const seen = [];
  return { seen, log: { error: (m) => seen.push(m), warn: (m) => seen.push(m) } };
};

/** A bare remote with one commit on `releases`, and a clone of it standing in for `.releases`. */
function fixture() {
  const root = mkdtempSync(join(process.env.TMPDIR ?? tmpdir(), "retry-"));
  const remote = join(root, "remote.git");
  execFileSync("git", ["init", "-q", "--bare", "-b", "releases", remote]);
  const seed = join(root, "seed");
  execFileSync("git", ["clone", "-q", remote, seed]);
  git(seed, "checkout", "-q", "-B", "releases");
  writeFileSync(join(seed, "base.txt"), "base");
  git(seed, "add", "-A");
  git(seed, "commit", "-q", "-m", "base");
  git(seed, "push", "-q", "origin", "releases");
  const checkout = join(root, "uplinks", "mine", ".releases");
  mkdirSync(join(root, "uplinks", "mine"), { recursive: true });
  execFileSync("git", ["clone", "-q", "-b", "releases", remote, checkout]);
  /** Another Uplink's release landing on the remote. */
  const rival = () => {
    writeFileSync(join(seed, "rival.txt"), String(Math.random()));
    git(seed, "add", "-A");
    git(seed, "commit", "-q", "-m", "rival");
    git(seed, "push", "-q", "origin", "releases");
  };
  return { remote, checkout, rival };
}

/** The publish step: commit once, then push, refusing the first push with the given text. */
function publisher({ checkout, refuseWith, commit = true }) {
  let calls = 0;
  const publish = () => {
    calls++;
    if (commit && calls === 1) {
      writeFileSync(join(checkout, "mine.txt"), "mine");
      git(checkout, "add", "-A");
      git(checkout, "commit", "-q", "-m", "mine");
    }
    if (calls === 1) return { ok: false, out: refuseWith };
    try {
      git(checkout, "push", "origin", "releases");
      return { ok: true, out: "" };
    } catch (err) {
      return { ok: false, out: String(err.stderr ?? err.message) };
    }
  };
  return { publish, calls: () => calls };
}

for (const refuseWith of [
  "! [remote rejected] releases -> releases (cannot lock ref 'refs/heads/releases': is at 360e021 but expected 79c0448)",
  "! [rejected] releases -> releases (non-fast-forward)",
]) {
  test(`a refused push (${refuseWith.slice(2, 22)}) after a committed release is rebased and published`, async () => {
    const { remote, checkout, rival } = fixture();
    rival();
    const { publish, calls } = publisher({ checkout, refuseWith });
    const waits = [];
    const code = await publishWithRetry({ publish, checkout, wait: async (ms) => waits.push(ms), log: silent });
    assert.equal(code, 0);
    assert.equal(calls(), 2);
    assert.equal(waits.length, 1);
    const files = git(remote, "ls-tree", "-r", "--name-only", "releases").split("\n");
    assert.deepEqual(files.sort(), ["base.txt", "mine.txt", "rival.txt"]);
  });
}

test("a refusal with nothing committed fails loudly without retrying", async () => {
  const { checkout } = fixture();
  const { publish, calls } = publisher({
    checkout,
    refuseWith: "cannot lock ref 'refs/heads/releases'",
    commit: false,
  });
  const { seen, log } = messages();
  const code = await publishWithRetry({ publish, checkout, wait: async () => {}, log });
  assert.equal(code, 1);
  assert.equal(calls(), 1);
  assert.match(seen.join("\n"), /nothing unsent/);
});

test("a failure that is not a refused push is not retried", async () => {
  const { checkout } = fixture();
  let calls = 0;
  const code = await publishWithRetry({
    publish: () => (calls++, { ok: false, out: "the bundle differs from the one published" }),
    checkout,
    wait: async () => {},
    log: silent,
  });
  assert.equal(code, 1);
  assert.equal(calls, 1);
});

test("a push refused every time gives up after the bounded attempts", async () => {
  const { checkout } = fixture();
  writeFileSync(join(checkout, "mine.txt"), "mine");
  git(checkout, "add", "-A");
  git(checkout, "commit", "-q", "-m", "mine");
  let calls = 0;
  const code = await publishWithRetry({
    publish: () => (calls++, { ok: false, out: "non-fast-forward" }),
    checkout,
    attempts: 3,
    wait: async () => {},
    log: silent,
  });
  assert.equal(code, 1);
  assert.equal(calls, 3);
});
