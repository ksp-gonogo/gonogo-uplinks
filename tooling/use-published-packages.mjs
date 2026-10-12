#!/usr/bin/env node
/**
 * Points a checkout at the PUBLISHED release candidate of the Gonogo packages
 * instead of the tarballs and the nupkg vendored from one gonogo commit:
 *
 *   node tooling/use-published-packages.mjs <version> [--root <dir>]
 *
 * Every client's `file:` dependency on sitrep-sdk, ui-kit and uplink-tools
 * becomes exactly <version>, its lockfile is removed (the next step is
 * `npm install`), `GonogoContractVersion` becomes <version>, and nuget.config
 * takes KspGonogo.Sitrep.Contract from nuget.org. It edits the working tree
 * only; the workflow that calls it runs in a throwaway checkout and commits
 * nothing, so main keeps building from its vendored pin.
 */
import { existsSync, readdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const PACKAGES = ["@ksp-gonogo/sitrep-sdk", "@ksp-gonogo/ui-kit", "@ksp-gonogo/uplink-tools"];
const SECTIONS = ["dependencies", "devDependencies", "peerDependencies", "optionalDependencies"];
const VERSION = /^\d+\.\d+\.\d+(-[0-9A-Za-z.-]+)?$/;

/** The package.json text with each vendored dependency on a Gonogo package at exactly `version`. Returns null when nothing changed. */
export function repointPackageJson(text, version) {
  const json = JSON.parse(text);
  let changed = false;
  for (const section of SECTIONS) {
    for (const name of PACKAGES) {
      const spec = json[section]?.[name];
      if (typeof spec === "string" && spec.startsWith("file:")) {
        json[section][name] = version;
        changed = true;
      }
    }
  }
  return changed ? `${JSON.stringify(json, null, 2)}\n` : null;
}

/** Directory.Build.props with the contract package at `version`. */
export function repointBuildProps(text, version) {
  if (!/<GonogoContractVersion>[^<]*<\/GonogoContractVersion>/.test(text)) {
    throw new Error("Directory.Build.props has no GonogoContractVersion to move");
  }
  return text.replace(
    /(<GonogoContractVersion>)[^<]*(<\/GonogoContractVersion>)/,
    `$1${version}$2`,
  );
}

/** A nuget.config that takes every package, the contract included, from nuget.org. */
export function publishedNugetConfig() {
  return `<?xml version="1.0" encoding="utf-8"?>
<configuration>
  <packageSources>
    <clear />
    <add key="nuget.org" value="https://api.nuget.org/v3/index.json" />
  </packageSources>
</configuration>
`;
}

export function usePublishedPackages(root, version) {
  if (!VERSION.test(version)) throw new Error(`"${version}" is not an exact version`);
  const touched = [];
  const uplinks = join(root, "uplinks");
  for (const name of readdirSync(uplinks)) {
    const client = join(uplinks, name, "client");
    const manifest = join(client, "package.json");
    if (!existsSync(manifest)) continue;
    const next = repointPackageJson(readFileSync(manifest, "utf8"), version);
    if (next === null) continue;
    writeFileSync(manifest, next);
    rmSync(join(client, "package-lock.json"), { force: true });
    touched.push(name);
  }
  const props = join(root, "Directory.Build.props");
  writeFileSync(props, repointBuildProps(readFileSync(props, "utf8"), version));
  writeFileSync(join(root, "nuget.config"), publishedNugetConfig());
  return touched;
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const args = process.argv.slice(2);
  const at = args.indexOf("--root");
  const root =
    at >= 0 ? resolve(args.splice(at, 2)[1]) : resolve(dirname(fileURLToPath(import.meta.url)), "..");
  const [version] = args;
  if (!version) {
    console.error("usage: use-published-packages.mjs <version> [--root <dir>]");
    process.exit(2);
  }
  const touched = usePublishedPackages(root, version);
  console.log(`${touched.length} client(s) now install the published packages at ${version}: ${touched.join(", ")}`);
  if (touched.length === 0) process.exit(1);
}
