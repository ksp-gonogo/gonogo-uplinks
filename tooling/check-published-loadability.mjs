#!/usr/bin/env node
/**
 * Can the packages this Uplink depends on actually be USED the way they are used?
 *
 * ## Two questions, one per kind of dependency
 *
 * gonogo's own published packages (the sdk, ui-kit, uplink-tools) are LOADED: an
 * outside author may import them in Node, and the app serves the sdk and the kit
 * to every bundle through its import map. So for those the question is a bare
 * `node` import, and nothing weaker answers it.
 *
 * A package from anywhere else that the client's esbuild bundle INLINES reaches
 * nobody except through that bundle. Extensionless relative imports are normal
 * there and fatal in bare Node, so a Node import asks a question nobody depends
 * on the answer to, and fails on a package that works. For those the question is
 * whether the bundle LINKS: esbuild, with the client bundle's own settings,
 * resolves every import of every entry point and finds every name imported.
 *
 * Which question a package gets is derived, never listed:
 *
 *   - its installed manifest's `repository` is gonogo's    → load
 *   - otherwise, the client bundle inlines it              → link
 *   - otherwise (something outside the bundle consumes it) → load
 *
 * A package whose manifest names no repository fails: guessing would quietly
 * decide which check it gets.
 *
 * ## Why loading is separate from `npm test`, and must stay separate
 *
 * A green test run is not evidence that a dependency is loadable, and treating it
 * as such is a trap with a measured shape. Every Uplink client here sets
 * `server.deps.inline` for `@ksp-gonogo/*`, and it has to: without it ui-kit's
 * published bundle throws `styled.span is not a function` at module scope and
 * every test file dies in `setupFiles` before one assertion runs.
 *
 * But inlining makes Vite TRANSFORM the dependency, and its resolver performs the
 * extension search Node refuses to. So an sdk emitting extensionless relative
 * specifiers, which no Node process can load, PASSES a vitest run with inlining
 * on. Measured both ways against the same pre-fix dist:
 *
 *   with `deps.inline`     passes
 *   without it             ERR_MODULE_NOT_FOUND
 *
 * The whole tree could therefore be green while the package it depends on was
 * unimportable, which is exactly what happened for six weeks.
 *
 * So loading is asked in a bare `node` process, with no bundler anywhere near it,
 * and the answer is reported on its own. A test run answers "does my code work";
 * this answers "can anyone install what my code needs".
 *
 * Exit 0 when every non-exempt entry point loads or links, 1 otherwise.
 */

import { spawnSync } from "node:child_process";
import { existsSync, readFileSync } from "node:fs";
import { createRequire } from "node:module";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { BUNDLE_OPTIONS, clientEntry } from "./uplink-bundle-settings.mjs";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");

/**
 * gonogo's repository, as its published manifests name it. A package whose
 * manifest says this is one an outside author may load in Node, so it is held to
 * loading whatever the bundle does with it.
 */
const GONOGO_REPOSITORY = "github.com/ksp-gonogo/gonogo";

/**
 * Entry points not attempted, with the cause. Each EXPIRES BY ITSELF: this fails
 * as STALE the moment an exempted specifier loads, so the line has to be deleted
 * rather than outliving what justified it.
 *
 * All of these are one defect in `@ksp-gonogo/ui-kit`'s published bundle, not
 * four: `dist/testing.js` imports the same chunk that evaluates `styled.span`, so
 * the subpaths die on it whether or not their own imports are sound.
 */
const EXEMPT = {
  "@ksp-gonogo/ui-kit":
    'TypeError: styled.span is not a function, at module scope. The bundle does `import styled from "styled-components"`, which publishes no `exports` field, so Node takes its CJS `main` and the default arrives as the namespace object. Pinning does not help: 6.4.0 and 6.5.3 both lack it.',
  "@ksp-gonogo/ui-kit/testing":
    "Reaches the same chunk as the root barrel, so it dies on the same styled-components default.",
  // `@ksp-gonogo/uplink-tools` is the docs harness that used to BE the ui-kit
  // subpaths above, so it inherits their defect rather than adding one: what it
  // ships reaches ui-kit at module scope. Its ROOT barrel loads on its own and is
  // deliberately absent below. Measured in an installed client rather than
  // predicted, because that is the only place the answer is real.
  "@ksp-gonogo/uplink-tools/render-probe":
    "Same chunk, same cause as the kit's root barrel.",
  "@ksp-gonogo/uplink-tools/page-check":
    "Same chunk, same cause as the kit's root barrel.",
  "@ksp-gonogo/uplink-tools/widgets":
    "Same cause, and the least avoidable of the three: it is a single side-effect import of `@ksp-gonogo/components`, so it carries the app's whole widget graph, which evaluates `styled.span` at module scope for exactly the reason the kit does.",
};

