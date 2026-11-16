#!/usr/bin/env node
/**
 * Checks that every CKAN-listed Uplink's `mod.ckanVersion` is exactly the
 * spelling CKAN lists for `mod.builtAgainst`:
 *
 *   check-ckan-pins.mjs [<uplink-dir-name>...]   default: every Uplink
 *
 * It asks CKAN-meta through `uplink-tools deps pin-ckan` run on a scratch copy
 * of each uplink.json, so the tree is never written, and compares what that
 * wrote with what the Uplink declares. A mod CKAN lists no single release for
 * (none, or several) is a failure that names the candidates. Needs the network,
 * and GITHUB_TOKEN so the CKAN-meta contents API is not anonymous.
 */
import { spawnSync } from "node:child_process";
import { copyFileSync, mkdtempSync, readdirSync, readFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");

/** The problem with a declared ckanVersion against the spelling CKAN lists, or undefined when it is exact. */
export function pinProblem(name, declared, listed) {
  if (!declared) {
    return `${name}: mod.ckanVersion is missing, CKAN lists the pin as ${listed}. Run \`node tooling/uplink-tools.mjs ${name} deps pin-ckan\``;
  }
  if (declared !== listed) {
    return `${name}: mod.ckanVersion is ${declared}, CKAN lists the pin as ${listed}. Run \`node tooling/uplink-tools.mjs ${name} deps pin-ckan\``;
  }
  return undefined;
}

export function ckanUplinks(root = ROOT) {
  return readdirSync(join(root, "uplinks")).filter((name) => {
    try {
      const mod = JSON.parse(readFileSync(join(root, "uplinks", name, "uplink.json"), "utf8")).mod;
      return mod?.tier === "ckan" && Boolean(mod.ckan);
    } catch {
      return false;
    }
  });
}

function problemFor(name) {
  const scratch = mkdtempSync(join(tmpdir(), "ckan-pin-"));
  try {
    const source = join(ROOT, "uplinks", name, "uplink.json");
    const copy = join(scratch, "uplink.json");
    copyFileSync(source, copy);
    const ran = spawnSync(
      process.execPath,
      [join(ROOT, "tooling", "uplink-tools.mjs"), name, "deps", "pin-ckan", "--uplink", scratch],
      { encoding: "utf8" },
    );
    if (ran.status !== 0) return `${name}: ${(ran.stderr || ran.stdout).trim()}`;
    const declared = JSON.parse(readFileSync(source, "utf8")).mod.ckanVersion;
    const listed = JSON.parse(readFileSync(copy, "utf8")).mod.ckanVersion;
    return pinProblem(name, declared, listed);
  } finally {
    rmSync(scratch, { recursive: true, force: true });
  }
}

if (import.meta.url === pathToFileURL(process.argv[1] ?? "").href) {
  const names = process.argv.length > 2 ? process.argv.slice(2) : ckanUplinks();
  const problems = names.map(problemFor).filter(Boolean);
  for (const problem of problems) console.error(`✖ ${problem}`);
  if (problems.length === 0) console.log(`✔ ${names.length} CKAN pins are CKAN's own spelling`);
  process.exit(problems.length === 0 ? 0 : 1);
}
