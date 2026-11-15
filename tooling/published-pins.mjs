#!/usr/bin/env node
/**
 * Whether the vendored Gonogo set is the official published artifacts of one
 * Gonogo version: the sitrep-sdk, ui-kit and uplink-tools tarballs in `vendor/`
 * and the KspGonogo.Sitrep.Contract nupkg in `vendor/nuget`.
 *
 *   node tooling/published-pins.mjs [--root <checkout>]
 *
 * Two halves. `vendoredSetProblems` is offline and runs inside
 * `scripts/check-vendor-pins.mjs`: exactly one tarball of each package, every
 * one of the four at the version `GonogoContractVersion` names, that version a
 * published release or release candidate, and the nupkg's nuspec naming the
 * gonogo commit in `vendor/gonogo-ref`. `publishedSetProblems` asks the
 * registries: each tarball's sha512 must equal npm's `dist.integrity` for that
 * version, and the nupkg's sha512 must equal the `packageHash` nuget.org's
 * catalog records for it. This command runs both.
 */
import { execFileSync } from "node:child_process";
import { createHash } from "node:crypto";
import { existsSync, readdirSync, readFileSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

export const NPM_PACKAGES = [
  "@ksp-gonogo/sitrep-sdk",
  "@ksp-gonogo/ui-kit",
  "@ksp-gonogo/uplink-tools",
];
export const NUGET_PACKAGE = "KspGonogo.Sitrep.Contract";

/** A version npm and nuget.org publish: a release or a release candidate, never a pack of a commit. */
const PUBLISHED_VERSION = /^\d+\.\d+\.\d+(-rc\.\d+)?$/;

const sha512 = (file) => createHash("sha512").update(readFileSync(file)).digest("base64");

/** The vendored file name for a package: `@ksp-gonogo/ui-kit` is `ksp-gonogo-ui-kit-…`. */
const stemOf = (name) => name.replace(/^@/, "").replace("/", "-");

/**
 * What is vendored under `root`, read from the files themselves: each tarball's
 * own package.json name and version, the nupkg's nuspec version and commit, and
 * the sha512 of every file.
 */
export function readVendoredSet(root) {
  const vendor = join(root, "vendor");
  const props = readFileSync(join(root, "Directory.Build.props"), "utf8");
  const pinned = /<GonogoContractVersion>([^<]+)<\/GonogoContractVersion>/.exec(props)?.[1] ?? null;
  const ref = existsSync(join(vendor, "gonogo-ref"))
    ? readFileSync(join(vendor, "gonogo-ref"), "utf8").trim()
    : null;

  const tarballs = readdirSync(vendor)
    .filter((file) => file.endsWith(".tgz"))
    .sort()
    .map((file) => {
      const path = join(vendor, file);
      const manifest = JSON.parse(
        execFileSync("tar", ["-xzOf", path, "package/package.json"], { encoding: "utf8" }),
      );
      return { file, name: manifest.name, version: manifest.version, integrity: `sha512-${sha512(path)}` };
    });

  const feed = join(vendor, "nuget");
  const nupkgs = (existsSync(feed) ? readdirSync(feed) : [])
    .filter((file) => file.endsWith(".nupkg"))
    .sort()
    .map((file) => {
      const path = join(feed, file);
      const nuspec = execFileSync("unzip", ["-p", path, `${NUGET_PACKAGE}.nuspec`], {
        encoding: "utf8",
      });
      return {
        file,
        version: /<version>([^<]+)<\/version>/.exec(nuspec)?.[1] ?? null,
        commit: /<repository\b[^>]*\bcommit="([0-9a-f]{40})"/.exec(nuspec)?.[1] ?? null,
        sha512: sha512(path),
      };
    });

  return { pinned, ref, tarballs, nupkgs };
}

/** The offline rule: one published version, all four packages at it, and the nupkg from the commit vendor/gonogo-ref names. */
export function vendoredSetProblems({ pinned, ref, tarballs, nupkgs }) {
  const problems = [];
  if (!pinned) {
    problems.push("Directory.Build.props declares no GonogoContractVersion.");
    return problems;
  }
  if (!PUBLISHED_VERSION.test(pinned)) {
    problems.push(
      `GonogoContractVersion is ${pinned}, which is not a version Gonogo publishes (X.Y.Z or ` +
        "X.Y.Z-rc.N). The Uplinks build against the official npm and nuget.org packages of one " +
        "Gonogo version, never a pack of a gonogo commit.",
    );
  }
  for (const name of NPM_PACKAGES) {
    const found = tarballs.filter((t) => t.name === name);
    if (found.length !== 1) {
      problems.push(
        `vendor/ holds ${found.length} tarball(s) of ${name} (${found.map((t) => t.file).join(", ") || "none"}), expected exactly one.`,
      );
      continue;
    }
    const [tarball] = found;
    if (tarball.version !== pinned) {
      problems.push(
        `vendor/${tarball.file} is ${name}@${tarball.version} and GonogoContractVersion is ${pinned}. ` +
          "All four packages must be the same Gonogo version.",
      );
    }
    if (!tarball.file.startsWith(`${stemOf(name)}-${tarball.version}-`)) {
      problems.push(
        `vendor/${tarball.file} holds ${name}@${tarball.version}, and its name says otherwise.`,
      );
    }
  }
  for (const tarball of tarballs) {
    if (!NPM_PACKAGES.includes(tarball.name)) {
      problems.push(`vendor/${tarball.file} is ${tarball.name}, which is not one of the Gonogo packages.`);
    }
  }
  if (nupkgs.length !== 1) {
    problems.push(
      `vendor/nuget holds ${nupkgs.length} package(s) (${nupkgs.map((n) => n.file).join(", ") || "none"}), expected exactly ${NUGET_PACKAGE}.${pinned}.nupkg.`,
    );
  } else {
    const [nupkg] = nupkgs;
    if (nupkg.file !== `${NUGET_PACKAGE}.${pinned}.nupkg` || nupkg.version !== pinned) {
      problems.push(
        `vendor/nuget/${nupkg.file} is ${NUGET_PACKAGE} ${nupkg.version} and GonogoContractVersion is ${pinned}. ` +
          "All four packages must be the same Gonogo version.",
      );
    }
    if (!ref || nupkg.commit !== ref) {
      problems.push(
        `vendor/nuget/${nupkg.file} was built from gonogo ${nupkg.commit ?? "(no commit in its nuspec)"} and ` +
          `vendor/gonogo-ref is ${ref ?? "(missing)"}. The two must be the same commit.`,
      );
    }
  }
  return problems;
}

/** Fetches JSON, throwing on any status but 200 so an absent version reads as absent. */
async function defaultFetchJson(url) {
  const response = await fetch(url);
  if (response.status === 404) return null;
  if (!response.ok) throw new Error(`${url} answered HTTP ${response.status}`);
  return response.json();
}

/**
 * The network rule: every vendored file is byte for byte the one the registry
 * published under its version. `fetchJson(url)` returns the parsed body, or
 * null when the registry has no such version.
 */
export async function publishedSetProblems({ tarballs, nupkgs }, fetchJson = defaultFetchJson) {
  const problems = [];
  for (const tarball of tarballs.filter((t) => NPM_PACKAGES.includes(t.name))) {
    const doc = await fetchJson(`https://registry.npmjs.org/${tarball.name}/${tarball.version}`);
    if (!doc) {
      problems.push(`${tarball.name}@${tarball.version} is not published on npm, so vendor/${tarball.file} is not an official package.`);
    } else if (doc.dist?.integrity !== tarball.integrity) {
      problems.push(
        `vendor/${tarball.file} hashes to ${tarball.integrity.slice(0, 24)}… and npm published ` +
          `${tarball.name}@${tarball.version} as ${String(doc.dist?.integrity).slice(0, 24)}…. It is not the published tarball.`,
      );
    }
  }
  for (const nupkg of nupkgs) {
    const id = NUGET_PACKAGE.toLowerCase();
    const leaf = await fetchJson(
      `https://api.nuget.org/v3/registration5-gz-semver2/${id}/${String(nupkg.version).toLowerCase()}.json`,
    );
    const entry = leaf && (await fetchJson(leaf.catalogEntry));
    if (!entry) {
      problems.push(`${NUGET_PACKAGE} ${nupkg.version} is not published on nuget.org, so vendor/nuget/${nupkg.file} is not an official package.`);
    } else if (entry.packageHashAlgorithm !== "SHA512" || entry.packageHash !== nupkg.sha512) {
      problems.push(
        `vendor/nuget/${nupkg.file} hashes to ${nupkg.sha512.slice(0, 24)}… and nuget.org published ` +
          `${NUGET_PACKAGE} ${nupkg.version} as ${String(entry.packageHash).slice(0, 24)}…. It is not the published package.`,
      );
    }
  }
  return problems;
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const at = process.argv.indexOf("--root");
  const root = at > -1 ? resolve(process.argv[at + 1]) : join(dirname(fileURLToPath(import.meta.url)), "..");
  const set = readVendoredSet(root);
  const problems = [...vendoredSetProblems(set), ...(await publishedSetProblems(set))];
  if (problems.length > 0) {
    console.error(`✖ ${problems.length} problem(s) with the vendored Gonogo set:`);
    for (const p of problems) console.error(`    ${p}`);
    process.exit(1);
  }
  console.log(
    `✓ the vendored Gonogo set is the published ${set.pinned}: ${set.tarballs.length} npm tarball(s) ` +
      `match npm's dist.integrity and ${set.nupkgs[0].file} matches nuget.org's packageHash.`,
  );
}
