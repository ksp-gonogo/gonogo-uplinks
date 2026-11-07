import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { test } from "node:test";
import { fileURLToPath } from "node:url";
import { describeMoves, diffInterface, parseDeclarations, usedBy } from "./principia-proto.mjs";

const here = dirname(fileURLToPath(import.meta.url));
const tag = (name) => readFileSync(join(here, "testdata/principia", `${name}.journal.proto`), "utf8");
const MODS = join(here, "../uplinks/principia/mod");

test("the committed vetted copy is the pinned release's file", () => {
  const vetted = readFileSync(join(here, "../uplinks/principia/journal.proto"), "utf8");
  assert.equal(vetted, tag("2026081218-Levi-Civita"));
});

test("a comment or a layout change is not a change of shape", () => {
  const a = "message A {\n  required int32 x = 1;  // one\n}\n";
  const b = "message A {\n    required int32 x = 1;\n}\n";
  assert.deepEqual(diffInterface(a, b, ["A"]), { removed: [], changed: [], added: [] });
});

test("nested messages stay inside their parent", () => {
  const found = parseDeclarations("message A {\n  message In { required int32 x = 1; }\n  optional In in = 1;\n}\nmessage B {}\n");
  assert.deepEqual([...found.keys()], ["A", "B"]);
});

test("a declaration the Uplink does not use may go without a finding", () => {
  const a = "message A {}\nmessage B {}\n";
  assert.deepEqual(diffInterface(a, "message A {}\n", ["A"]), { removed: [], changed: [], added: [] });
  assert.equal(describeMoves(diffInterface(a, "message A {}\n", ["A"]), "1", "2"), undefined);
});

test("Levi-Civita to Lichnerowicz names the removed export and the reshaped message", () => {
  const vetted = tag("2026081218-Levi-Civita");
  const next = tag("2026101016-Lichnerowicz");
  const moves = diffInterface(vetted, next, usedBy(parseDeclarations(vetted).keys(), MODS));
  assert.deepEqual(moves.removed, ["FlightPlanRenderedSegment"]);
  assert.deepEqual(moves.changed, ["Burn"]);
  assert.match(
    describeMoves(moves, "2026081218-Levi-Civita", "2026101016-Lichnerowicz"),
    /FlightPlanRenderedSegment is gone; Burn has a different shape/,
  );
});

test("the same release against itself moves nothing", () => {
  const vetted = tag("2026081218-Levi-Civita");
  const moves = diffInterface(vetted, vetted, usedBy(parseDeclarations(vetted).keys(), MODS));
  assert.equal(describeMoves(moves, "a", "b"), undefined);
});
