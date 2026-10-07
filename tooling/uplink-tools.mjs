#!/usr/bin/env node
/**
 * Runs the published `uplink-tools` command for one Uplink in this repo:
 *
 *   node tooling/uplink-tools.mjs <uplink-dir-name> <command> [options]
 *
 * Every step of an Uplink's build here is a command an outside author has too:
 * `codegen`, `bundle`, `bake`, `package`, `release`, `page`. This file adds
 * nothing to them. It only answers the one question a repo of many Uplinks has
 * and a lone Uplink does not: which install of the tools to run.
 *
 * The Uplink's own client install is used when it has one, so the tools are the
 * version that client is pinned to. An Uplink with no client half has no
 * install, and neither does a fresh checkout that is building C# before any
 * `npm ci`, so the fallback runs the vendored tarballs through `npm exec`,
 * which installs nothing into the tree.
 *
 * The command runs in the Uplink's `client/` directory when there is one, and
 * in the Uplink's own directory otherwise. Each command finds `uplink.json` by
 * walking up from there.
 */
import { spawnSync } from "node:child_process";
import { existsSync, readdirSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
const [name, ...args] = process.argv.slice(2);
if (!name || args.length === 0) {
  console.error("usage: uplink-tools.mjs <uplink-dir-name> <command> [options]");
  process.exit(2);
}

const uplinkDir = join(ROOT, "uplinks", name);
if (!existsSync(join(uplinkDir, "uplink.json"))) {
  console.error(`✖ uplinks/${name} holds no uplink.json, so it is not an Uplink`);
  process.exit(2);
}
const clientDir = join(uplinkDir, "client");
const cwd = existsSync(clientDir) ? clientDir : uplinkDir;

const installed = join(
  clientDir,
  "node_modules/@ksp-gonogo/uplink-tools/bin/uplink-tools.mjs",
);

/** The one vendored tarball of a package, by the stem its content-addressed name starts with. */
function vendored(stem) {
  const found = readdirSync(join(ROOT, "vendor")).filter(
    (file) => file.startsWith(`${stem}-`) && file.endsWith(".tgz"),
  );
  if (found.length !== 1) {
    console.error(
      `✖ expected exactly one vendor/${stem}-*.tgz, found ${found.length}. ` +
        "scripts/check-vendor-pins.mjs says what is wrong with the vendored set.",
    );
    process.exit(1);
  }
  return join(ROOT, "vendor", found[0]);
}

const result = existsSync(installed)
  ? spawnSync(process.execPath, [installed, ...args], { cwd, stdio: "inherit" })
  : spawnSync(
      "npm",
      [
        "exec",
        "--yes",
        `--package=${vendored("ksp-gonogo-uplink-tools")}`,
        // The tools import the sdk, and a tarball's pin on its sibling is a version npm cannot find, so the sibling is named too.
        `--package=${vendored("ksp-gonogo-sitrep-sdk")}`,
        "--",
        "uplink-tools",
        ...args,
      ],
      { cwd, stdio: "inherit", shell: process.platform === "win32" },
    );
if (result.error) {
  console.error(`✖ could not run uplink-tools: ${result.error.message}`);
  process.exit(1);
}
process.exit(result.status ?? 1);