/**
 * Entry points exempt only WHILE an optional peer is absent, keyed by the peer.
 *
 * Separate from `EXEMPT` because the reason is a property of the CONSUMER, not of
 * the package, and the two behave differently: this repo's first run of this
 * check reported `@ksp-gonogo/ui-kit/render` as a stale exemption, correctly, and
 * for a reason a flat list gets wrong in both directions. scansat's client
 * installs `playwright`, so `/render` loads there; the example's does not, so it
 * cannot. A flat entry is stale in one client and load-bearing in the next.
 *
 * So the exemption stands only while the peer is genuinely missing, and the
 * moment a client installs it the entry point is held to loading like any other.
 */
const EXEMPT_WITHOUT_PEER = {
  // Empty since the docs harness left ui-kit: `@ksp-gonogo/ui-kit/render` was its
  // only entry and the kit no longer publishes it. The mechanism stays, because
  // the case recurs whenever a published entry point needs an optional peer, and
  // a flat exemption is wrong in both directions when it does.
};

const name = process.argv[2];
if (!name) {
  console.error("usage: check-published-loadability.mjs <uplink-dir-name>");
  process.exit(2);
}

const clientDir = join(ROOT, "uplinks", name, "client");
const modules = join(clientDir, "node_modules");
if (!existsSync(modules)) {
  console.error(
    `✖ ${modules} does not exist, so nothing would be attempted and this would report success.\n` +
      "  Run npm ci in the client first.",
  );
  process.exit(1);
}

/**
 * Which `@ksp-gonogo` packages this client depends on, read off the CLIENT'S OWN
 * manifest so a new one joins by being depended on rather than by being listed.
 *
 * This used to be three names in an array, and on 2026-09-17 that cost real
 * coverage: `@ksp-gonogo/uplink-tools` arrived, the array did not know about it,
 * its four entry points were never attempted, and the run reported a confident
 * `14 of 14`. Four CORRECT exemptions written for it were reported STALE, which
 * reads as "you added something unnecessary" rather than "I cannot see that
 * package", and deleting them on that advice would have left the gate blind with
 * one fewer thing pointing at it.
 *
 * The enclosing function already discovered SUBPATHS off the installed manifest,
 * and cited `/spine` shipping unresolvable as why. It then hard-coded the package
 * names three lines later: the same failure, one dimension up, in the file that
 * documents it. So the question to ask of this check, and of any gate: what does
 * it ENUMERATE, and what does it ASSUME? The assumed dimension is the blind spot,
 * and the enumerated one is what makes it read as thorough.
 */
function dependedScopePackages() {
  const pkg = JSON.parse(readFileSync(join(clientDir, "package.json"), "utf8"));
  const names = new Set();
  for (const field of ["dependencies", "devDependencies"]) {
    for (const name of Object.keys(pkg[field] ?? {})) {
      if (name.startsWith("@ksp-gonogo/")) names.add(name);
    }
  }
  return [...names].sort();
}

/**
 * Every module subpath those packages export, read off the INSTALLED manifests.
 *
 * A package the client DEPENDS on but has not installed fails rather than being
 * skipped: a silent `continue` there is the same blindness in miniature, since a
 * package that failed to install would simply not be checked and the total would
 * still read as complete.
 */
function publishedEntryPoints() {
  const byPackage = new Map();
  const missing = [];
  const empty = [];
  for (const pkg of dependedScopePackages()) {
    const manifest = join(modules, pkg, "package.json");
    if (!existsSync(manifest)) {
      missing.push(pkg);
      continue;
    }
    const parsed = JSON.parse(readFileSync(manifest, "utf8"));
    const specs = [];
    for (const key of Object.keys(parsed.exports ?? {})) {
      if (key === ".") {
        specs.push(pkg);
        continue;
      }
      if (!key.startsWith("./")) continue;
      const sub = key.slice(2);
      // Shared config files and a stylesheet: nothing resolves them through the
      // module graph, so importing them proves nothing.
      if (sub === "biome" || sub.endsWith(".json") || sub.endsWith(".css")) {
        continue;
      }
      specs.push(`${pkg}/${sub}`);
    }
    // No exports map, or one naming no module, would contribute nothing and
    // leave the total reading as complete without it.
    if (specs.length === 0) empty.push(pkg);
    byPackage.set(pkg, { manifest: parsed, specs });
  }
  if (missing.length > 0) {
    console.error(
      `✖ depended on but not installed, so nothing about ${missing.length === 1 ? "it" : "them"} ` +
        `would be attempted:\n    ${missing.join("\n    ")}\n` +
        "  Run npm ci in the client. A skipped package is not a passing one, and the\n" +
        "  total below would have read as complete without it.",
    );
    process.exit(1);
  }
  if (empty.length > 0) {
    console.error(
      `✖ no module entry point found in the exports map of:\n    ${empty.join("\n    ")}\n` +
        "  so nothing about it would be attempted. Read its manifest before teaching this\n" +
        "  check a second way to find entry points.",
    );
    process.exit(1);
  }
  return byPackage;
}

