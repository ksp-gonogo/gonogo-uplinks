import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { mkdirSync, mkdtempSync, readdirSync, readFileSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { test } from "node:test";
import { uplinkNames } from "./check-built-against.mjs";
import {
  addToZip,
  internalCkan,
  readFromZip,
  readUplink,
} from "./internal-ckan.mjs";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");

/** A release zip holding just the Uplink's GameData folder. */
function releaseZip(gamedata, extra = []) {
  const dir = mkdtempSync(join(tmpdir(), "internal-ckan-test-"));
  mkdirSync(join(dir, "GameData", gamedata), { recursive: true });
  writeFileSync(join(dir, "GameData", gamedata, `${gamedata}.dll`), "dll");
  for (const file of extra) writeFileSync(join(dir, "GameData", gamedata, file), "x");
  const zip = join(dir, "release.zip");
  execFileSync("zip", ["-qr", zip, "GameData"], { cwd: dir });
  return zip;
}

test("an Uplink depends on its mod at builtAgainst, and on GonogoCore", () => {
  assert.deepEqual(internalCkan(readUplink("kerbcast")), {
    depends: [
      { name: "Kerbcast", min_version: "1.11.0-rc.10" },
      { name: "GonogoCore" },
    ],
  });
});

test("an Uplink whose mod is not on CKAN names no mod in its depends", () => {
  const names = internalCkan(readUplink("principia")).depends.map((dep) => dep.name);
  assert.ok(!names.includes("Principia"));
});

test("every Uplink names its mod's CKAN identifier and a version, or is manual", () => {
  for (const name of uplinkNames()) {
    const { uplink } = readUplink(name);
    if (uplink.mod.tier === "ckan") {
      assert.ok(uplink.mod.ckan, `${name} names no mod.ckan`);
      assert.ok(uplink.mod.builtAgainst, `${name} names no builtAgainst`);
    }
    assert.equal(internalCkan(readUplink(name)).depends.at(-1).name, "GonogoCore");
  }
});

test("the file read back out of a release zip is the one generated", () => {
  const facts = readUplink("kerbcast");
  const zip = releaseZip(facts.uplink.gamedata);
  const entry = addToZip(zip, facts);
  assert.equal(entry, "GameData/GonogoKerbcastUplink/GonogoKerbcastUplink.ckan");
  assert.deepEqual(JSON.parse(readFromZip(zip)), internalCkan(facts));
});

test("a zip that already holds a .ckan, or another Uplink's zip, is refused", () => {
  const facts = readUplink("kerbcast");
  assert.throws(
    () => addToZip(releaseZip(facts.uplink.gamedata, ["other.ckan"]), facts),
    /more than one/,
  );
  assert.throws(() => addToZip(releaseZip("GonogoKosUplink"), facts), /not this Uplink's release zip/);
});

test("an Uplink lists Harmony2 exactly when its mod project references 0Harmony", () => {
  for (const name of uplinkNames()) {
    const dir = join(ROOT, "uplinks", name, "mod");
    const references = readdirSync(dir)
      .filter((file) => file.endsWith(".csproj"))
      .some((file) => /<Reference Include="0Harmony"/.test(readFileSync(join(dir, file), "utf8")));
    const { uplink } = readUplink(name);
    const listed = (uplink.ckanDepends ?? []).some((dep) => dep.name === "Harmony2");
    assert.equal(listed, references, `${name}: ckanDepends and the 0Harmony reference disagree`);
  }
});

test("ckanDepends reach the generated file, ahead of GonogoCore", () => {
  assert.deepEqual(internalCkan(readUplink("principia")).depends, [
    { name: "Harmony2" },
    { name: "GonogoCore" },
  ]);
});
