#!/usr/bin/env node
/**
 * Fails when an Uplink that ships a client builds its manifest without a
 * ClientSource.
 *
 * The app finds an Uplink's client bundle through the ClientSource on the roster
 * the mod publishes. A manifest that leaves it null compiles, passes every C#
 * test and loads in game, and the client is then never fetched. The baked
 * `ClientSource.g.cs` sitting unused beside it is the symptom.
 *
 * An Uplink ships a client when its `uplink.json` has a `client` block or it has
 * a `client/` folder. One with neither (a mod-only Uplink) needs no ClientSource.
 *
 * The check is textual: the file under `mod/` that constructs the
 * `UplinkManifest` must assign `ClientSource` from the baked `ClientSource.Url`.
 *
 * It proves itself first: a real manifest with the assignment removed must be
 * reported, or it exits BLIND. It also refuses to run when discovery finds no
 * client-bearing Uplink, because zero violations over zero Uplinks reads as success.
 */

import { existsSync, readdirSync, readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const uplinksDir = join(root, "uplinks");

const CONSTRUCTS_MANIFEST = /new\s+UplinkManifest\b/;
const ASSIGNS_SOURCE = /\bClientSource\s*=\s*new\s+UplinkClientSource\b[\s\S]*?\bUrl\s*=\s*ClientSource\.Url\b/;

function shipsClient(dir) {
  const manifest = JSON.parse(readFileSync(join(dir, "uplink.json"), "utf8"));
  return Boolean(manifest.client) || existsSync(join(dir, "client"));
}

/** The files under mod/ that construct the manifest, as { file, text }. */
function manifestSources(dir) {
  const mod = join(dir, "mod");
  if (!existsSync(mod)) return [];
  return readdirSync(mod)
    .filter((f) => f.endsWith(".cs") && !f.endsWith(".g.cs"))
    .map((f) => ({ file: join(mod, f), text: readFileSync(join(mod, f), "utf8") }))
    .filter((s) => CONSTRUCTS_MANIFEST.test(s.text));
}

/** Problems for one Uplink, as strings; empty when it is sound. */
export function problemsFor(name, sources) {
  if (sources.length === 0) {
    return [`${name}: ships a client but no file under mod/ constructs an UplinkManifest`];
  }
  return sources
    .filter((s) => !ASSIGNS_SOURCE.test(s.text))
    .map((s) => `${name}: ${s.file} builds the manifest with no ClientSource, so the app cannot load this Uplink's client`);
}

function discover() {
  return readdirSync(uplinksDir, { withFileTypes: true })
    .filter((e) => e.isDirectory() && existsSync(join(uplinksDir, e.name, "uplink.json")))
    .map((e) => ({ name: e.name, dir: join(uplinksDir, e.name) }))
    .filter((u) => shipsClient(u.dir));
}

function main() {
  const uplinks = discover();
  if (uplinks.length === 0) {
    console.error("check-client-source: discovery found no Uplink that ships a client");
    process.exit(1);
  }

  const withSources = uplinks.map((u) => ({ ...u, sources: manifestSources(u.dir) }));

  // Plant: the first real manifest with its ClientSource assignment removed.
  const victim = withSources.find((u) => u.sources.length > 0);
  const planted = victim.sources.map((s) => ({
    file: s.file,
    text: s.text.replace(/ClientSource\s*=\s*new\s+UplinkClientSource[\s\S]*?\}\s*,/, ""),
  }));
  if (problemsFor(victim.name, planted).length === 0 || problemsFor("planted", []).length === 0) {
    console.error("check-client-source: BLIND, a manifest with no ClientSource was not reported");
    process.exit(1);
  }

  const problems = withSources.flatMap((u) => problemsFor(u.name, u.sources));
  if (problems.length > 0) {
    for (const p of problems) console.error(p);
    process.exit(1);
  }
  console.log(`check-client-source: ${uplinks.length} client-bearing Uplinks, all set a ClientSource`);
}

if (process.argv[1] === fileURLToPath(import.meta.url)) main();
