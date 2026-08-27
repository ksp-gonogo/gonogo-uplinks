#!/usr/bin/env node
/**
 * Copies one Uplink's built client bundle and its sidecar to a release host.
 *
 * Stands in for uploading a GitHub release asset. The point is not the copy, it
 * is that after this runs the bundle lives somewhere **neither repo owns**, which
 * is what makes the declared `ClientSource.Url` a release URL rather than a path
 * into a working tree.
 *
 * That is the whole acceptance property: rename, move or delete `gonogo-uplinks`
 * and an app that loads this Uplink is unaffected, because nothing it depends on
 * lives there any more. A server rooted inside the repo would die with the folder
 * and would have proved only that the app held no path.
 *
 * ## The declared URL and the publish location have to agree
 *
 * `uplink.json`'s `client.url` is baked into the DLL, and the mod tells the app
 * to fetch exactly that. If the bundle is published somewhere else the app gets a
 * 404, the Uplink loads as mod-only, and the widget is simply absent with nothing
 * saying why. So this checks that the URL it is about to publish under is the one
 * the Uplink declared, and refuses rather than publishing to a path no one will
 * ask for.
 *
 * Usage:
 *   publish-release.mjs <uplink-dir-name> --to <release host dir> [--base <url>]
 */

import { copyFileSync, existsSync, mkdirSync, readFileSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");

const args = process.argv.slice(2);
const name = args[0];
const flag = (which) =>
  args.includes(which) ? args[args.indexOf(which) + 1] : undefined;
const to = flag("--to");
const base = flag("--base");

if (!name || !to) {
  console.error(
    "usage: publish-release.mjs <uplink-dir-name> --to <release host dir> [--base <url>]",
  );
  process.exit(2);
}

const declared = JSON.parse(
  readFileSync(join(ROOT, "uplinks", name, "uplink.json"), "utf8"),
);
const url = declared.client?.url;
if (!url) {
  console.error(
    `✖ ${declared.id}: uplink.json declares no client.url, so there is no release URL to publish\n` +
      "  under and nothing would ever fetch what this copied.",
  );
  process.exit(1);
}

const from = join(ROOT, "artifacts", declared.id);
const bundleName = `${declared.id}.client.js`;
if (!existsSync(join(from, bundleName))) {
  console.error(
    `✖ ${declared.id}: ${join(from, bundleName)} does not exist. Build it first:\n` +
      `  node tooling/release-uplink.mjs ${name}`,
  );
  process.exit(1);
}

/*
 * The path the app will actually request, derived from the declared URL rather
 * than chosen here. Publishing to a directory of this tool's choosing and hoping
 * it matches is how a 404 becomes a silently absent widget.
 *
 * `client.url` is JUST a URL and this deliberately does not care which kind: a
 * public release, a LAN host, a box on the same machine as KSP, or a bare
 * same-origin path. The loader does not care either (`manifestUrlFor` slices the
 * string rather than using `new URL(rel, base)`, precisely so a path with no
 * origin works), and the choice belongs to the author. A browser fetching a URL
 * is unremarkable; a KSP mod acting as a file server is the odd thing, which is
 * why this shape won over serving bytes off the telemetry socket.
 */
const declaredPath = (
  URL.canParse(url) ? new URL(url).pathname : url
).replace(/^\/+/, "");
const target = resolve(to, dirname(declaredPath));

// Only checkable when the declared URL has an origin to compare against. A bare
// same-origin path is published as-is: there is no host in it to disagree with.
if (base && URL.canParse(url)) {
  const expected = new URL(declaredPath, base.endsWith("/") ? base : `${base}/`).href;
  if (expected !== url) {
    console.error(
      `✖ ${declared.id}: publishing under ${base} would serve this at\n` +
        `    ${expected}\n` +
        `  but the Uplink declares, and the DLL carries,\n` +
        `    ${url}\n` +
        "  The app fetches what the mod tells it, so it would 404 and the Uplink would load as\n" +
        "  mod-only with the widget simply missing. Fix client.url in uplink.json, or publish\n" +
        "  under the host it names.",
    );
    process.exit(1);
  }
}

mkdirSync(target, { recursive: true });
for (const file of [bundleName, "gonogo-uplink.json"]) {
  const src = join(from, file);
  if (!existsSync(src)) {
    console.error(
      `✖ ${declared.id}: ${file} is missing from ${from}. The loader derives the sidecar's URL from\n` +
        "  the bundle's own, so both must be published together or the fetch half-succeeds.",
    );
    process.exit(1);
  }
  copyFileSync(src, join(target, file));
}

console.log(`${declared.id}: published to ${target}`);
console.log(`  bundle   ${url}`);
console.log(`  sidecar  ${url.replace(/[^/]+$/, "gonogo-uplink.json")}`);
console.log(
  "\nThis directory is outside both repos on purpose: it is what lets the folder-move test pass.",
);
