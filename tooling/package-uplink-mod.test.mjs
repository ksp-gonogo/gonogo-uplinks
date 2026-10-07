import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import {
  cpSync,
  existsSync,
  mkdirSync,
  mkdtempSync,
  rmSync,
  writeFileSync,
} from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { after, test } from "node:test";
import { fileURLToPath } from "node:url";

const SCRIPT = join(
  dirname(fileURLToPath(import.meta.url)),
  "package-uplink-mod.mjs",
);
const roots = [];
after(() => {
  for (const root of roots) rmSync(root, { recursive: true, force: true });
});

/** A checkout holding the tool and the named Uplinks, each with a built plugin. */
function checkout(uplinks) {
  const root = mkdtempSync(join(tmpdir(), "package-uplink-mod-"));
  roots.push(root);
  mkdirSync(join(root, "tooling"));
  cpSync(SCRIPT, join(root, "tooling", "package-uplink-mod.mjs"));
  for (const name of uplinks) {
    const dir = join(root, "uplinks", name);
    mkdirSync(join(dir, "mod", "bin", "Release"), { recursive: true });
    writeFileSync(
      join(dir, "uplink.json"),
      JSON.stringify({ id: name, gamedata: `Gonogo${name}`, dll: `${name}.dll` }),
    );
    writeFileSync(join(dir, "mod", "bin", "Release", `${name}.dll`), name);
  }
  return root;
}

function pack(root, name, out) {
  return spawnSync(
    process.execPath,
    [join(root, "tooling", "package-uplink-mod.mjs"), name, out],
    { encoding: "utf8" },
  );
}

test("packaging a second Uplink into one out dir keeps the first one's GameData folder", () => {
  const root = checkout(["first", "second"]);
  const out = join(root, "artifacts");

  assert.equal(pack(root, "first", out).status, 0);
  assert.equal(pack(root, "second", out).status, 0);

  assert.ok(existsSync(join(out, "gamedata", "Gonogofirst", "Plugins", "first.dll")));
  assert.ok(existsSync(join(out, "gamedata", "Gonogosecond", "Plugins", "second.dll")));
});

test("packaging an Uplink again replaces its own folder and leaves nothing stale in it", () => {
  const root = checkout(["first"]);
  const out = join(root, "artifacts");

  assert.equal(pack(root, "first", out).status, 0);
  const stale = join(out, "gamedata", "Gonogofirst", "Plugins", "left-over.dll");
  writeFileSync(stale, "");
  assert.equal(pack(root, "first", out).status, 0);

  assert.ok(!existsSync(stale));
  assert.ok(existsSync(join(out, "gamedata", "Gonogofirst", "Plugins", "first.dll")));
});
