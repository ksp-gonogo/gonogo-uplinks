/**
 * Only a full release reaches SpaceDock, and SpaceDock feeds CKAN, so a
 * candidate that got there would reach players. These pin the decision in the
 * script and, below, that the workflow gates every SpaceDock step the same way.
 */
import assert from "node:assert/strict";
import { test } from "node:test";
import {
  changelogOf,
  eligible,
  listingHolds,
  modIdOf,
  parseTag,
  spacedockVersion,
} from "./spacedock-release.mjs";

test("only a plain X.Y.Z version is eligible, whatever the prerelease suffix", () => {
  assert.equal(eligible("kos-v1.0.0"), true);
  assert.equal(eligible("actionGroupsExtended-v12.3.4"), true);
  for (const tag of [
    "kos-v1.0.0-rc.1",
    "kos-v1.0.0-rc.12",
    "kos-v1.0.0-beta.1",
    "kos-v1.0.0-alpha",
    "kos-v1.0.0-0",
    "kos-v1.0.0-RC.1",
    "kos-v1.0.0-rc.1+build",
    "kos-1.0.0",
    "v1.0.0",
    "",
  ]) {
    assert.equal(eligible(tag), false, `${tag} must not reach SpaceDock`);
  }
});

test("a prerelease tag cannot even be given a SpaceDock version", () => {
  assert.throws(() => spacedockVersion("kos-v1.0.0-rc.1"), /never uploaded/);
  assert.equal(spacedockVersion("kos-v1.0.0"), "1.0.0");
});

test("a tag splits into its Uplink, version and prerelease", () => {
  assert.deepEqual(parseTag("rp1-v1.0.0-rc.3"), {
    id: "rp1",
    core: "1.0.0",
    prerelease: "rc.3",
  });
  assert.equal(parseTag("nonsense"), undefined);
});

test("the listing id is read from uplink.json and must be a number", () => {
  assert.equal(modIdOf({ spacedock: { modId: 4021 } }), "4021");
  assert.equal(modIdOf({ spacedock: { modId: "4021" } }), "4021");
  assert.equal(modIdOf({}), "");
  assert.equal(modIdOf({ spacedock: {} }), "");
  assert.throws(() => modIdOf({ spacedock: { modId: "abc" } }), /a number/);
});

test("a version SpaceDock already lists is held, and an unreadable reply is an error", () => {
  const listing = { versions: [{ friendly_version: "1.0.0" }] };
  assert.equal(listingHolds(listing, "1.0.0"), true);
  assert.equal(listingHolds(listing, "1.0.1"), false);
  assert.throws(() => listingHolds({ error: true }, "1.0.0"), /no versions list/);
});

test("the changelog keeps features and fixes and counts the rest as one line", () => {
  const text = changelogOf([
    "feat(scansat): footprints draw across the map's edge",
    "fix(scansat)!: the scan no longer stalls",
    "chore: regenerate Uplink pages",
    "docs: wording",
  ]);
  assert.match(text, /\*\*Features\*\*\n\n- footprints draw across the map's edge/);
  assert.match(text, /\*\*Bug Fixes\*\*\n\n- the scan no longer stalls/);
  assert.match(text, /Other changes: maintenance, documentation and tests\./);
  assert.equal(changelogOf([]), "First release.\n");
});

import { spawnSync } from "node:child_process";
import { mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { fileURLToPath } from "node:url";

test("require-mod-id fails with a clear error when an Uplink has no listing id, and never guesses one", () => {
  const dir = mkdtempSync(join(tmpdir(), "spacedock-"));
  try {
    const script = fileURLToPath(new URL("./spacedock-release.mjs", import.meta.url));
    const none = join(dir, "none.json");
    writeFileSync(none, JSON.stringify({ id: "kos" }));
    const refused = spawnSync("node", [script, "require-mod-id", none], { encoding: "utf8" });
    assert.equal(refused.status, 1);
    assert.match(refused.stderr, /no spacedock\.modId/);
    assert.match(refused.stderr, /Nothing was published/);
    assert.equal(refused.stdout, "");
    const some = join(dir, "some.json");
    writeFileSync(some, JSON.stringify({ id: "kos", spacedock: { modId: 4021 } }));
    const ok = spawnSync("node", [script, "require-mod-id", some], { encoding: "utf8" });
    assert.equal(ok.status, 0);
    assert.equal(ok.stdout.trim(), "4021");
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});
