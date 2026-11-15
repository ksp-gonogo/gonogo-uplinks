#!/usr/bin/env node
/**
 * Checks that one Uplink's build targets the Gonogo version this repository pins:
 *
 *   check-gonogo-target.mjs <uplink-dir-name> [--mod-dir <dir>]
 *
 * The pinned version is read from the vendored packages themselves, never from
 * npm: the extension API version and contract pair from the sitrep-sdk
 * tarball's `dist/compat-versions.js`, and the contract stamp from the
 * `Sitrep.Contract.dll` inside the vendored nupkg. Two things are then held to it:
 *
 * - the client's `gonogo-uplink.json`, whose `apiVersion`, `contractMajor` and
 *   `contractMinor` are what the app's compatibility gate reads
 * - the contract stamp of the `Sitrep.Contract.dll` the mod's project restored,
 *   found through its `obj/project.assets.json`
 *
 * A mod that was not restored fails the check, because a check that skips
 * reports success it did not earn: run it after the build that restores it.
 * Writes a summary to `$GITHUB_STEP_SUMMARY` when that is set.
 */
import { spawnSync } from "node:child_process";
import { appendFileSync, existsSync, readdirSync, readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import { inflateRawSync } from "node:zlib";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
const STAMP_KEY = "SitrepContractVersion";
const CONTRACT_DLL = /(^|\/)lib\/net472\/Sitrep\.Contract\.dll$/;

/** The contract stamp ("52.2") a Sitrep.Contract.dll carries: its metadata key, a length byte, then the text. */
export function contractStamp(buffer) {
  const bytes = buffer.toString("latin1");
  const at = bytes.indexOf(STAMP_KEY);
  if (at === -1) return undefined;
  const start = at + STAMP_KEY.length + 1;
  const stamp = bytes.slice(start, start + bytes.charCodeAt(start - 1));
  return /^\d+\.\d+$/.test(stamp) ? stamp : undefined;
}

/** The three constants of an sdk's `compat-versions.js`, read as text so nothing is executed. */
export function compatOf(source) {
  const api = /export const EXTENSION_API_VERSION = "([^"]+)"/.exec(source)?.[1];
  const major = /export const CONTRACT_MAJOR = (\d+)/.exec(source)?.[1];
  const minor = /export const CONTRACT_MINOR = (\d+)/.exec(source)?.[1];
  if (!api || major === undefined || minor === undefined) return undefined;
  return { apiVersion: api, contract: `${major}.${minor}` };
}

/** Every entry of a zip, by name, read through its central directory. */
export function zipEntries(buffer) {
  let end = buffer.length - 22;
  while (end >= 0 && buffer.readUInt32LE(end) !== 0x06054b50) end -= 1;
  if (end < 0) throw new Error("not a zip file");
  const count = buffer.readUInt16LE(end + 10);
  let at = buffer.readUInt32LE(end + 16);
  const entries = new Map();
  for (let i = 0; i < count; i += 1) {
    const method = buffer.readUInt16LE(at + 10);
    const size = buffer.readUInt32LE(at + 20);
    const nameLength = buffer.readUInt16LE(at + 28);
    const extraLength = buffer.readUInt16LE(at + 30);
    const commentLength = buffer.readUInt16LE(at + 32);
    const local = buffer.readUInt32LE(at + 42);
    const name = buffer.toString("utf8", at + 46, at + 46 + nameLength);
    const dataAt = local + 30 + buffer.readUInt16LE(local + 26) + buffer.readUInt16LE(local + 28);
    const raw = buffer.subarray(dataAt, dataAt + size);
    entries.set(name, method === 0 ? raw : inflateRawSync(raw));
    at += 46 + nameLength + extraLength + commentLength;
  }
  return entries;
}

function only(dir, pattern, what) {
  const found = existsSync(dir) ? readdirSync(dir).filter((f) => pattern.test(f)) : [];
  if (found.length !== 1) {
    throw new Error(`expected exactly one ${what} in ${dir}, found ${found.length}`);
  }
  return join(dir, found[0]);
}

/** What the repository pins, read from the vendored sdk tarball and nupkg. */
export function pinnedGonogo(root = ROOT) {
  const vendor = join(root, "vendor");
  const sdkTgz = only(vendor, /^ksp-gonogo-sitrep-sdk-.*\.tgz$/, "vendored sitrep-sdk tarball");
  const nupkg = only(
    join(vendor, "nuget"),
    /^KspGonogo\.Sitrep\.Contract\..*\.nupkg$/,
    "vendored contract nupkg",
  );
  const tar = (member) => {
    const out = spawnSync("tar", ["-xzOf", sdkTgz, member], { maxBuffer: 64 * 1024 * 1024 });
    if (out.status !== 0) throw new Error(`${sdkTgz} has no ${member}`);
    return out.stdout.toString("utf8");
  };
  const compat = compatOf(tar("package/dist/compat-versions.js"));
  if (!compat) throw new Error(`${sdkTgz} dist/compat-versions.js exports no EXTENSION_API_VERSION and contract pair`);
  const entries = zipEntries(readFileSync(nupkg));
  const dll = [...entries].find(([name]) => CONTRACT_DLL.test(name))?.[1];
  const stamp = dll && contractStamp(dll);
  if (!stamp) throw new Error(`${nupkg} carries no ${STAMP_KEY} in lib/net472/Sitrep.Contract.dll`);
  const nuspec = [...entries].find(([name]) => name.endsWith(".nuspec"))?.[1]?.toString("utf8");
  const sdkVersion = JSON.parse(tar("package/package.json")).version;
  return {
    apiVersion: compat.apiVersion,
    contract: compat.contract,
    stamp,
    sdkVersion,
    packageVersion: /<version>([^<]+)<\/version>/.exec(nuspec ?? "")?.[1] ?? "unknown",
  };
}

