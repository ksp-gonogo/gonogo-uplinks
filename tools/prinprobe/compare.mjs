/**
 * Sets a private copy's path beside the game's own Principia, as recorded by the probe.
 *
 *   node compare.mjs --flown flown-<ut>.jsonl [--path prinprobe-path-<ut>.jsonl] [--ask ask.jsonl] [--plan plan-<ut>.jsonl]
 *
 * `--ask` reads the replies an ask script recorded (one JSON line per ask, the reply under
 * `reply`) and compares every solved path in it.
 *
 * Everything is compared in KSP's fixed frame. A probe line holds Principia's state in its
 * planetarium frame at that line's rotation; the copy's path is already fixed. The game's
 * state between two recorded frames is a cubic Hermite through both, whose error over a
 * 0.2 s frame at 10x is far below a millimetre in low orbit.
 *
 * It also reports how far gonogo's own seed, the two-body state from KSP's elements, sits
 * from Principia's state at every frame: the seed error a command centre's archive carries.
 */
import { readFileSync } from "node:fs";

export const toFixed = ([x, y, z], degrees) => {
  const r = (degrees * Math.PI) / 180;
  return [Math.cos(r) * x - Math.sin(r) * y, Math.sin(r) * x + Math.cos(r) * y, z];
};

const sub = (a, b) => a.map((v, i) => v - b[i]);
const norm = (a) => Math.hypot(...a);

export function readJsonLines(path) {
  return readFileSync(path, "utf8")
    .split("\n")
    .filter((l) => l.trim())
    .map((l) => JSON.parse(l));
}

/** The probe's flown lines, fixed frame, in time order, one per instant. */
export function flownStates(lines) {
  const seen = new Set();
  return lines
    .filter((l) => l.kind === "flown")
    .filter((l) => (seen.has(l.ut) ? false : seen.add(l.ut)))
    .sort((a, b) => a.ut - b.ut)
    .map((l) => ({ ut: l.ut, q: toFixed(l.q, l.rotation), p: toFixed(l.p, l.rotation), line: l }));
}

/** The game's state at `ut` by cubic Hermite between the frames either side, or null outside them. */
export function stateAt(flown, ut) {
  let lo = 0;
  let hi = flown.length - 1;
  if (!flown.length || ut < flown[0].ut || ut > flown[hi].ut) return null;
  while (hi - lo > 1) {
    const mid = (lo + hi) >> 1;
    if (flown[mid].ut <= ut) lo = mid;
    else hi = mid;
  }
  const a = flown[lo];
  const b = flown[hi];
  const h = b.ut - a.ut;
  if (h === 0) return { q: a.q, p: a.p };
  const s = (ut - a.ut) / h;
  const h00 = 2 * s ** 3 - 3 * s ** 2 + 1;
  const h10 = s ** 3 - 2 * s ** 2 + s;
  const h01 = -2 * s ** 3 + 3 * s ** 2;
  const h11 = s ** 3 - s ** 2;
  const d00 = (6 * s ** 2 - 6 * s) / h;
  const d10 = 3 * s ** 2 - 4 * s + 1;
  const d01 = (-6 * s ** 2 + 6 * s) / h;
  const d11 = 3 * s ** 2 - 2 * s;
  const q = a.q.map((_, i) => h00 * a.q[i] + h10 * h * a.p[i] + h01 * b.q[i] + h11 * h * b.p[i]);
  const p = a.q.map((_, i) => d00 * a.q[i] + d10 * a.p[i] + d01 * b.q[i] + d11 * b.p[i]);
  return { q, p };
}

/** KSP's two-body state from its own elements, the way gonogo builds a seed: fixed frame. */
export function keplerState(el, ut) {
  const { sma: a, ecc: e, mu } = el;
  const d = Math.PI / 180;
  const n = Math.sqrt(mu / Math.abs(a) ** 3);
  let M = el.meanAnomalyAtEpoch + n * (ut - el.epoch);
  M = ((M % (2 * Math.PI)) + 2 * Math.PI) % (2 * Math.PI);
  let E = e < 0.8 ? M : Math.PI;
  for (let k = 0; k < 50; k++) {
    const dE = (E - e * Math.sin(E) - M) / (1 - e * Math.cos(E));
    E -= dE;
    if (Math.abs(dE) < 1e-15) break;
  }
  const nu = 2 * Math.atan2(Math.sqrt(1 + e) * Math.sin(E / 2), Math.sqrt(1 - e) * Math.cos(E / 2));
  const r = a * (1 - e * Math.cos(E));
  const pSemi = a * (1 - e * e);
  const xp = r * Math.cos(nu);
  const yp = r * Math.sin(nu);
  const vxp = -Math.sqrt(mu / pSemi) * Math.sin(nu);
  const vyp = Math.sqrt(mu / pSemi) * (e + Math.cos(nu));
  const [O, i, w] = [el.lan * d, el.inc * d, el.argPe * d];
  const R = (x, y) => [
    (Math.cos(O) * Math.cos(w) - Math.sin(O) * Math.sin(w) * Math.cos(i)) * x +
      (-Math.cos(O) * Math.sin(w) - Math.sin(O) * Math.cos(w) * Math.cos(i)) * y,
    (Math.sin(O) * Math.cos(w) + Math.cos(O) * Math.sin(w) * Math.cos(i)) * x +
      (-Math.sin(O) * Math.sin(w) + Math.cos(O) * Math.cos(w) * Math.cos(i)) * y,
    Math.sin(w) * Math.sin(i) * x + Math.cos(w) * Math.sin(i) * y,
  ];
  return { q: R(xp, yp), p: R(vxp, vyp) };
}

