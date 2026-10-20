import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { mkdirSync, mkdtempSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { test } from "node:test";
import { uplinkNames } from "./check-built-against.mjs";
import {
  addToZip,
  internalCkan,
  readFromZip,
  readUplink,
} from "./internal-ckan.mjs";

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
      { name: "Kerbcast", min_version: "1.10.2" },
      { name: "GonogoCore" },
    ],
  });
});

test("an Uplink whose mod is not on CKAN depends on GonogoCore alone", () => {
  assert.deepEqual(internalCkan(readUplink("principia")), {
    depends: [{ name: "GonogoCore" }],
  });
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
