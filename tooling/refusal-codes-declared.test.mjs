/**
 * Every refusal code an Uplink's C# can return is declared in its manifest.
 *
 * A manifest declares `ErrorCodeCatalog.Of(typeof(X))`, which reads the public
 * static `RefusalCode` fields of X. So a code is declared exactly when it is
 * such a field of the catalogued class, and the three ways to miss are a
 * refinement made anywhere but a field of that class, a field the catalog does
 * not read, and a reference to another Uplink's codes.
 *
 * The host sends an undeclared code as the mod gave it and logs it, so a miss
 * here is a refusal the roster cannot give a sentence to.
 */
import assert from "node:assert/strict";
import { readdirSync, readFileSync, statSync } from "node:fs";
import { dirname, join, relative } from "node:path";
import { test } from "node:test";
import { fileURLToPath } from "node:url";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const SKIPPED = new Set(["obj", "bin", "node_modules", "mod-tests", "mod-devtools"]);

function csFiles(dir) {
  const found = [];
  for (const name of readdirSync(dir)) {
    if (SKIPPED.has(name)) continue;
    const path = join(dir, name);
    if (statSync(path).isDirectory()) found.push(...csFiles(path));
    else if (name.endsWith(".cs")) found.push(path);
  }
  return found;
}

/** Comments out, so a doc comment naming a code is not read as a use of it. */
function code(text) {
  return text.replace(/\/\*[\s\S]*?\*\//g, "").replace(/\/\/.*$/gm, "");
}

/**
 * The problems in one Uplink's sources, given as `{ path, text }` pairs, each
 * a sentence naming the file.
 */
function problemsIn(sources) {
  const problems = [];
  const stripped = sources.map((s) => ({ path: s.path, text: code(s.text) }));
  const catalogued = new Set();
  for (const s of stripped) {
    for (const m of s.text.matchAll(/ErrorCodeCatalog\.Of\(typeof\((\w+)\)\)/g)) catalogued.add(m[1]);
  }

  const holders = new Set();
  for (const s of stripped) {
    const declares = [...s.text.matchAll(/\.Refine\(/g)];
    if (declares.length === 0) continue;
    const classes = [...s.text.matchAll(/static class (\w+)/g)].map((m) => m[1]);
    const holder = classes.find((c) => catalogued.has(c));
    if (!holder) {
      problems.push(`${s.path} refines a code outside any class the manifest catalogues`);
      continue;
    }
    holders.add(holder);
    const fields = [...s.text.matchAll(/public static readonly RefusalCode \w+\s*=\s*[\w.]+\.Refine\(/g)];
    if (fields.length !== declares.length) {
      problems.push(
        `${s.path} has ${declares.length - fields.length} refinement(s) that are not a public static readonly RefusalCode field, which the catalog does not read`,
      );
    }
  }

  for (const s of stripped) {
    for (const m of s.text.matchAll(/\b(\w+ErrorCodes)\.[A-Z]\w*/g)) {
      if (!catalogued.has(m[1])) {
        problems.push(`${s.path} returns ${m[0]}, which this Uplink's manifest does not declare`);
      }
    }
  }
  return problems;
}

const uplinksDir = join(root, "uplinks");
const uplinks = readdirSync(uplinksDir).filter((n) => statSync(join(uplinksDir, n)).isDirectory());

for (const name of uplinks) {
  test(`${name}: every refusal code its C# can return is declared`, () => {
    const sources = csFiles(join(uplinksDir, name)).map((path) => ({
      path: relative(root, path),
      text: readFileSync(path, "utf8"),
    }));
    assert.deepEqual(problemsIn(sources), []);
  });
}

test("the Uplinks that declare codes are found, so the scan is not reading nothing", () => {
  const declaring = uplinks.filter((name) =>
    csFiles(join(uplinksDir, name)).some((p) => /ErrorCodeCatalog\.Of\(/.test(readFileSync(p, "utf8"))),
  );
  assert.ok(declaring.length >= 5, `found ${declaring.join(", ")}`);
});

test("the scan fails a refinement made outside the catalogued class", () => {
  const problems = problemsIn([
    { path: "Uplink.cs", text: "ErrorCodes = ErrorCodeCatalog.Of(typeof(DemoErrorCodes));" },
    { path: "Codes.cs", text: "public static class DemoErrorCodes { public static readonly RefusalCode A = Root.Refine(\"demo.a\", \"a\"); }" },
    { path: "Handler.cs", text: "var late = CommandErrorCode.ModeUnavailable.Refine(\"demo.late\", \"late\");" },
  ]);
  assert.equal(problems.length, 1);
  assert.match(problems[0], /Handler\.cs refines a code outside/);
});

test("the scan fails a refinement the catalog would not read", () => {
  const problems = problemsIn([
    { path: "Uplink.cs", text: "ErrorCodeCatalog.Of(typeof(DemoErrorCodes))" },
    { path: "Codes.cs", text: "public static class DemoErrorCodes { private static readonly RefusalCode A = Root.Refine(\"demo.a\", \"a\"); }" },
  ]);
  assert.equal(problems.length, 1);
  assert.match(problems[0], /not a public static readonly RefusalCode field/);
});

test("the scan fails a return of another Uplink's code and spares a comment naming one", () => {
  const problems = problemsIn([
    { path: "Uplink.cs", text: "ErrorCodeCatalog.Of(typeof(DemoErrorCodes))" },
    { path: "Codes.cs", text: "public static class DemoErrorCodes { public static readonly RefusalCode A = Root.Refine(\"demo.a\", \"a\"); }" },
    { path: "Handler.cs", text: "// see OtherErrorCodes.Gone\nreturn CommandResult.Fail(ThirdErrorCodes.Gone);" },
  ]);
  assert.equal(problems.length, 1);
  assert.match(problems[0], /ThirdErrorCodes\.Gone/);
});
