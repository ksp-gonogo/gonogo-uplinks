#!/usr/bin/env node
/**
 * Points a checkout at Gonogo packages PACKED FROM A GONOGO COMMIT, not the ones
 * vendored here and not the ones on npm and nuget.org:
 *
 *   node tooling/use-packed-gonogo.mjs <dir> [--root <checkout>]
 *
 * <dir> holds what the nightly's pack job uploaded: one stamped tarball each of
 * sitrep-sdk, ui-kit and uplink-tools, `KspGonogo.Sitrep.Contract.<version>.nupkg`,
 * and `contract-version.txt` naming that version. Every client's `file:`
 * dependency on the three becomes a `file:` path to the tarball in <dir>, and an
 * `overrides` entry for each does the same for the exact sibling pins the stamped
 * manifests carry, which would otherwise be fetched from a registry that does not
 * have them. The lockfile goes (the next step is `npm install`), the nupkg
 * replaces the one in `vendor/nuget`, and `GonogoContractVersion` becomes its
 * version. It edits the working tree only; the workflow that calls it runs in a
 * throwaway checkout and commits nothing.
 */
import { existsSync, readdirSync, readFileSync, rmSync, writeFileSync, copyFileSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { repointBuildProps } from "./use-published-packages.mjs";

const PACKAGES = ["@ksp-gonogo/sitrep-sdk", "@ksp-gonogo/ui-kit", "@ksp-gonogo/uplink-tools"];
const SECTIONS = ["dependencies", "devDependencies", "peerDependencies", "optionalDependencies"];

/** Package name to the tarball in `dir` that holds it. Throws when one of the three is missing or ambiguous. */
export function findTarballs(dir) {
  const files = readdirSync(dir).filter((f) => f.endsWith(".tgz"));
  const found = {};
  for (const name of PACKAGES) {
    const prefix = `${name.slice(1).replace("/", "-")}-`;
    const matches = files.filter((f) => f.startsWith(prefix) && /^\d/.test(f.slice(prefix.length)));
    if (matches.length !== 1) {
      throw new Error(`${dir} holds ${matches.length} tarball(s) for ${name}, expected exactly one`);
    }
    found[name] = resolve(dir, matches[0]);
  }
  return found;
}

/** The package.json text with each vendored dependency on a Gonogo package pointing at its packed tarball. Returns null when nothing changed. */
export function repointToTarballs(text, tarballs) {
  const json = JSON.parse(text);
  let changed = false;
  for (const section of SECTIONS) {
    for (const name of PACKAGES) {
      const spec = json[section]?.[name];
      if (typeof spec === "string" && spec.startsWith("file:")) {
        json[section][name] = `file:${tarballs[name]}`;
        changed = true;
      }
    }
  }
  if (!changed) return null;
  json.overrides = {
    ...json.overrides,
    ...Object.fromEntries(PACKAGES.map((name) => [name, `file:${tarballs[name]}`])),
  };
  return `${JSON.stringify(json, null, 2)}\n`;
}

export function usePackedGonogo(root, dir) {
  const tarballs = findTarballs(dir);
  const nupkgs = readdirSync(dir).filter((f) => /^KspGonogo\.Sitrep\.Contract\..+\.nupkg$/.test(f));
  if (nupkgs.length !== 1) throw new Error(`${dir} holds ${nupkgs.length} contract package(s), expected exactly one`);
  const version = readFileSync(join(dir, "contract-version.txt"), "utf8").trim();
  if (!nupkgs[0].endsWith(`.${version}.nupkg`)) {
    throw new Error(`${nupkgs[0]} is not version ${version}`);
  }

  const touched = [];
  const uplinks = join(root, "uplinks");
  for (const name of readdirSync(uplinks)) {
    const client = join(uplinks, name, "client");
    const manifest = join(client, "package.json");
    if (!existsSync(manifest)) continue;
    const next = repointToTarballs(readFileSync(manifest, "utf8"), tarballs);
    if (next === null) continue;
    writeFileSync(manifest, next);
    rmSync(join(client, "package-lock.json"), { force: true });
    touched.push(name);
  }

  const feed = join(root, "vendor", "nuget");
  for (const old of readdirSync(feed)) {
    if (/^KspGonogo\.Sitrep\.Contract\..+\.nupkg$/.test(old)) rmSync(join(feed, old));
  }
  copyFileSync(join(dir, nupkgs[0]), join(feed, nupkgs[0]));
  const props = join(root, "Directory.Build.props");
  writeFileSync(props, repointBuildProps(readFileSync(props, "utf8"), version));
  return { touched, version };
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const args = process.argv.slice(2);
  const at = args.indexOf("--root");
  const root =
    at >= 0 ? resolve(args.splice(at, 2)[1]) : resolve(dirname(fileURLToPath(import.meta.url)), "..");
  const [dir] = args;
  if (!dir) {
    console.error("usage: use-packed-gonogo.mjs <dir> [--root <checkout>]");
    process.exit(2);
  }
  const { touched, version } = usePackedGonogo(root, resolve(dir));
  console.log(`${touched.length} client(s) now install the packed packages, contract ${version}: ${touched.join(", ")}`);
  if (touched.length === 0) process.exit(1);
}
