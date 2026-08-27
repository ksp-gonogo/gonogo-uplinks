#!/usr/bin/env node
/**
 * Typecheck every Uplink client under `moduleResolution: nodenext` and hold the
 * error count against `nodenext-debt.mjs` as a ceiling.
 *
 * See that file for why both resolution modes have to be checked, and for what
 * the current debt is made of. The short version: the two modes disagree
 * silently, `declare module` bindings are what disagree, and every Uplink
 * declares its Topics through one.
 *
 * Usage:
 *   node scripts/check-nodenext.mjs                every Uplink
 *   node scripts/check-nodenext.mjs example        one of them
 *   node scripts/check-nodenext.mjs --update       rewrite the debt from this run
 */

import { spawnSync } from "node:child_process";
import { existsSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { NODENEXT_DEBT } from "./nodenext-debt.mjs";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
const DEBT_PATH = join(ROOT, "scripts", "nodenext-debt.mjs");

const args = process.argv.slice(2);
const update = args.includes("--update");
const only = args.find((arg) => !arg.startsWith("--"));

const legs = JSON.parse(
  spawnSync("node", [join(ROOT, "scripts/uplink-matrix.mjs")], {
    encoding: "utf8",
  }).stdout,
).filter((leg) => leg.client && (!only || leg.name === only));

/*
 * A filter that selects nothing runs the loop zero times and reports success,
 * which is this script's own failure mode rather than a hypothetical one.
 */
if (legs.length === 0) {
  console.error(
    only
      ? `✖ "${only}" matched no Uplink with a client, so nothing was checked.`
      : "✖ the matrix reported no Uplink with a client, so nothing was checked.",
  );
  process.exit(1);
}

const measured = {};
let exitCode = 0;

for (const leg of legs) {
  const clientDir = join(ROOT, "uplinks", leg.name, "client");
  const config = join(clientDir, "tsconfig.nodenext.json");
  if (!existsSync(config)) {
    console.error(
      `✖ ${leg.name}: no tsconfig.nodenext.json. Every client needs one, because the mode it does\n` +
        "  not check is the one that fails silently. Copy the example's.",
    );
    exitCode = 1;
    continue;
  }

  const tsc = spawnSync(
    "npx",
    ["tsc", "--noEmit", "-p", "tsconfig.nodenext.json"],
    { cwd: clientDir, encoding: "utf8", maxBuffer: 64 * 1024 * 1024 },
  );
  const output = `${tsc.stdout}${tsc.stderr}`;
  const errors = (output.match(/error TS\d+/g) ?? []).length;

  /*
   * A non-zero exit with nothing resembling a diagnostic means tsc failed to RUN
   * rather than failing to typecheck. Counting occurrences reads that as zero
   * errors, which is this check's pass condition.
   */
  if (tsc.status !== 0 && errors === 0) {
    console.error(
      `✖ ${leg.name}: tsc did not run. ${output.trim().split("\n").slice(-2).join(" ")}`,
    );
    exitCode = 1;
    continue;
  }

  measured[leg.name] = errors;
  const allowed = NODENEXT_DEBT[leg.name] ?? 0;

  if (errors > allowed) {
    console.log(`✖ ${leg.name}: ${errors} error(s) under nodenext, debt allows ${allowed}`);
    for (const line of output
      .split("\n")
      .filter((line) => /error TS/.test(line))
      .slice(0, 6)) {
      console.log(`    ${line.trim()}`);
    }
    exitCode = 1;
  } else if (errors < allowed) {
    console.log(
      `  ${leg.name}: ${errors} error(s), debt allows ${allowed}. Tighten with --update ${leg.name}.`,
    );
  } else {
    console.log(`✓ ${leg.name}: ${errors} error(s), at its ceiling of ${allowed}`);
  }
}

if (update) {
  const merged = { ...NODENEXT_DEBT, ...measured };
  for (const [name, count] of Object.entries(merged)) {
    if (count === 0) delete merged[name];
  }
  const header = readFileSync(DEBT_PATH, "utf8").split("export const NODENEXT_DEBT")[0];
  writeFileSync(
    DEBT_PATH,
    `${header}export const NODENEXT_DEBT = ${JSON.stringify(merged, null, 2)};\n`,
  );
  console.log(`\nRewrote ${DEBT_PATH} from this run.`);
  exitCode = 0;
}

process.exit(exitCode);
