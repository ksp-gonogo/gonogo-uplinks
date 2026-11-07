import assert from "node:assert/strict";
import { test } from "node:test";
import { compose, markdown } from "./uplink-deps-summary.mjs";

const dep = (extra = {}) => ({ name: "Mod", pinned: "1", newest: "2", state: "behind", reportOnly: false, channels: [], ...extra });

test("nothing behind is up to date", () => {
  const s = compose({ uplink: "u", code: 0, report: { dependencies: [dep({ state: "current", newest: "1" })] } });
  assert.equal(s.state, "up-to-date");
  assert.equal(s.dependencies[0].outcome, "up-to-date");
});

test("a channel that could not be read is an error with its text", () => {
  const s = compose({
    uplink: "u",
    code: 2,
    report: { dependencies: [dep({ channels: [{ error: "ckan X answered 403" }] })] },
  });
  assert.equal(s.state, "error");
  assert.equal(s.dependencies[0].reason, "ckan X answered 403");
});

test("a bump reports what the run recorded, red first", () => {
  const s = compose({
    uplink: "u",
    code: 10,
    report: { dependencies: [dep(), dep({ name: "Other" })] },
    outcomes: [{ name: "Mod", from: "1", to: "2", outcome: "red", reason: "interface: Burn moved", url: "u/1" }],
  });
  assert.equal(s.state, "red");
  assert.equal(s.dependencies[1].outcome, "up-to-date");
  assert.match(markdown(s), /\| Mod \| 1 \| 2 \| red \| interface: Burn moved u\/1 \|/);
});

test("a bump that left no record is an error, never a quiet pass", () => {
  const s = compose({ uplink: "u", code: 10, report: { dependencies: [dep()] } });
  assert.equal(s.dependencies[0].outcome, "error");
});

test("an unexpected exit of the read is an error", () => {
  assert.equal(compose({ uplink: "u", code: 1, report: undefined }).state, "error");
});

test("gonogo's own packages are not part of the summary", () => {
  const s = compose({ uplink: "u", code: 0, report: { dependencies: [dep({ reportOnly: true })] } });
  assert.deepEqual(s.dependencies, []);
});
