import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { after, test } from "node:test";
import { fileURLToPath } from "node:url";
import { resolveWatch, watchableUplinks } from "./uplink-watch.mjs";

const SCRIPT = join(dirname(fileURLToPath(import.meta.url)), "uplink-watch.mjs");
const roots = [];
after(() => {
  for (const root of roots) rmSync(root, { recursive: true, force: true });
});

/** A checkout holding the named Uplinks, each with a client and optionally an installed uplink-tools. */
function checkout(uplinks) {
  const root = mkdtempSync(join(tmpdir(), "uplink-watch-"));
  roots.push(root);
  for (const [name, installed] of Object.entries(uplinks)) {
    const client = join(root, "uplinks", name, "client");
    mkdirSync(client, { recursive: true });
    writeFileSync(join(client, "package.json"), "{}");
    if (installed) {
      const bin = join(client, "node_modules/@ksp-gonogo/uplink-tools/bin");
      mkdirSync(bin, { recursive: true });
      writeFileSync(join(bin, "uplink-tools.mjs"), "");
    }
  }
  return root;
}

test("runs the client's own uplink-tools in watch mode, from the client directory", () => {
  const root = checkout({ rp1: true, scansat: true });
  const resolved = resolveWatch("rp1", root);
  const client = join(root, "uplinks/rp1/client");
  assert.equal(resolved.cwd, client);
  assert.deepEqual(resolved.args, [
    join(client, "node_modules/@ksp-gonogo/uplink-tools/bin/uplink-tools.mjs"),
    "bundle",
    "--watch",
    "--client",
    client,
  ]);
});

test("a wrong name fails with the Uplinks that have a client", () => {
  const root = checkout({ rp1: true, scansat: true });
  const resolved = resolveWatch("rp2", root);
  assert.match(resolved.error, /no Uplink named rp2/);
  assert.match(resolved.error, /rp1, scansat/);
  assert.deepEqual(watchableUplinks(root), ["rp1", "scansat"]);
});

test("no name asks for one", () => {
  const root = checkout({ rp1: true });
  assert.match(resolveWatch(undefined, root).error, /name an Uplink/);
});

test("a client with no installed uplink-tools is told to install it", () => {
  const root = checkout({ rp1: false });
  assert.match(resolveWatch("rp1", root).error, /npm ci/);
});

test("the command exits 2 and says why when given a wrong name", () => {
  const run = spawnSync(process.execPath, [SCRIPT, "no-such-uplink"], {
    encoding: "utf8",
  });
  assert.equal(run.status, 2);
  assert.match(run.stderr, /no Uplink named no-such-uplink/);
});
