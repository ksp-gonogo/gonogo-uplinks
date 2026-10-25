import assert from "node:assert/strict";
import { mkdirSync, mkdtempSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { test } from "node:test";
import {
  normalise,
  problemsFor,
  assemblyVersion,
  rangeFloor,
  uplinkNames,
} from "./check-built-against.mjs";

test("every Uplink's builtAgainst agrees with its manifest and its client dependency", () => {
  const names = uplinkNames();
  assert.ok(names.length >= 12, "the walk found every Uplink");
  assert.deepEqual(
    names.flatMap((name) => problemsFor(name)),
    [],
  );
});

test("a client dependency that moved past builtAgainst is reported", () => {
  const root = mkdtempSync(join(tmpdir(), "built-against-"));
  const dir = join(root, "uplinks", "kerbcast");
  mkdirSync(join(dir, "client"), { recursive: true });
  writeFileSync(
    join(dir, "uplink.json"),
    JSON.stringify({ mod: { builtAgainst: "1.8.1" } }),
  );
  writeFileSync(
    join(dir, "client", "gonogo-uplink.json"),
    JSON.stringify({ mod: { builtAgainst: "1.8.1" } }),
  );
  writeFileSync(
    join(dir, "client", "package.json"),
    JSON.stringify({ dependencies: { "@ksp-gonogo/kerbcast": "^1.10.2" } }),
  );
  assert.deepEqual(problemsFor("kerbcast", root), [
    "kerbcast: the client depends on @ksp-gonogo/kerbcast ^1.10.2, builtAgainst is 1.8.1",
  ]);
});

test("a manifest that disagrees with uplink.json is reported", () => {
  const root = mkdtempSync(join(tmpdir(), "built-against-"));
  const dir = join(root, "uplinks", "x");
  mkdirSync(join(dir, "client"), { recursive: true });
  writeFileSync(join(dir, "uplink.json"), JSON.stringify({ mod: { builtAgainst: "2" } }));
  writeFileSync(
    join(dir, "client", "gonogo-uplink.json"),
    JSON.stringify({ mod: { builtAgainst: "1" } }),
  );
  assert.deepEqual(problemsFor("x", root), [
    "x: gonogo-uplink.json says 1, uplink.json says 2",
  ]);
});

test("a mod assembly whose version moved is reported, and a missing one only when required", () => {
  const root = mkdtempSync(join(tmpdir(), "built-against-"));
  const dir = join(root, "uplinks", "x");
  mkdirSync(join(dir, "mod"), { recursive: true });
  writeFileSync(
    join(dir, "uplink.json"),
    JSON.stringify({ mod: { builtAgainst: "20.4", assembly: "M/M.dll" } }),
  );
  assert.deepEqual(problemsFor("x", root), []);
  assert.deepEqual(problemsFor("x", root, { requireAssembly: true }), []);
  writeFileSync(join(dir, "mod", "X.csproj"), '<HintPath>$(KspGameData)\\M\\M.dll</HintPath>');
  assert.equal(problemsFor("x", root, { requireAssembly: true }).length, 1);
  mkdirSync(join(root, "vendor", "gamedata", "M"), { recursive: true });
  writeFileSync(
    join(root, "vendor", "gamedata", "M", "M.dll"),
    Buffer.concat([
      Buffer.from("junk"),
      Buffer.from("ProductVersion\0\0" + "21.1+abc\0\0", "utf16le"),
    ]),
  );
  assert.match(problemsFor("x", root)[0], /is 21\.1, builtAgainst is 20\.4/);
});

test("version helpers", () => {
  assert.equal(normalise("15.15.0"), normalise("v15.15.0.0"));
  assert.notEqual(normalise("20.4"), normalise("21.1"));
  assert.equal(rangeFloor("1.11.0-rc.10"), "1.11.0-rc.10");
  assert.equal(rangeFloor("^1.10.2"), "1.10.2");
  assert.equal(
    assemblyVersion(Buffer.from("ProductVersion\0\x001.6.0.1+d43\0\0", "utf16le")),
    "1.6.0.1",
  );
});
