#!/usr/bin/env node
/**
 * The wiring walk is VENDORED, and this is what stops the copy drifting.
 *
 * `tooling/wiring/UplinkWiringScan.cs` is `gonogo`'s
 * `mod/Sitrep.Core.Tests/UplinkWiringScan.cs`, with exactly one line changed:
 * the namespace. Two hand-maintained walks are two chances for one of them to
 * stop matching `host.AddCommandHandler`, and a walk that matches nothing
 * reports a clean repo, so a fork here would go quietly green while the Uplinks
 * it covers broke.
 *
 * ## What this can and cannot see
 *
 * It hashes the local file with the namespace line normalised back, and compares
 * against `tooling/wiring/UPSTREAM.json`. So it catches a hand-edit HERE, which
 * is the drift a reviewer would otherwise have to spot by eye.
 *
 * It cannot see upstream moving: the repos do not know about each other, and a
 * check that reached across would need a path to a checkout a CI runner does not
 * have. That gap is closed by a person running `--from`, which re-syncs and
 * rewrites the pin, and by the pin naming the upstream path so the next reader
 * knows where to look. Say so rather than implying more.
 *
 * Usage:
 *   node tooling/check-wiring-walk.mjs                 verify the pin
 *   node tooling/check-wiring-walk.mjs --from <gonogo>  re-sync from a checkout
 */

import { createHash } from "node:crypto";
import { readFileSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
const LOCAL = join(ROOT, "tooling", "wiring", "UplinkWiringScan.cs");
const PIN = join(ROOT, "tooling", "wiring", "UPSTREAM.json");

/** The one line the vendored copy is allowed to differ by, and what it reads upstream. */
const LOCAL_NAMESPACE = "namespace Gonogo.UplinkWiring";
const UPSTREAM_NAMESPACE = "namespace Sitrep.Core.Tests";

const sha256 = (text) => createHash("sha256").update(text, "utf8").digest("hex");

/**
 * The local file as it reads upstream. Anchored to the start of a line and
 * applied once: a walk whose namespace line has been deleted rather than
 * rewritten would otherwise hash as if it were still there.
 */
const asUpstream = (text) => {
  const lines = text.split("\n");
  const at = lines.indexOf(LOCAL_NAMESPACE);
  if (at < 0) {
    throw new Error(
      `${LOCAL} does not declare \`${LOCAL_NAMESPACE}\` on a line of its own. The vendored ` +
        "walk is allowed to differ from upstream by that one line and nothing else, so this " +
        "check cannot tell whether the rest of the file still matches.",
    );
  }
  lines[at] = UPSTREAM_NAMESPACE;
  return lines.join("\n");
};

const pin = JSON.parse(readFileSync(PIN, "utf8"));
const from = process.argv.indexOf("--from");

if (from >= 0) {
  const gonogo = process.argv[from + 1];
  if (!gonogo) {
    console.error("--from needs the path to a gonogo checkout");
    process.exit(2);
  }

  const source = join(gonogo, pin.path);
  const text = readFileSync(source, "utf8");
  writeFileSync(LOCAL, text.split("\n").map((l) => (l === UPSTREAM_NAMESPACE ? LOCAL_NAMESPACE : l)).join("\n"));
  writeFileSync(PIN, `${JSON.stringify({ ...pin, sha256: sha256(text) }, null, 2)}\n`);
  console.log(`synced ${pin.path} from ${gonogo}\n  sha256 ${sha256(text)}`);
  process.exit(0);
}

const actual = sha256(asUpstream(readFileSync(LOCAL, "utf8")));

if (actual !== pin.sha256) {
  console.error(
    `The vendored wiring walk no longer matches its pin.\n` +
      `  file     tooling/wiring/UplinkWiringScan.cs\n` +
      `  pinned   ${pin.sha256}\n` +
      `  actual   ${actual}\n\n` +
      `It is a verbatim copy of ${pin.path} in ${pin.repo}, differing only in its namespace ` +
      `line. Editing the copy forks the walk: the two repos then run different gates that agree ` +
      `until one of them stops matching a registration shape, and a walk that matches nothing ` +
      `reports a clean repo.\n\n` +
      `Change it upstream, then re-sync:\n` +
      `  node tooling/check-wiring-walk.mjs --from ../gonogo`,
  );
  process.exit(1);
}

console.log(`wiring walk matches its pin (${pin.sha256.slice(0, 12)}), from ${pin.repo}:${pin.path}`);