const byPackage = publishedEntryPoints();
const specs = [...byPackage.values()].flatMap((entry) => entry.specs);

/*
 * A run that attempts nothing reports success, and that is this check's own
 * failure mode: a manifest that moved, a node_modules that is empty, an exports
 * map read wrong. Both packages publish several entry points, so this many is a
 * tree that was actually read.
 */
if (specs.length < 6) {
  console.error(
    `✖ found only ${specs.length} published entry point(s) to try, expected at least 6. Either the\n` +
      "  installed manifests moved their exports maps or node_modules is not what it looks like, and\n" +
      "  importing nothing would report the same success as importing everything.",
  );
  process.exit(1);
}

/** `git+https://github.com/x/y.git` and its spellings, reduced to `github.com/x/y`. */
const repositoryOf = (manifest) => {
  const raw =
    typeof manifest.repository === "string"
      ? manifest.repository
      : manifest.repository?.url;
  if (!raw) return undefined;
  return raw
    .replace(/^git\+/, "")
    .replace(/^[a-z]+:\/\//, "")
    .replace(/^git@([^:]+):/, "$1/")
    .replace(/^github:/, "github.com/")
    .replace(/\.git$/, "")
    .replace(/\/+$/, "");
};

const clientRequire = createRequire(join(clientDir, "package.json"));

/** Error text for esbuild's messages, one line each. */
const describe = (messages) =>
  messages
    .map((m) => `${m.text}${m.location ? ` (${m.location.file}:${m.location.line})` : ""}`)
    .join("; ");

/**
 * esbuild with the client bundle's own settings, written nowhere. A name imported
 * from a module that does not export it is an error in ESM and only a warning
 * (`import-is-undefined`) when the target is CommonJS or TypeScript, so the
 * warning counts as a failure too: either way the bundle calls something that is
 * not there.
 */
const bundle = async (options) => {
  const { build } = clientRequire("esbuild");
  try {
    const result = await build({
      ...BUNDLE_OPTIONS,
      ...options,
      absWorkingDir: clientDir,
      write: false,
      logLevel: "silent",
    });
    const undefinedImports = result.warnings.filter(
      (w) => w.id === "import-is-undefined",
    );
    if (undefinedImports.length > 0) return { error: describe(undefinedImports) };
    return { result };
  } catch (err) {
    return { error: err.errors ? describe(err.errors) : String(err) };
  }
};

/**
 * Which packages decide their check by what the bundle does with them: every one
 * not published from gonogo. The bundle is built only when there is one, so an
 * Uplink depending on gonogo's packages alone runs exactly the bare-Node check.
 */
const classification = new Map();
const unowned = [];
const undecided = [];
for (const [pkg, { manifest }] of byPackage) {
  const repository = repositoryOf(manifest);
  if (repository === undefined) unowned.push(pkg);
  else if (repository === GONOGO_REPOSITORY) {
    classification.set(pkg, { check: "load", why: "published from gonogo" });
  } else undecided.push(pkg);
}
if (unowned.length > 0) {
  console.error(
    `✖ no \`repository\` in the installed manifest of:\n    ${unowned.join("\n    ")}\n` +
      "  so whether it is gonogo's, and held to loading in bare Node, cannot be told.",
  );
  process.exit(1);
}
if (undecided.length > 0) {
  const { result, error } = await bundle({
    entryPoints: [clientEntry(clientDir)],
    outfile: "client.js",
    metafile: true,
  });
  if (error) {
    console.error(
      `✖ the client bundle does not build, so which packages it inlines cannot be read: ${error}`,
    );
    process.exit(1);
  }
  const inputs = Object.keys(result.metafile.inputs);
  for (const pkg of undecided) {
    const inlined = inputs.some((input) => input.includes(`node_modules/${pkg}/`));
    classification.set(
      pkg,
      inlined
        ? { check: "link", why: "not gonogo's, and the client bundle inlines it" }
        : { check: "load", why: "not gonogo's, and consumed outside the client bundle" },
    );
  }
}
for (const [pkg, { check, why }] of classification) {
  console.log(`  ${check}  ${pkg}  (${why})`);
}

/** The package an entry point belongs to: `@scope/name` of `@scope/name/sub`. */
const packageOf = (spec) => spec.split("/").slice(0, 2).join("/");
const checkFor = (spec) => classification.get(packageOf(spec)).check;

/**
 * One entry point, bundled the way the client would bundle it: every import
 * resolves, and the namespace is kept whole so none of it is tree-shaken out of
 * the question.
 */
const link = (spec) =>
  bundle({
    stdin: {
      contents:
        `import * as entry from ${JSON.stringify(spec)};\n` +
        `export * from ${JSON.stringify(spec)};\nexport { entry };\n`,
      resolveDir: clientDir,
      sourcefile: `link:${spec}`,
      loader: "js",
    },
    outfile: "link.js",
  });

const load = (spec) =>
  spawnSync(
    process.execPath,
    ["--input-type=module", "-e", `await import(${JSON.stringify(spec)});`],
    { cwd: clientDir, encoding: "utf8" },
  );

const cause = (stderr) =>
  (stderr || "")
    .split("\n")
    .map((line) => line.trim())
    .find((line) => /^(\w*Error)\b/.test(line)) ?? "no diagnostic";

/** An optional-peer exemption applies only while that peer really is absent. */
const peerMissing = (spec) => {
  const peer = EXEMPT_WITHOUT_PEER[spec];
  return peer !== undefined && !existsSync(join(modules, peer));
};

const failures = [];
const stale = [];
let loaded = 0;
let linked = 0;
let exempted = 0;
for (const spec of specs) {
  const exempt = spec in EXEMPT || peerMissing(spec);
  if (checkFor(spec) === "link") {
    // EXEMPT describes bare-Node loads; one naming a linked entry point
    // describes a check this entry point no longer gets.
    if (exempt) stale.push(`${spec} is linked, not loaded`);
    const { error } = await link(spec);
    if (error) failures.push(`${spec}: does not link: ${error}`);
    else linked += 1;
    continue;
  }
  const result = load(spec);
  if (result.status === 0) {
    if (exempt) stale.push(`${spec} now loads`);
    loaded += 1;
  } else if (exempt) exempted += 1;
  else failures.push(`${spec}: ${cause(result.stderr)}`);
}

for (const spec of [...Object.keys(EXEMPT), ...Object.keys(EXEMPT_WITHOUT_PEER)]) {
  if (specs.includes(spec)) continue;
  // An exemption cannot be stale in a client that does not install the package at
  // all. This is ONE list read by every Uplink, and realfuels installs no
  // uplink-tools, so judging its entries there reported three false stales and
  // would have pressured someone into deleting exemptions the other six need.
  if (!existsSync(join(modules, packageOf(spec)))) continue;
  stale.push(`${spec} is no longer a published entry point`);
}

for (const line of failures) console.error(`✖ ${line}`);
if (stale.length > 0) {
  console.error(
    `✖ STALE exemption(s): ${stale.join(", ")}. Delete the entry from EXEMPT in this file. An\n` +
      "  exemption nobody prunes stops describing anything and starts hiding the next one.",
  );
}
/*
 * Every entry point lands in exactly one of four counts, and they must sum to the
 * total. The arithmetic is printed rather than asserted quietly, because a count
 * that omits a bucket reads as plausible: `Object.keys(EXEMPT).length` was wrong
 * here for one run, omitting the peer-conditional entries, and the numbers did
 * not close without the line looking odd.
 */
const failed = failures.length;
const counted = loaded + linked + exempted + failed;
console.log(
  `${loaded} load + ${linked} link + ${exempted} exempt + ${failed} fail = ${counted} of ${specs.length} ` +
    "published entry point(s): loaded in a bare node process, linked with the client's own esbuild settings.",
);
if (counted !== specs.length) {
  console.error(
    `✖ the arithmetic does not close: ${counted} is not ${specs.length}. Some entry point was\n` +
      "  neither loaded, linked, exempted nor failed, so this run's numbers describe less than they appear to.",
  );
  process.exit(1);
}
process.exit(failures.length > 0 || stale.length > 0 ? 1 : 0);
