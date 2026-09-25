/**
 * Runs publish-release.mjs as a subprocess against a throwaway repo layout. The
 * script finds `uplinks/` and `artifacts/` relative to its own location, so each
 * case copies it into a temp root beside a fixture Uplink rather than reaching
 * into this repo's real ones.
 */
import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import {
  copyFileSync,
  existsSync,
  mkdirSync,
  mkdtempSync,
  readFileSync,
  writeFileSync,
} from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { test } from "node:test";
import { fileURLToPath } from "node:url";

const SCRIPT = join(dirname(fileURLToPath(import.meta.url)), "publish-release.mjs");
const URL_ON_RELEASES =
  "https://cdn.jsdelivr.net/gh/o/r@releases/fixture/0.0.2/fixture.client.js";

function fixture(url, bundle = "export {};\n") {
  const root = mkdtempSync(join(tmpdir(), "publish-release-"));
  mkdirSync(join(root, "tooling"));
  copyFileSync(SCRIPT, join(root, "tooling", "publish-release.mjs"));
  mkdirSync(join(root, "uplinks", "fixture"), { recursive: true });
  writeFileSync(
    join(root, "uplinks", "fixture", "uplink.json"),
    JSON.stringify({ id: "fixture", client: { url } }),
  );
  mkdirSync(join(root, "artifacts", "fixture"), { recursive: true });
  writeFileSync(join(root, "artifacts", "fixture", "fixture.client.js"), bundle);
  writeFileSync(
    join(root, "artifacts", "fixture", "gonogo-uplink.json"),
    JSON.stringify({ id: "fixture", integrity: bundle.length }),
  );
  return root;
}

function checkout(root, branch) {
  const dir = join(root, "releases-checkout");
  mkdirSync(dir);
  const git = (...args) =>
    assert.equal(spawnSync("git", ["-C", dir, ...args]).status, 0, args.join(" "));
  git("init", "-q", "-b", branch);
  return dir;
}

function publish(root, to, ...extra) {
  return spawnSync(
    "node",
    [join(root, "tooling", "publish-release.mjs"), "fixture", "--to", to, ...extra],
    { encoding: "utf8" },
  );
}

test("a jsDelivr branch URL lands at its path inside a checkout of that branch", () => {
  const root = fixture(URL_ON_RELEASES);
  const to = checkout(root, "releases");
  const run = publish(root, to, "--base", "https://cdn.jsdelivr.net");
  assert.equal(run.status, 0, run.stderr);
  assert.equal(
    readFileSync(join(to, "fixture", "0.0.2", "fixture.client.js"), "utf8"),
    "export {};\n",
  );
  assert.ok(existsSync(join(to, "fixture", "0.0.2", "gonogo-uplink.json")));
  assert.ok(!existsSync(join(to, "gh")));
});

test("a checkout of a different branch is refused", () => {
  const root = fixture(URL_ON_RELEASES);
  const to = checkout(root, "main");
  const run = publish(root, to);
  assert.equal(run.status, 1);
  assert.match(run.stderr, /served from ref releases, but .* is\n\s+a checkout of main/);
  assert.ok(!existsSync(join(to, "fixture")));
});

test("a directory inside a checkout, rather than its root, is refused", () => {
  const root = fixture(URL_ON_RELEASES);
  const to = join(checkout(root, "releases"), "nested");
  mkdirSync(to);
  const run = publish(root, to);
  assert.equal(run.status, 1);
  assert.match(run.stderr, /not the root of a git checkout/);
});

test("a jsDelivr URL with no ref is refused", () => {
  const root = fixture("https://cdn.jsdelivr.net/gh/o/r/fixture/0.0.2/fixture.client.js");
  const run = publish(root, checkout(root, "releases"));
  assert.equal(run.status, 1);
  assert.match(run.stderr, /names no @<ref>/);
});

test("a published version is never overwritten, and an identical re-run is harmless", () => {
  const root = fixture(URL_ON_RELEASES);
  const to = checkout(root, "releases");
  assert.equal(publish(root, to).status, 0);
  assert.equal(publish(root, to).status, 0, "identical bytes re-publish");

  writeFileSync(join(root, "artifacts", "fixture", "fixture.client.js"), "export const x = 1;\n");
  const run = publish(root, to);
  assert.equal(run.status, 1);
  assert.match(run.stderr, /already published with different bytes/);
  assert.equal(
    readFileSync(join(to, "fixture", "0.0.2", "fixture.client.js"), "utf8"),
    "export {};\n",
  );
});