/** Every solved path in an ask capture, as timed fixed-frame states. */
export function askPaths(lines) {
  const pick = (o, ...names) => names.map((n) => o[n] ?? o[n[0].toUpperCase() + n.slice(1)]);
  return lines
    .map((l) => l.reply?.path ?? l.reply)
    .filter((path) => path && (path.states ?? path.States))
    .map((path) =>
      (path.states ?? path.States).map((s) => {
        const [ut, x, y, z, vx, vy, vz] = pick(s, "ut", "x", "y", "z", "vx", "vy", "vz");
        return { ut, q: [x, y, z], p: [vx, vy, vz] };
      }),
    );
}

const MARKS = [5, 10, 15, 30, 50];

/** Distances of a timed path from the game's flown states, at the marks and at worst. */
export function gap(flown, path) {
  const start = path[0].ut;
  const rows = path
    .map((s) => ({ ut: s.ut, at: stateAt(flown, s.ut), s }))
    .filter((r) => r.at)
    .map((r) => ({ min: (r.ut - start) / 60, dq: norm(sub(r.s.q, r.at.q)), dp: norm(sub(r.s.p, r.at.p)) }));
  const nearest = (m) => rows.reduce((b, r) => (Math.abs(r.min - m) < Math.abs(b.min - m) ? r : b), rows[0]);
  const worst = rows.reduce((b, r) => (r.dq > b.dq ? r : b), rows[0]);
  return { rows, marks: MARKS.map((m) => ({ m, ...nearest(m) })), worst };
}

const fmt = (x) => (x < 0.001 ? x.toExponential(2) : x.toFixed(3));

function report(name, g) {
  if (!g.rows.length) return console.log(`${name}: no overlap with the flown record`);
  console.log(
    `${name}: path[0] ${fmt(g.rows[0].dq)} m, ${fmt(g.rows[0].dp)} m/s | ` +
      g.marks.map((r) => `+${r.m} ${fmt(r.dq)}`).join("  ") +
      ` | max ${fmt(g.worst.dq)} m at ${g.worst.min.toFixed(1)} min (${g.rows.length} points)`,
  );
}

function main() {
  const flags = {};
  const argv = process.argv.slice(2);
  for (let i = 0; i < argv.length; i += 2) flags[argv[i].slice(2)] = argv[i + 1];
  const flown = flownStates(readJsonLines(flags.flown));
  console.log(`flown: ${flown.length} frames, UT ${flown[0].ut} to ${flown.at(-1).ut}`);

  const agree = flown.map((f) => Math.max(norm(sub(f.line.q, f.line.orbitPos)), norm(sub(f.line.p, f.line.orbitVel))));
  console.log(`KSP orbit.pos/vel vs Principia, worst over the record: ${fmt(Math.max(...agree))}`);

  const seedErr = flown.map((f) => {
    const k = keplerState(f.line.elements, f.ut);
    return { ut: f.ut, packed: f.line.packed, dq: norm(sub(k.q, f.q)), dp: norm(sub(k.p, f.p)) };
  });
  for (const packed of [true, false]) {
    const set = seedErr.filter((s) => s.packed === packed);
    if (set.length)
      console.log(
        `gonogo seed from elements vs Principia, ${packed ? "on rails" : "under physics"}: worst ` +
          `${fmt(Math.max(...set.map((s) => s.dq)))} m, ${fmt(Math.max(...set.map((s) => s.dp)))} m/s over ${set.length} frames`,
      );
  }

  if (flags.path) report("copy", gap(flown, readJsonLines(flags.path)));
  if (flags.ask)
    askPaths(readJsonLines(flags.ask)).forEach((path, i) => report(`ask ${i + 1} from UT ${path[0].ut}`, gap(flown, path)));
  if (flags.plan) {
    const plan = readJsonLines(flags.plan)
      .filter((l) => l.kind === "plan")
      .map((l) => ({ ut: l.ut, q: toFixed(l.q, l.rotation), p: toFixed(l.p, l.rotation) }));
    for (const f of readJsonLines(flags.plan).filter((l) => l.kind === "fact")) console.log(`plan ${f.name}: ${f.value}`);
    if (plan.length) report("game's flight-plan coast", gap(flown, plan));
  }
}

if (import.meta.url === `file://${process.argv[1]}`) main();
