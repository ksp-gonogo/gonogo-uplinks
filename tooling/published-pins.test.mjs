import assert from "node:assert/strict";
import { test } from "node:test";
import { publishedSetProblems, vendoredSetProblems } from "./published-pins.mjs";

const REF = "ac1d7a6fddf6acb6994a47e4e48483673a8a3f33";

function set(overrides = {}) {
  const version = overrides.version ?? "1.0.0";
  return {
    pinned: version,
    ref: REF,
    tarballs: [
      { file: `ksp-gonogo-sitrep-sdk-${version}-aaaaaaaaaaaa.tgz`, name: "@ksp-gonogo/sitrep-sdk", version, integrity: "sha512-sdk" },
      { file: `ksp-gonogo-ui-kit-${version}-bbbbbbbbbbbb.tgz`, name: "@ksp-gonogo/ui-kit", version, integrity: "sha512-kit" },
      { file: `ksp-gonogo-uplink-tools-${version}-cccccccccccc.tgz`, name: "@ksp-gonogo/uplink-tools", version, integrity: "sha512-tools" },
    ],
    nupkgs: [
      { file: `KspGonogo.Sitrep.Contract.${version}.nupkg`, version, commit: REF, sha512: "nupkg" },
    ],
    ...overrides,
  };
}

/** A registry that published exactly `published`: npm integrities by name@version and nuget hashes by version. */
function registry(published) {
  return async (url) => {
    const npm = /^https:\/\/registry\.npmjs\.org\/(@ksp-gonogo\/[^/]+)\/(.+)$/.exec(url);
    if (npm) {
      const integrity = published.npm[`${npm[1]}@${npm[2]}`];
      return integrity ? { dist: { integrity } } : null;
    }
    const leaf = /registration5-gz-semver2\/kspgonogo\.sitrep\.contract\/(.+)\.json$/.exec(url);
    if (leaf) return published.nuget[leaf[1]] ? { catalogEntry: `catalog:${leaf[1]}` } : null;
    const catalog = /^catalog:(.+)$/.exec(url);
    if (catalog) return { packageHashAlgorithm: "SHA512", packageHash: published.nuget[catalog[1]] };
    throw new Error(`unexpected fetch ${url}`);
  };
}

const PUBLISHED_1_0_0 = registry({
  npm: {
    "@ksp-gonogo/sitrep-sdk@1.0.0": "sha512-sdk",
    "@ksp-gonogo/ui-kit@1.0.0": "sha512-kit",
    "@ksp-gonogo/uplink-tools@1.0.0": "sha512-tools",
  },
  nuget: { "1.0.0": "nupkg" },
});

test("a set that is the published packages of one version passes both halves", async () => {
  assert.deepEqual(vendoredSetProblems(set()), []);
  assert.deepEqual(await publishedSetProblems(set(), PUBLISHED_1_0_0), []);
});

test("a release candidate is a published version too", () => {
  assert.deepEqual(vendoredSetProblems(set({ version: "1.0.1-rc.2" })), []);
});

test("one package at another version is refused, naming it", () => {
  const mixed = set();
  mixed.tarballs[1] = { ...mixed.tarballs[1], file: "ksp-gonogo-ui-kit-0.9.0-bbbbbbbbbbbb.tgz", version: "0.9.0" };
  const problems = vendoredSetProblems(mixed);
  assert.equal(problems.length, 1);
  assert.match(problems[0], /ui-kit@0\.9\.0 and GonogoContractVersion is 1\.0\.0/);
});

test("a nupkg at another version is refused", () => {
  const mixed = set();
  mixed.nupkgs[0] = { ...mixed.nupkgs[0], file: "KspGonogo.Sitrep.Contract.0.9.0.nupkg", version: "0.9.0" };
  assert.match(vendoredSetProblems(mixed).join("\n"), /Contract 0\.9\.0 and GonogoContractVersion is 1\.0\.0/);
});

test("a pack of a gonogo commit is refused by its version", () => {
  const packed = set({ version: "1.0.0-pin.gac1d7a6fddf6" });
  assert.match(vendoredSetProblems(packed).join("\n"), /not a version Gonogo publishes/);
});

test("a nupkg from another commit than vendor/gonogo-ref is refused", () => {
  const other = set();
  other.nupkgs[0] = { ...other.nupkgs[0], commit: "f".repeat(40) };
  assert.match(vendoredSetProblems(other).join("\n"), /must be the same commit/);
});

test("a missing or doubled package is refused", () => {
  const missing = set();
  missing.tarballs.pop();
  assert.match(vendoredSetProblems(missing).join("\n"), /0 tarball\(s\) of @ksp-gonogo\/uplink-tools/);
  const doubled = set();
  doubled.tarballs.push({ ...doubled.tarballs[0], file: "ksp-gonogo-sitrep-sdk-1.0.0-dddddddddddd.tgz" });
  assert.match(vendoredSetProblems(doubled).join("\n"), /2 tarball\(s\) of @ksp-gonogo\/sitrep-sdk/);
});

test("a tarball whose bytes are not the published ones is refused", async () => {
  const repacked = set();
  repacked.tarballs[0] = { ...repacked.tarballs[0], integrity: "sha512-repacked" };
  const problems = await publishedSetProblems(repacked, PUBLISHED_1_0_0);
  assert.equal(problems.length, 1);
  assert.match(problems[0], /not the published tarball/);
});

test("a nupkg whose bytes are not the published ones is refused", async () => {
  const repacked = set();
  repacked.nupkgs[0] = { ...repacked.nupkgs[0], sha512: "repacked" };
  assert.match((await publishedSetProblems(repacked, PUBLISHED_1_0_0)).join("\n"), /not the published package/);
});

test("a version the registries never published is refused", async () => {
  const unpublished = set({ version: "1.0.7" });
  const problems = await publishedSetProblems(unpublished, PUBLISHED_1_0_0);
  assert.equal(problems.length, 4);
  for (const p of problems) assert.match(p, /is not published on (npm|nuget\.org)/);
});
