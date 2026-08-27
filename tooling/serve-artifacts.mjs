#!/usr/bin/env node
/**
 * Serves `artifacts/` over HTTP so a running gonogo app can fetch an Uplink's
 * client bundle from this repo.
 *
 * ## Why this has to exist at all, and it is a finding rather than a convenience
 *
 * The app is a browser and fetches the bundle over HTTP. The mod is a KSP plugin
 * whose only network surface is the Fleck **WebSocket** listener
 * (`Sitrep.Transport/FleckTransportListener`): there is no HTTP server in the mod
 * and no static route anywhere in it. So a mod CANNOT serve the bundle it ships
 * beside its own DLL in GameData, and `ClientSource.Url` can never point at the
 * mod itself.
 *
 * That is the right answer for a release (the bundle belongs on a release asset
 * or GitHub Pages, versioned and cacheable, not served by a game process), and it
 * leaves the DEV loop with nowhere to fetch from. This is that nowhere: a static
 * server the author runs beside their editor, whose address goes into the DLL as
 * `DevPath`.
 *
 * ## CORS, because the app and this are different origins by construction
 *
 * The app is served from wherever it is deployed and this is a separate host and
 * port, so every fetch is cross-origin. `import(bundleUrl)` of a module from
 * another origin needs `Access-Control-Allow-Origin`, and so does the sidecar
 * fetch. Without it the browser refuses before the loader sees anything, and the
 * failure surfaces as a module that would not load rather than as a CORS problem.
 *
 * `*` is right here and only here: this serves build output from a directory the
 * author already trusts, to a dev machine, for one afternoon. A release host
 * makes its own decision.
 *
 * Usage:
 *   serve-artifacts.mjs [--port 8099] [--host 0.0.0.0]
 */

import { createReadStream, existsSync, statSync } from "node:fs";
import { createServer } from "node:http";
import { dirname, extname, join, normalize, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
const SERVE = join(ROOT, "artifacts");

const args = process.argv.slice(2);
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
      "  Build an Uplink first: node tooling/release-uplink.mjs <name>",
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
    "\nThe first of those is what goes into the DLL as DevPath:\n" +
      `  node tooling/release-uplink.mjs <name> --dev-path http://<this-machine>:${port}/<id>/<id>.client.js`,
  );
});
