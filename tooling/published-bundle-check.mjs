#!/usr/bin/env node
/**
 * Does each Uplink's newest published client still load in the Gonogo app?
 *
 *   node tooling/published-bundle-check.mjs --gonogo <installed gonogo checkout> [--releases <git ref>]
 *
 * A bundle keeps its bare imports until the app's import map resolves them, so a
 * name the app stopped exporting builds and tests clean and throws only at load.
 * This builds the app's externals and SDK host from the gonogo checkout's source,
 * writes the app's import map into a page, and imports each newest bundle from
 * the releases branch in Chromium. A planted bundle importing a name that does
 * not exist must fail or the check reports BLIND.
 *
 * Exits 0 when every bundle loads, 1 when one does not, 2 when BLIND.
 */
import { spawnSync } from "node:child_process";
import { appendFileSync, existsSync, mkdtempSync, readdirSync, readFileSync } from "node:fs";
import { createServer } from "node:http";
import { createRequire } from "node:module";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

export const PLANTED_EXPORT = "PlantedNameNoKitExports";
export const PLANTED_BUNDLE = `import { ${PLANTED_EXPORT} } from "@ksp-gonogo/ui-kit";\nexport default ${PLANTED_EXPORT};\n`;

function versionKey(version) {
  const [release, candidate] = version.split("-rc.");
  return [...release.split(".").map(Number), candidate === undefined ? Number.POSITIVE_INFINITY : Number(candidate)];
}

/** The highest of `versions`, a full release ranking above its own candidates. */
export function newestVersion(versions) {
  return [...versions].sort((a, b) => {
    const [x, y] = [versionKey(a), versionKey(b)];
    const at = x.findIndex((part, i) => part !== y[i]);
    return at < 0 ? 0 : y[at] - x[at];
  })[0];
}

/** The export a link error says is missing, or undefined for any other failure. */
export function missingExport(message) {
  return /does not provide an export named '([^']+)'/.exec(message)?.[1];
}

/** The exit code and the planted bundle's verdict, given each load's outcome. */
export function verdict(results, planted) {
  if (planted.ok || missingExport(planted.message) !== PLANTED_EXPORT) return 2;
  return results.every((result) => result.ok) ? 0 : 1;
}

/** The import map entries the app writes, read from the sdk's own list. */
export function externalEntries(source) {
  const entries = [...source.matchAll(/\["([^"]+)", "(ext-[^"]+)"\]/g)].map((match) => [match[1], match[2]]);
  if (entries.length === 0) throw new Error("found no entries in UPLINK_EXTERNAL_ENTRIES");
  return entries;
}

function git(cwd, ...args) {
  const run = spawnSync("git", args, { cwd, encoding: "utf8", maxBuffer: 1 << 28 });
  if (run.status !== 0) throw new Error(`git ${args.join(" ")}: ${run.stderr}`);
  return run.stdout;
}

/** Every Uplink's newest bundle on `ref`, its source included. */
function newestBundles(root, ref) {
  const base = "uplinks/releases";
  const names = (path) =>
    git(root, "ls-tree", "--name-only", `${ref}:${path}`)
      .split("\n")
      .filter(Boolean);
  return names(base).map((id) => {
    const versions = names(`${base}/${id}`).filter((version) => /^\d+\.\d+\.\d+(-rc\.\d+)?$/.test(version));
    const version = newestVersion(versions);
    return { id, version, source: git(root, "show", `${ref}:${base}/${id}/${version}/${id}.client.js`) };
  });
}

/** Maps each package in the checkout to its source, so the externals need no package build. */
function sourceAliases(gonogo) {
  const alias = {};
  const dirs = [...readdirSync(join(gonogo, "packages")).map((name) => join(gonogo, "packages", name)), join(gonogo, "mod/sitrep-sdk")];
  for (const dir of dirs) {
    const manifest = join(dir, "package.json");
    if (!existsSync(manifest) || !existsSync(join(dir, "src/index.ts"))) continue;
    const json = JSON.parse(readFileSync(manifest, "utf8"));
    for (const [subpath, target] of Object.entries(json.exports ?? {})) {
      if (subpath === "." || /\.(css|json)$/.test(subpath)) continue;
      const built = /^\.\/dist\/(.+)\.js$/.exec(typeof target === "string" ? target : (target?.import ?? ""));
      const candidates = typeof target === "string" ? [resolve(dir, target)] : [];
      if (built) candidates.push(resolve(dir, `src/${built[1]}.ts`), resolve(dir, `src/${built[1]}.tsx`));
      const found = candidates.find((file) => /\.tsx?$/.test(file) && existsSync(file));
      if (found) alias[`${json.name}/${subpath.slice(2)}`] = found;
    }
    alias[json.name] = join(dir, "src/index.ts");
  }
  return alias;
}

