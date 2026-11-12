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

test("an Uplink depends on its mod at builtAgainst, and on Gonogo", () => {
  const kerbcast = readUplink("kerbcast");
  assert.deepEqual(internalCkan(kerbcast), {
    depends: [
      { name: "Kerbcast", min_version: kerbcast.uplink.mod.builtAgainst },
      { name: "Gonogo" },
    ],
  });
});

test("min_version is the pinned release in CKAN's own spelling when the Uplink records it", () => {
  const facts = readUplink("rp1");
  facts.uplink.mod = { ...facts.uplink.mod, builtAgainst: "4.8.0.0", ckanVersion: "v4.8.0.0" };
  delete facts.manifest;
  assert.deepEqual(internalCkan(facts).depends[0], { name: "RP-1", min_version: "v4.8.0.0" });
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
    assert.equal(internalCkan(readUplink(name)).depends.at(-1).name, "Gonogo");
  }
});

test("the file read back out of a release zip is the one generated", () => {
  const facts = readUplink("kerbcast");
  const zip = releaseZip(facts.uplink.gamedata);
  const entry = addToZip(zip, facts);
  assert.equal(entry, "GameData/GonogoKerbcastUplink/GonogoKerbcastUplink.ckan");
  assert.deepEqual(JSON.parse(readFromZip(zip)), internalCkan(facts));
});

test("every Uplink's release zip carries its mod/LICENSE, the licence its netkan names", () => {
  for (const name of uplinkNames()) {
    const facts = readUplink(name);
    const zip = releaseZip(facts.uplink.gamedata);
    addToZip(zip, facts);
    const shipped = execFileSync("unzip", ["-p", zip, `GameData/${facts.uplink.gamedata}/LICENSE`], { encoding: "utf8" });
    assert.equal(shipped, readFileSync(join(ROOT, "uplinks", name, "mod", "LICENSE"), "utf8"), name);
  }
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

test("ckanDepends reach the generated file, ahead of Gonogo", () => {
  assert.deepEqual(internalCkan(readUplink("principia")).depends, [
    { name: "Harmony2" },
    { name: "Gonogo" },
  ]);
});

test("ckanRecommends reach the generated file as recommends, and only where an Uplink declares them", () => {
  assert.deepEqual(internalCkan(readUplink("rp1")).recommends, [
    { name: "GonogoKosUplink" },
    { name: "GonogoMechJebUplink" },
    { name: "GonogoRealAntennasUplink" },
    { name: "GonogoTestFlightUplink" },
  ]);
  assert.equal("recommends" in internalCkan(readUplink("principia")), false);
});

test("every ckanRecommends entry names an Uplink in this repo", () => {
  const gamedata = new Set(uplinkNames().map((name) => readUplink(name).uplink.gamedata));
  for (const name of uplinkNames()) {
    for (const dep of readUplink(name).uplink.ckanRecommends ?? []) {
      assert.ok(gamedata.has(dep.name), `${name}: ${dep.name} is not an Uplink here`);
    }
  }
});