/** The contract stamp of the Sitrep.Contract the mod project in `modDir` restored. */
export function restoredStamp(modDir) {
  const assetsPath = join(modDir, "obj", "project.assets.json");
  if (!existsSync(assetsPath)) {
    throw new Error(`${assetsPath} does not exist, so the contract this mod restored cannot be read; run it after the mod is built`);
  }
  const assets = JSON.parse(readFileSync(assetsPath, "utf8"));
  const library = Object.entries(assets.libraries ?? {}).find(([key]) =>
    key.toLowerCase().startsWith("kspgonogo.sitrep.contract/"),
  );
  if (!library) throw new Error(`${assetsPath} restored no KspGonogo.Sitrep.Contract`);
  for (const folder of Object.keys(assets.packageFolders ?? {})) {
    for (const group of ["net472", "netstandard2.0"]) {
      const dll = join(folder, library[1].path, "lib", group, "Sitrep.Contract.dll");
      if (existsSync(dll)) {
        const stamp = contractStamp(readFileSync(dll));
        if (stamp) return { stamp, version: library[0].split("/")[1] };
      }
    }
  }
  throw new Error(`${assetsPath} names KspGonogo.Sitrep.Contract, but no Sitrep.Contract.dll with a stamp is in its package folders`);
}

/**
 * Every way one Uplink's build disagrees with the pinned Gonogo, as sentences.
 * `client` is the parsed gonogo-uplink.json, or undefined for an Uplink with no
 * client; `mod` is `{ stamp }`, or undefined for one with no mod.
 */
export function problemsFor(name, pinned, { client, mod }) {
  const problems = [];
  if (client) {
    if (typeof client.apiVersion !== "string" || client.apiVersion === "") {
      problems.push(`${name}: gonogo-uplink.json records no apiVersion, so the client's target cannot be shown`);
    } else if (client.apiVersion !== pinned.apiVersion) {
      problems.push(
        `${name}: the client was built for extension API ${client.apiVersion} and this repository pins Gonogo ${pinned.sdkVersion} (extension API ${pinned.apiVersion})`,
      );
    }
    const built = `${client.contractMajor}.${client.contractMinor}`;
    if (built !== pinned.contract) {
      problems.push(`${name}: the client's manifest says contract ${built} and the pin is contract ${pinned.contract}`);
    }
  }
  if (mod && mod.stamp !== pinned.stamp) {
    problems.push(
      `${name}: the mod was built against contract ${mod.stamp} and the pinned KspGonogo.Sitrep.Contract ${pinned.packageVersion} is contract ${pinned.stamp}`,
    );
  }
  return problems;
}

/** The summary lines saying what each half was built for and what was pinned. */
export function summaryFor(name, pinned, { client, mod }) {
  const rows = [
    `| ${name} | client built for | ${client ? `extension API ${client.apiVersion ?? "none"}, contract ${client.contractMajor}.${client.contractMinor}` : "no client"} |`,
    `| ${name} | mod built against | ${mod ? `contract ${mod.stamp}` : "no mod"} |`,
    `| ${name} | pinned | Gonogo packages ${pinned.sdkVersion} / ${pinned.packageVersion}: extension API ${pinned.apiVersion}, contract ${pinned.stamp} |`,
  ];
  return rows.join("\n");
}

export function inspect(name, { root = ROOT, modDir } = {}) {
  const pinned = pinnedGonogo(root);
  const manifest = join(root, "uplinks", name, "client", "gonogo-uplink.json");
  const client = existsSync(manifest) ? JSON.parse(readFileSync(manifest, "utf8")) : undefined;
  const mod = modDir ? restoredStamp(modDir) : undefined;
  return { pinned, client, mod };
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  const [name, ...rest] = process.argv.slice(2);
  const at = rest.indexOf("--mod-dir");
  const modDir = at === -1 ? undefined : rest[at + 1];
  if (!name) {
    console.error("usage: check-gonogo-target.mjs <uplink-dir-name> [--mod-dir <dir>]");
    process.exit(2);
  }
  let found;
  try {
    found = inspect(name, { modDir });
  } catch (error) {
    console.error(`✖ ${name}: ${error.message}`);
    process.exit(1);
  }
  const problems = problemsFor(name, found.pinned, found);
  const summary = [
    `### Gonogo target: ${name}`,
    "",
    "| Uplink | | |",
    "|---|---|---|",
    summaryFor(name, found.pinned, found),
    "",
    ...problems.map((p) => `- ✖ ${p}`),
    "",
  ].join("\n");
  if (process.env.GITHUB_STEP_SUMMARY) appendFileSync(process.env.GITHUB_STEP_SUMMARY, `${summary}\n`);
  for (const problem of problems) console.error(`✖ ${problem}`);
  if (problems.length > 0) process.exit(1);
  console.log(`${name} targets the pinned Gonogo (extension API ${found.pinned.apiVersion}, contract ${found.pinned.stamp})`);
}
