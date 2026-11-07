import assert from "node:assert/strict";
import { test } from "node:test";
import { askPaths, flownStates, gap, keplerState, stateAt, toFixed } from "./compare.mjs";

const elements = { sma: 750e3, ecc: 0.001, inc: 10.8, lan: 40, argPe: 30, meanAnomalyAtEpoch: 1.2, epoch: 0, mu: 3.5316e12 };
const rotation = 230;
const toPlanetarium = (v) => toFixed(v, -rotation);

/* A craft on a pure conic, recorded the way the probe writes it: planetarium frame, 0.2 s frames. */
function record(seconds) {
  const lines = [];
  for (let ut = 0; ut <= seconds; ut = Math.round((ut + 0.2) * 10) / 10) {
    const s = keplerState(elements, ut);
    lines.push({ kind: "flown", ut, rotation, packed: true, q: toPlanetarium(s.q), p: toPlanetarium(s.p), elements });
  }
  return flownStates(lines);
}

test("a path on the flown states is zero from them, between frames too", () => {
  const flown = record(600);
  const path = [];
  for (let ut = 0; ut <= 600; ut += 7.3) path.push({ ut, ...keplerState(elements, ut) });
  assert.ok(gap(flown, path).worst.dq < 1e-4);
});

test("a path turned about the pole is far from the flown states", () => {
  const flown = record(600);
  const path = [];
  for (let ut = 0; ut <= 600; ut += 30) {
    const s = keplerState(elements, ut);
    path.push({ ut, q: toFixed(s.q, 1e-3), p: toFixed(s.p, 1e-3) });
  }
  assert.ok(gap(flown, path).worst.dq > 10);
});

test("the probe's planetarium state is turned back to the frame the elements are in", () => {
  const flown = record(1);
  const fromElements = keplerState(elements, flown[0].ut).q;
  flown[0].q.forEach((v, i) => assert.ok(Math.abs(v - fromElements[i]) < 1e-6));
});

test("outside the record there is no state", () => {
  assert.equal(stateAt(record(1), 5), null);
});

test("an ask capture's solved paths are read whatever the casing of their states", () => {
  const lines = [
    { reply: { solved: false } },
    { reply: { solved: true, path: { states: [{ ut: 1, x: 2, y: 3, z: 4, vx: 5, vy: 6, vz: 7 }] } } },
    { reply: { Solved: true, path: { States: [{ Ut: 1, X: 2, Y: 3, Z: 4, Vx: 5, Vy: 6, Vz: 7 }] } } },
  ];
  const paths = askPaths(lines);
  assert.equal(paths.length, 2);
  assert.deepEqual(paths[1][0], { ut: 1, q: [2, 3, 4], p: [5, 6, 7] });
});
