import assert from "node:assert/strict";
import { test } from "node:test";
import { ckanUplinks, pinProblem } from "./check-ckan-pins.mjs";

test("an exact spelling is no problem", () => {
  assert.equal(pinProblem("realfuels", "1:v15.15.0.0", "1:v15.15.0.0"), undefined);
});

test("a missing ckanVersion names the spelling CKAN lists", () => {
  assert.match(pinProblem("kos", undefined, "1:1.6.0.1"), /missing.*1:1\.6\.0\.1/);
});

test("the bare pin is not CKAN's spelling when CKAN adds an epoch or a v", () => {
  assert.match(pinProblem("rp1", "4.7.0.0", "v4.7.0.0"), /is 4\.7\.0\.0.*v4\.7\.0\.0/);
});

test("the walk finds every CKAN-listed Uplink and none that players install by hand", () => {
  const names = ckanUplinks();
  assert.ok(names.length >= 12);
  assert.ok(!names.includes("principia"));
});
