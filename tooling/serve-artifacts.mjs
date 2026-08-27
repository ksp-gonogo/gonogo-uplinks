#!/usr/bin/env node
/**
 * Serves an Uplink's published bundle over HTTP, so a running gonogo app can
 * fetch it from the release URL the Uplink declared.
 *
 * ## The websocket carries the URL, not the bytes
 *
 * The mod publishes `ClientSource.Url` on `system.uplinks`; the app reads it off
 * the socket it already has and downloads over HTTP, then distributes to stations
 * over PeerJS as it already does. The mod does not serve files, and could not:
 * its only network surface is the Fleck WebSocket listener
 * (`Sitrep.Transport/FleckTransportListener`), with no HTTP anywhere in
 * `Sitrep.Host`, `Sitrep.Transport` or `Sitrep.Core`.
 *
 * ## Why serving a directory OUTSIDE the repo is the point
 *
 * A release URL is not a folder path in either repo, which is what lets the
 * acceptance test pass: rename or delete `gonogo-uplinks` and a client already
 * published still loads. A server rooted inside this repo would die with the
 * folder and prove nothing, so `--dir` points at a release host standing in for
 * a GitHub release asset.
 *
 * ## CORS, because the app and any release host are different origins
 *
 * `import(bundleUrl)` of a module from another origin needs
 * `Access-Control-Allow-Origin`, and so does the sidecar fetch. Without it the
 * browser refuses before the loader sees anything, and it surfaces as a module
 * that would not load rather than as a CORS problem. `*` is right for a local
 * release host; a real one makes its own decision.
 *
 * Usage:
 *   serve-artifacts.mjs [--dir <release host>] [--port 8099] [--host 0.0.0.0]
 */


import { createReadStream, existsSync, statSync } from "node:fs";
import { createServer } from "node:http";
import { dirname, extname, join, normalize, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
/*
 * Defaults to this repo's own artifacts for the dev loop, but takes --dir so it
 * can serve a RELEASE HOST instead: a directory that is not either repo. That is
 * what makes the folder-move test meaningful, since a server rooted inside
 * gonogo-uplinks dies the moment the folder is renamed.
 */
const args = process.argv.slice(2);
const SERVE = resolve(
  args.includes("--dir") ? args[args.indexOf("--dir") + 1] : join(ROOT, "artifacts"),
);

const flag = (which, fallback) =>
  args.includes(which) ? args[args.indexOf(which) + 1] : fallback;
const port = Number(flag("--port", "8099"));
// 0.0.0.0 rather than localhost by default: the app that fetches this usually
// runs on a different machine from the one building the Uplink, which is the
// whole Steam-Deck-to-laptop shape this project already has everywhere else.
const host = flag("--host", "0.0.0.0");

if (!existsSync(SERVE)) {
  console.error(
    `✖ ${SERVE} does not exist, so this would serve 404s that look like a loader problem.\n` +
      "  Publish one first: node tooling/publish-release.mjs <name> --to <release host>",
  );
  process.exit(1);
}

const TYPES = {
  ".js": "text/javascript; charset=utf-8",
  ".mjs": "text/javascript; charset=utf-8",
  ".json": "application/json; charset=utf-8",
  ".map": "application/json; charset=utf-8",
  ".css": "text/css; charset=utf-8",
};

const server = createServer((req, res) => {
  const cors = {
    "access-control-allow-origin": "*",
    "access-control-allow-headers": "*",
    // No caching. An author rebuilding a bundle and seeing the previous one is
    // the single most confusing thing a dev loop can do, and a 304 here reads as
    // "my change did nothing".
    "cache-control": "no-store",
  };

  if (req.method === "OPTIONS") {
    res.writeHead(204, cors);
    res.end();
    return;
  }

  const requested = decodeURIComponent((req.url ?? "/").split("?")[0]);
  // Resolve then confirm containment: a `..` in the path would otherwise read
  // any file the process can, and this listens on 0.0.0.0.
  const path = resolve(join(SERVE, normalize(requested)));
  if (path !== SERVE && !path.startsWith(`${SERVE}/`)) {
    res.writeHead(403, cors);
    res.end("outside the artifacts directory\n");
    return;
  }

  if (!existsSync(path) || statSync(path).isDirectory()) {
    res.writeHead(404, { ...cors, "content-type": "text/plain" });
    res.end(`not found: ${requested}\n`);
    console.log(`404 ${requested}`);
    return;
  }

  res.writeHead(200, {
    ...cors,
    "content-type": TYPES[extname(path)] ?? "application/octet-stream",
    "content-length": statSync(path).size,
  });
  createReadStream(path).pipe(res);
  console.log(`200 ${requested}`);
});

server.listen(port, host, () => {
  console.log(`serving ${SERVE} on http://${host}:${port}/ (CORS *, no-store)`);
  console.log("\nEach Uplink's bundle and its sidecar sit together, which the loader requires:");
  console.log(`  http://<this-machine>:${port}/<id>/<id>.client.js`);
  console.log(`  http://<this-machine>:${port}/<id>/gonogo-uplink.json`);
  console.log(
    "\nThe first of those is the release URL an Uplink declares in uplink.json as client.url,\n" +
      "which the mod then publishes and the app downloads from.",
  );
});
