import assert from "node:assert/strict";
import { test } from "node:test";
import { externalEntries, missingExport, newestVersion, PLANTED_EXPORT, verdict } from "./published-bundle-check.mjs";

const linkError = (name) => `SyntaxError: The requested module '@ksp-gonogo/ui-kit' does not provide an export named '${name}'`;
const plantedFailed = { ok: false, message: linkError(PLANTED_EXPORT) };

test("the newest version ranks candidates numerically and a full release above them", () => {
  assert.equal(newestVersion(["1.0.0-rc.9", "1.0.0-rc.10", "1.0.0-rc.2"]), "1.0.0-rc.10");
  assert.equal(newestVersion(["1.0.0-rc.10", "1.0.0"]), "1.0.0");
  assert.equal(newestVersion(["1.0.0", "1.1.0-rc.1", "0.9.9"]), "1.1.0-rc.1");
});

test("a link error names the missing export, and another failure names none", () => {
  assert.equal(missingExport(linkError("CommandButton")), "CommandButton");
  assert.equal(missingExport("TypeError: Failed to fetch"), undefined);
});

test("every bundle loading passes", () => {
  assert.equal(verdict([{ ok: true }, { ok: true }], plantedFailed), 0);
});

test("one bundle failing fails the check", () => {
  assert.equal(verdict([{ ok: true }, { ok: false, message: linkError("CommandGroup") }], plantedFailed), 1);
});

test("the check is BLIND when the planted bundle loads or fails on anything else", () => {
  assert.equal(verdict([{ ok: true }], { ok: true }), 2);
  assert.equal(verdict([{ ok: true }], { ok: false, message: "TypeError: Failed to fetch" }), 2);
  assert.equal(verdict([{ ok: false, message: "x" }], { ok: true }), 2);
});

test("the import map entries come from the sdk's list, and an empty list is refused", () => {
  assert.deepEqual(externalEntries('  ["react", "ext-react"],\n  ["@ksp-gonogo/ui-kit", "ext-ui-kit"],'), [
    ["react", "ext-react"],
    ["@ksp-gonogo/ui-kit", "ext-ui-kit"],
  ]);
  assert.throws(() => externalEntries("nothing"), /no entries/);
});