async function buildExternals(gonogo, out, require) {
  const { build } = require("esbuild");
  const dir = join(gonogo, "packages/app/src/uplinks/externals");
  const entryPoints = Object.fromEntries(
    readdirSync(dir)
      .filter((file) => file.startsWith("ext-"))
      .map((file) => [file.replace(/\.ts$/, ""), join(dir, file)]),
  );
  entryPoints["install-host"] = join(gonogo, "packages/app/src/uplinks/install-host-first.ts");
  await build({
    entryPoints,
    outdir: out,
    bundle: true,
    splitting: true,
    format: "esm",
    target: "es2022",
    platform: "browser",
    jsx: "automatic",
    alias: sourceAliases(gonogo),
    logLevel: "error",
    define: {
      "process.env.NODE_ENV": '"production"',
      "import.meta.env.DEV": "false",
      "import.meta.env.PROD": "true",
      "import.meta.env.MODE": '"production"',
      "import.meta.env": "{}",
    },
    loader: Object.fromEntries([
      [".css", "text"],
      ...[".svg", ".png", ".jpg", ".wav", ".mp3", ".woff", ".woff2"].map((ext) => [ext, "dataurl"]),
    ]),
  });
}

function page(entries) {
  const map = { imports: Object.fromEntries(entries.map(([specifier, file]) => [specifier, `/ext/${file}.js`])) };
  return `<!doctype html><meta charset=utf-8><script type="importmap">${JSON.stringify(map)}</script>
<script type=module>
import "/ext/install-host.js";
window.loadBundle = async (url) => {
  const core = await import("@ksp-gonogo/core");
  const before = core.getComponents().length;
  try {
    await import(url);
    return { ok: true, widgets: core.getComponents().length - before };
  } catch (error) {
    return { ok: false, message: String(error) };
  }
};
window.ready = true;
</script>`;
}

function serve(out, html, bundles) {
  const server = createServer((request, response) => {
    const path = request.url.split("?")[0];
    if (path === "/") {
      response.setHeader("content-type", "text/html");
      response.end(html);
      return;
    }
    const bundle = /^\/bundle\/([^/]+)\.js$/.exec(path)?.[1];
    const file = join(out, path.replace(/^\/ext\//, ""));
    const body = bundle !== undefined ? bundles.get(bundle) : existsSync(file) ? readFileSync(file) : undefined;
    if (body === undefined) {
      response.statusCode = 404;
      response.end();
      return;
    }
    response.setHeader("content-type", "text/javascript");
    response.end(body);
  });
  return new Promise((done) => server.listen(0, "127.0.0.1", () => done(server)));
}

async function loadInBrowser(browser, port, id) {
  const context = await browser.newContext();
  const tab = await context.newPage();
  await tab.goto(`http://127.0.0.1:${port}/`);
  await tab.waitForFunction("window.ready === true", undefined, { timeout: 60000 });
  const result = await tab.evaluate((url) => window.loadBundle(url), `/bundle/${id}.js`);
  await context.close();
  return result;
}

async function main(args) {
  const option = (name, fallback) => (args.includes(name) ? args[args.indexOf(name) + 1] : fallback);
  const gonogo = option("--gonogo");
  if (!gonogo) {
    console.error("usage: published-bundle-check.mjs --gonogo <installed gonogo checkout> [--releases <git ref>]");
    return 2;
  }
  const root = resolve(fileURLToPath(import.meta.url), "../..");
  const checkout = resolve(gonogo);
  const require = createRequire(join(checkout, "packages/app/package.json"));
  const out = mkdtempSync(join(tmpdir(), "published-bundle-check-"));
  await buildExternals(checkout, out, require);

  const entries = externalEntries(readFileSync(join(checkout, "mod/sitrep-sdk/src/uplink-externals.ts"), "utf8"));
  const newest = newestBundles(root, option("--releases", "origin/releases"));
  const sources = new Map([...newest.map((bundle) => [bundle.id, bundle.source]), ["planted", PLANTED_BUNDLE]]);
  const server = await serve(out, page(entries), sources);
  const { chromium } = require("playwright");
  const browser = await chromium.launch();
  const { port } = server.address();

  const results = [];
  for (const { id, version } of newest) results.push({ id, version, ...(await loadInBrowser(browser, port, id)) });
  const planted = await loadInBrowser(browser, port, "planted");
  await browser.close();
  server.close();

  const lines = results.map((result) =>
    result.ok
      ? `LOADS ${result.id} ${result.version}, registered ${result.widgets} widget(s)`
      : `FAILS ${result.id} ${result.version}: ${missingExport(result.message) ? `the app no longer exports ${missingExport(result.message)}` : result.message}`,
  );
  const code = verdict(results, planted);
  if (code === 2) lines.push(`BLIND: the planted bundle importing ${PLANTED_EXPORT} did not fail on that name (${planted.message ?? "it loaded"})`);
  else lines.push("planted stale bundle failed as it must");
  for (const line of lines) console.log(line);
  if (process.env.GITHUB_STEP_SUMMARY) {
    appendFileSync(process.env.GITHUB_STEP_SUMMARY, `## Newest published bundles against the current app\n\n${lines.map((line) => `- ${line}`).join("\n")}\n`);
  }
  return code;
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  process.exit(await main(process.argv.slice(2)));
}
