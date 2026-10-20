#!/usr/bin/env node
/**
 * Checks that each Uplink's `mod.builtAgainst` is the version it builds against:
 *
 *   check-built-against.mjs [<uplink-dir-name>...]   default: every Uplink
 *
 * The version appears in uplink.json and in the client's generated
 * gonogo-uplink.json, and the two must agree. Beyond that it is compared with
 * the source the Uplink actually builds against: the version floor of the mod's
 * npm client dependency (Kerbcast), or the version of the mod assembly
 * named by `mod.assembly` under vendor/gamedata. The assembly check fails when
 * the assembly is not there, because a check that skips reports success it did
 * not earn, so run it where the reference set is resolved.
 */
import { existsSync, readdirSync, readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");

/** Uplinks whose mod is an npm package the client depends on, by Uplink directory. */
export const CLIENT_DEPENDENCY = { kerbcast: "@ksp-gonogo/kerbcast" };

/** Version components with trailing zeros dropped, so 15.15.0 and 15.15.0.0 are one version. */
export function normalise(version) {
  const parts = String(version).replace(/^v/i, "").split(".");
  while (parts.length > 1 && parts[parts.length - 1] === "0") parts.pop();
  return parts.join(".");
}

/**
 * The version a .NET assembly reports, read from its FileVersion string
 * resource, else its ProductVersion, without any `+commit` suffix. A
 * ProductVersion can be free text, so only a value that starts with a digit
 * counts.
 */
export function assemblyVersion(buffer) {
  for (const name of ["FileVersion", "ProductVersion"]) {
    const key = Buffer.from(`${name}\0`, "utf16le");
    for (let at = buffer.indexOf(key); at !== -1; at = buffer.indexOf(key, at + 1)) {
      let start = at + key.length;
      while (buffer[start] === 0 && buffer[start + 1] === 0) start += 2;
      let end = start;
      while (end + 1 < buffer.length && !(buffer[end] === 0 && buffer[end + 1] === 0)) end += 2;
      const value = buffer.subarray(start, end).toString("utf16le").split("+")[0];
      if (/^\d+(\.\d+)*$/.test(value)) return value;
    }
  }
  return undefined;
}

/** The lowest version a semver range such as `^1.10.2` accepts. */
export function rangeFloor(range) {
  return /(\d+(?:\.\d+)*)/.exec(range)?.[1];
}

/** Whether the Uplink's mod project references the assembly at compile time; one that reaches the mod by reflection has none in the reference set. */
function compilesAgainst(dir, assembly) {
  const file = assembly.split("/").at(-1);
  const modDir = join(dir, "mod");
  if (!existsSync(modDir)) return false;
  return readdirSync(modDir)
    .filter((entry) => entry.endsWith(".csproj"))
    .some((entry) =>
      readFileSync(join(modDir, entry), "utf8")
        .match(/<HintPath>[^<]*<\/HintPath>/g)
        ?.some((hint) => hint.endsWith(`${file}</HintPath>`)),
    );
}

const readJson = (path) => JSON.parse(readFileSync(path, "utf8"));

/** Every disagreement found for one Uplink, as sentences. */
export function problemsFor(name, root = ROOT, { requireAssembly = false } = {}) {
  const dir = join(root, "uplinks", name);
  const uplink = readJson(join(dir, "uplink.json"));
  const claimed = uplink.mod?.builtAgainst;
  const problems = [];
  if (!claimed) return [`${name}: uplink.json declares no mod.builtAgainst`];

  const manifestPath = join(dir, "client", "gonogo-uplink.json");
  if (existsSync(manifestPath)) {
    const manifest = readJson(manifestPath).mod ?? {};
    if (manifest.builtAgainst !== claimed) {
      problems.push(
        `${name}: gonogo-uplink.json says ${manifest.builtAgainst}, uplink.json says ${claimed}`,
      );
    }
  }

  const npmName = CLIENT_DEPENDENCY[name];
  if (npmName) {
    const pkg = readJson(join(dir, "client", "package.json"));
    const range = pkg.dependencies?.[npmName] ?? pkg.devDependencies?.[npmName];
    const floor = range && rangeFloor(range);
    if (!floor) problems.push(`${name}: client/package.json does not depend on ${npmName}`);
    else if (normalise(floor) !== normalise(claimed)) {
      problems.push(`${name}: the client depends on ${npmName} ${range}, builtAgainst is ${claimed}`);
    }
  }

  if (uplink.mod?.assembly) {
    const dll = join(root, "vendor", "gamedata", uplink.mod.assembly);
    if (!existsSync(dll)) {
      if (requireAssembly && compilesAgainst(dir, uplink.mod.assembly)) problems.push(`${name}: ${dll} is not in the reference set`);
    } else {
      const built = assemblyVersion(readFileSync(dll));
      if (!built) problems.push(`${name}: ${uplink.mod.assembly} carries no version`);
      else if (normalise(built) !== normalise(claimed)) {
        problems.push(
          `${name}: ${uplink.mod.assembly} in the reference set is ${built}, builtAgainst is ${claimed}`,
        );
      }
    }
  }
  return problems;
}

export function uplinkNames(root = ROOT) {
  return readdirSync(join(root, "uplinks")).filter((name) =>
    existsSync(join(root, "uplinks", name, "uplink.json")),
  );
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  const named = process.argv.slice(2);
  const names = named.length > 0 ? named : uplinkNames();
  const problems = names.flatMap((name) => problemsFor(name, ROOT, { requireAssembly: true }));
  for (const problem of problems) console.error(`✖ ${problem}`);
  if (problems.length > 0) process.exit(1);
  console.log(`builtAgainst matches the build for ${names.join(", ")}`);
}
