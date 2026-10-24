#!/usr/bin/env node
/**
 * What `prepare-release.yml` is about to release, and the refusals that come
 * before anything is built.
 *
 *   release-plan.mjs plan --uplinks <ids|all> --bump <kind> [--version V] [--full true|false] [--github]
 *   release-plan.mjs subject < versions.json     ([{ "id", "version" }])
 *
 * `plan` turns the dispatch inputs into the matrix of Uplinks to prepare and the
 * arguments `uplink-tools release prepare` takes. It refuses an id that names no
 * Uplink, an Uplink that cannot be released (a release publishes a client and
 * the plugin that vouches for it, so it needs both), a version that disagrees
 * with `full`, and a set whose Uplinks are pinned to different contract Majors,
 * naming the odd one out: a contract Major needs its re-pin landed first, and a
 * release that covered half of it would ship Uplinks the app refuses.
 */
import { spawnSync } from "node:child_process";
import { existsSync, readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
const BUMPS = ["auto", "rc", "patch", "minor", "major"];
const VERSION = /^\d+\.\d+\.\d+(?:-rc\.\d+)?$/;

/** The arguments `release prepare` is given for every selected Uplink. */
export function prepareArgs({ bump, version, full }) {
  if (version) {
    if (!VERSION.test(version)) {
      throw new Error(`${version} is not a version: X.Y.Z or X.Y.Z-rc.N`);
    }
    const candidate = version.includes("-rc.");
    if (full === candidate) {
      throw new Error(
        full
          ? `full is set, and ${version} is a candidate`
          : `full is not set, and ${version} is a full release. Set full, or give a candidate.`,
      );
    }
    return ["--version", version];
  }
  if (!BUMPS.includes(bump)) {
    throw new Error(`bump is ${BUMPS.join(", ")}, and "${bump}" is none of them`);
  }
  return ["--bump", bump, ...(full ? [] : ["--rc"])];
}

/**
 * The legs to prepare. `legs` is `uplink-matrix.mjs`'s output, and `contractMajorOf`
 * answers for one leg what contract Major its manifest is pinned to.
 */
export function planLegs(legs, requested, contractMajorOf) {
  const releasable = (leg) => leg.client && leg.mod_csproj;
  let chosen;
  if (requested.length === 1 && requested[0] === "all") {
    chosen = legs.filter(releasable);
  } else {
    chosen = requested.map((name) => {
      const leg = legs.find((l) => l.id === name || l.name === name);
      if (!leg) throw new Error(`no Uplink under uplinks/ is called ${name}`);
      if (!releasable(leg)) {
        throw new Error(
          `${leg.name} has ${leg.client ? "no mod project" : "no client"}. A release publishes a client bundle and the plugin that vouches for its hash, so it needs both halves.`,
        );
      }
      return leg;
    });
  }
  if (chosen.length === 0) throw new Error("no Uplink was chosen to release");
  chosen = [...new Map(chosen.map((leg) => [leg.id, leg])).values()].sort((a, b) =>
    a.id.localeCompare(b.id),
  );
  const majors = new Map(chosen.map((leg) => [leg.id, contractMajorOf(leg)]));
  const counts = new Map();
  for (const major of majors.values()) counts.set(major, (counts.get(major) ?? 0) + 1);
  if (counts.size > 1) {
    const common = [...counts.entries()].sort((a, b) => b[1] - a[1])[0][0];
    const odd = [...majors.entries()].filter(([, major]) => major !== common);
    throw new Error(
      `these Uplinks are pinned to different contract Majors: ${odd.map(([id, m]) => `${id} to ${m}`).join(", ")}, where the rest are on ${common}. Land the re-pin for all of them on staging first, or release them in separate runs.`,
    );
  }
  return chosen;
}

/** The release commit's subject, at most 100 characters. */
export function releaseSubject(released) {
  const sorted = [...released].sort((a, b) => a.id.localeCompare(b.id));
  if (sorted.length === 1) return `release: ${sorted[0].id} v${sorted[0].version}`;
  const versions = new Set(sorted.map((r) => r.version));
  const shared = `release: ${sorted.length} uplinks to ${[...versions][0]}`;
  if (versions.size === 1) return shared;
  const listed = `release: ${sorted.map((r) => `${r.id} v${r.version}`).join(", ")}`;
  return listed.length <= 100 ? listed : `release: ${sorted.length} uplinks`;
}

function contractMajorFromDisk(leg) {
  const file = join(ROOT, "uplinks", leg.name, "client", "gonogo-uplink.json");
  if (!existsSync(file)) {
    throw new Error(`${file} does not exist, so ${leg.id}'s contract Major is unknown`);
  }
  return JSON.parse(readFileSync(file, "utf8")).contractMajor;
}

function main(argv) {
  const [command, ...rest] = argv;
  const flag = (name, fallback) => {
    const at = rest.indexOf(name);
    return at < 0 ? fallback : rest[at + 1];
  };
  if (command === "subject") {
    const released = JSON.parse(readFileSync(0, "utf8"));
    console.log(releaseSubject(released));
    return;
  }
  if (command !== "plan") {
    console.error("usage: release-plan.mjs plan|subject ...");
    process.exit(2);
  }
  const ran = spawnSync("node", [join(ROOT, "scripts", "uplink-matrix.mjs")], {
    encoding: "utf8",
  });
  if (ran.status !== 0) {
    process.stderr.write(ran.stderr);
    process.exit(1);
  }
  const requested = (flag("--uplinks", "") ?? "")
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean);
  const args = prepareArgs({
    bump: flag("--bump", "auto"),
    version: flag("--version", ""),
    full: flag("--full", "false") === "true",
  });
  const legs = planLegs(JSON.parse(ran.stdout), requested, contractMajorFromDisk);
  const matrix = JSON.stringify({ include: legs });
  if (rest.includes("--github")) {
    console.log(`matrix=${matrix}`);
    console.log(`args=${args.join(" ")}`);
    console.log(`ids=${legs.map((l) => l.id).join(",")}`);
  } else {
    console.log(JSON.stringify({ args, uplinks: legs.map((l) => l.id) }, null, 2));
  }
}

try {
  if (process.argv[1] === fileURLToPath(import.meta.url)) main(process.argv.slice(2));
} catch (err) {
  console.error(`✖ ${err.message}`);
  process.exit(1);
}
