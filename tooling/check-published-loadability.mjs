#!/usr/bin/env node
/**
 * Can the packages this Uplink depends on actually be IMPORTED?
 *
 * ## Why this is separate from `npm test`, and must stay separate
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
 * So loadability is asked in a bare `node` process, with no bundler anywhere near
 * it, and the answer is reported on its own. A test run answers "does my code
 * work"; this answers "can anyone install what my code needs".
 *
 * Exit 0 when every non-exempt entry point loads, 1 otherwise.
 */

import { spawnSync } from "node:child_process";
import { existsSync, readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");

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
  const specs = [];
  const missing = [];
  for (const pkg of dependedScopePackages()) {
    const manifest = join(modules, pkg, "package.json");
    if (!existsSync(manifest)) {
      missing.push(pkg);
      continue;
    }
    const { exports = {} } = JSON.parse(readFileSync(manifest, "utf8"));
    for (const key of Object.keys(exports)) {
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
  return specs;
}

const specs = publishedEntryPoints();

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
for (const spec of specs) {
  const result = load(spec);
  const exempt = spec in EXEMPT || peerMissing(spec);
  if (result.status === 0) {
    if (exempt) stale.push(`${spec} now loads`);
    else loaded += 1;
  } else if (!exempt) {
    failures.push(`${spec}: ${cause(result.stderr)}`);
  }
}
/** The package an exempted specifier belongs to: `@scope/name` of `@scope/name/sub`. */
const packageOf = (spec) => spec.split("/").slice(0, 2).join("/");

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
 * loaded + exempt must equal the total, and the arithmetic is printed rather than
 * asserted quietly. `Object.keys(EXEMPT).length` was wrong here for one run: it
 * omits the peer-conditional entries, so the numbers did not close and a specifier
 * could have gone unaccounted for without the line looking odd.
 */
const exempt = specs.filter((spec) => spec in EXEMPT || peerMissing(spec)).length;
console.log(
  `${loaded} load + ${exempt} exempt = ${loaded + exempt} of ${specs.length} published entry ` +
    "point(s), in a bare node process with no bundler involved.",
);
if (loaded + exempt !== specs.length) {
  console.error(
    `✖ the arithmetic does not close: ${loaded} + ${exempt} is not ${specs.length}. Some entry point\n` +
      "  was neither loaded nor accounted for, so this run's numbers describe less than they appear to.",
  );
  process.exit(1);
}
process.exit(failures.length > 0 || stale.length > 0 ? 1 : 0);
