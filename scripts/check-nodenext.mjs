#!/usr/bin/env node
/**
 * Typecheck every Uplink client under `moduleResolution: nodenext`. Zero errors,
 * everywhere, red or green.
 *
 * ## Why the mode is checked at all
 *
 * The two resolutions disagree SILENTLY, which is what makes this worth a gate
 * rather than a note. `declare module "./types"` binds under `bundler` and does
 * NOT bind under `nodenext`, so a declaration merge vanishes and every key it
 * contributed goes with it. That shipped in the sdk once and emptied
 * `ContributionRegistry`. Every Uplink here declares its own Topics through the
 * same mechanism (`declare module "@ksp-gonogo/sitrep-sdk"` extending
 * `TopicPayloadMap`), so an Uplink is exposed to the identical failure and a
 * `bundler`-only typecheck cannot see it.
 *
 * An author choosing `nodenext` is not doing anything exotic. It is the default
 * a modern Node package reaches for.
 *
 * ## There is no debt list, and there is not going to be one
 *
 * This was a ceiling per Uplink for a while, seeded when five clients arrived
 * carrying hundreds of errors between them. Every one of those was a mechanical
 * fault of the same three kinds: a relative import with no extension (and the
 * cascade of `any` that follows an unresolved specifier), a default import of a
 * package that publishes no `exports` map, and a fixture whose shape had drifted
 * from the type it claimed. None of them was a disagreement anyone had decided
 * to live with, and a ceiling made a number to manage out of what was really a
 * morning's work.
 *
 * A count this gate cannot see is what a ceiling was always going to hide: tsc
 * raises TS2834/TS2835 only for an import that BINDS something, so an
 * unresolvable SIDE-EFFECT import (`import "./topics";`) passes a clean
 * typecheck and vanishes at runtime instead. One client sat at zero here with
 * thirteen of those still in it. So a green run means the errors are gone, not
 * that the imports are right.
 *
 * Usage:
 *   node scripts/check-nodenext.mjs                every Uplink
 *   node scripts/check-nodenext.mjs example        one of them
 */

import { spawnSync } from "node:child_process";
import { existsSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");

const only = process.argv.slice(2).find((arg) => !arg.startsWith("--"));

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

  if (errors > 0) {
    console.log(`✖ ${leg.name}: ${errors} error(s) under nodenext`);
    for (const line of output
      .split("\n")
      .filter((line) => /error TS/.test(line))
      .slice(0, 6)) {
      console.log(`    ${line.trim()}`);
    }
    exitCode = 1;
  } else {
    console.log(`✓ ${leg.name}`);
  }
}

process.exit(exitCode);
