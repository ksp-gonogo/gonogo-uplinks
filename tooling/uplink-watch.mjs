#!/usr/bin/env node
/**
 * Rebuilds one Uplink's client bundle on every save: `pnpm uplink:watch <name>`.
 *
 * Runs the CLIENT'S OWN copy of `gonogo-uplink bundle --watch`, the one its
 * pinned sdk ships, so the bundle it writes is the one that client's release
 * build would write and an author outside this repository runs the same command.
 * Serve the result to a running app from a gonogo checkout with
 * `pnpm dev --uplink <path to uplinks/<name>>`.
 *
 * Usage: uplink-watch.mjs <name>
 */

import { spawn } from "node:child_process";
import { existsSync, readdirSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");

/** The Uplinks that have a client to build, by directory name. */
export function watchableUplinks(root = ROOT) {
  const dir = join(root, "uplinks");
  if (!existsSync(dir)) return [];
  return readdirSync(dir)
    .filter((name) => existsSync(join(dir, name, "client", "package.json")))
    .sort();
}

/**
 * The command that watches `name`'s client, or the reason it cannot be run.
 *
 * @returns {{ command: string, args: string[], cwd: string } | { error: string }}
 */
export function resolveWatch(name, root = ROOT) {
  const known = watchableUplinks(root);
  if (!name || !known.includes(name)) {
    return {
      error: `${name ? `no Uplink named ${name}` : "name an Uplink"}. Uplinks with a client: ${known.join(", ")}`,
    };
  }
  const client = join(root, "uplinks", name, "client");
  const cli = join(
    client,
    "node_modules/@ksp-gonogo/sitrep-sdk/bin/gonogo-uplink.mjs",
  );
  if (!existsSync(cli)) {
    return {
      error: `${name}'s client has no installed sdk. Run \`npm ci\` in uplinks/${name}/client first`,
    };
  }
  return {
    command: process.execPath,
    args: [cli, "bundle", "--watch", "--client", client],
    cwd: client,
  };
}

if (import.meta.url === pathToFileURL(process.argv[1] ?? "").href) {
  const resolved = resolveWatch(process.argv[2]);
  if ("error" in resolved) {
    console.error(resolved.error);
    process.exit(2);
  }
  const child = spawn(resolved.command, resolved.args, {
    cwd: resolved.cwd,
    stdio: "inherit",
  });
  for (const signal of ["SIGINT", "SIGTERM"]) {
    process.on(signal, () => child.kill(signal));
  }
  child.on("exit", (code) => process.exit(code ?? 0));
}
