#!/usr/bin/env node
/**
 * Builds one Uplink's client into the standalone ESM bundle the app `import()`s,
 * and writes the `gonogo-uplink.json` descriptor beside it.
 *
 * ## Why this file exists here rather than in the devkit
 *
 * It should be in the devkit, as `gonogo-uplink bundle`. It is not: the
 * `gonogo-uplink` CLI that `@ksp-gonogo/ui-kit` publishes has two verbs, `render`
 * and `docs`, and neither produces a loadable bundle. The only thing in the world
 * that builds an Uplink client bundle is an 80-line Vite plugin inside
 * `gonogo`'s `packages/app/vite.config.ts`, which is app-internal and does not
 * travel with an extracted Uplink.
 *
 * So an author outside that repo can develop, typecheck and test an Uplink, and
 * cannot ship one. This is the reconstruction, written from the outside, and it
 * is the strongest case in the pilot for what the devkit still owes: every line
 * below is a line an author had to work out for themselves.
 *
 * The four compatibility fields ARE derivable from published packages:
 * `EXTENSION_API_VERSION`, `CONTRACT_MAJOR` and `CONTRACT_MINOR` come off
 * `@ksp-gonogo/sitrep-sdk`, and `uiKitVersion` off the installed ui-kit's own
 * manifest. Nothing here has to be told them, which is the design working. The
 * externals list is the exception; see `uplink-bundle-settings.mjs`.
 */

import { createHash } from "node:crypto";
import { createRequire } from "node:module";
import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { BUNDLE_OPTIONS, clientEntry, EXTERNALS } from "./uplink-bundle-settings.mjs";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");

const name = process.argv[2];
const outDir = resolve(process.argv[3] ?? join(ROOT, "artifacts"));
if (!name) {
  console.error("usage: bundle-uplink-client.mjs <uplink-dir-name> [outDir]");
  process.exit(2);
}

const uplinkDir = join(ROOT, "uplinks", name);
const clientDir = join(uplinkDir, "client");
const declared = JSON.parse(readFileSync(join(uplinkDir, "uplink.json"), "utf8"));
const clientRequire = createRequire(join(clientDir, "package.json"));
const clientEntryUrl = new URL("package.json", `file://${clientDir}/`).href;

/**
 * esbuild and the sdk are the client's own devDependencies, resolved from the
 * client rather than from here, so this file needs no dependencies of its own and
 * a client pinning a different esbuild gets the one it pinned.
 */
const { build } = clientRequire("esbuild");

/**
 * Both published packages declare `exports` with an `import` condition and no
 * `require` one, so every CJS resolution of them throws
 * ERR_PACKAGE_PATH_NOT_EXPORTED and a build tool cannot reach them through
 * `require.resolve` at all. Neither lists `./package.json` either, so the
 * manifest cannot be asked for by specifier. `import.meta.resolve` takes no
 * parent argument in current Node, so it resolves relative to THIS file, which
 * has no node_modules of its own. What is left is reading the installed
 * manifest by path, which is what this does. Three small things, and together
 * they cost an author an hour they should not spend.
 */
function installed(pkg) {
  for (const base of [clientDir, ROOT]) {
    const manifest = join(base, "node_modules", pkg, "package.json");
    try {
      return { dir: dirname(manifest), pkg: JSON.parse(readFileSync(manifest, "utf8")) };
    } catch {}
  }
  throw new Error(
    `${pkg} is not installed under ${clientDir} or ${ROOT}. Run npm install in the client first.`,
  );
}

const sdkInstall = installed("@ksp-gonogo/sitrep-sdk");
const sdk = await import(
  new URL(sdkInstall.pkg.exports["."].import, `file://${sdkInstall.dir}/`).href
);
const uiKitVersion = installed("@ksp-gonogo/ui-kit").pkg.version;

/*
 * One directory per Uplink, and that is not tidiness.
 *
 * The loader derives the sidecar's URL from the bundle's own
 * (`manifestUrlFor`: strip the last path segment, append `gonogo-uplink.json`),
 * so the sidecar MUST be named exactly that and MUST sit beside the bundle. A
 * flat artifacts directory therefore gives every Uplink the same sidecar path
 * and the second one to publish silently answers for the first.
 */
const bundleDir = join(outDir, declared.id);
mkdirSync(bundleDir, { recursive: true });
const outFile = join(bundleDir, `${declared.id}.client.js`);

await build({
  ...BUNDLE_OPTIONS,
  entryPoints: [clientEntry(clientDir)],
  outfile: outFile,
  logLevel: "warning",
});

const bytes = readFileSync(outFile);
const integrity = `sha256-${createHash("sha256").update(bytes).digest("hex")}`;

/**
 * A bundle still naming a `@ksp-gonogo` specifier the app's import map does not
 * carry resolves nowhere, and it fails at `import(bundleUrl)` in the browser
 * rather than here. The check is on the EMITTED bytes, because that is the only
 * place a specifier esbuild kept is visible; reading the source would miss one
 * that arrived through a dependency.
 */
const kept = [
  ...new Set(
    [...bytes.toString("utf8").matchAll(/from\s*"(@ksp-gonogo\/[^"]+)"/g)].map(
      (m) => m[1],
    ),
  ),
].filter((spec) => !EXTERNALS.includes(spec));
if (kept.length > 0) {
  console.error(
    `✖ ${declared.id}: the bundle imports ${kept.join(", ")}, which the app's import map does not\n` +
      "  resolve. It would load in a bundler and throw at import(bundleUrl) in the app. Either the\n" +
      "  Uplink is importing a package it may not, or the externals list above is missing an entry.",
  );
  process.exit(1);
}

const descriptor = {
  id: declared.id,
  name: declared.name,
  author: declared.author,
  repo: declared.repo,
  version: JSON.parse(readFileSync(join(clientDir, "package.json"), "utf8"))
    .version,
  minAppVersion: declared.minAppVersion,
  apiVersion: sdk.EXTENSION_API_VERSION,
  uiKitVersion,
  contractMajor: sdk.CONTRACT_MAJOR,
  contractMinor: sdk.CONTRACT_MINOR,
  bundleUrl: `${declared.id}/${declared.id}.client.js`,
  integrity,
  mod: declared.mod,
};
writeFileSync(
  join(bundleDir, "gonogo-uplink.json"),
  `${JSON.stringify(descriptor, null, 2)}\n`,
);
writeFileSync(`${outFile}.sha256`, `${integrity}\n`);

console.log(`${declared.id}: ${(bytes.length / 1024).toFixed(1)} KB → ${outFile}`);
console.log(`  integrity     ${integrity}`);
console.log(
  `  gate fields   api ${descriptor.apiVersion}, ui-kit ${uiKitVersion}, contract ${descriptor.contractMajor}.${descriptor.contractMinor}`,
);
