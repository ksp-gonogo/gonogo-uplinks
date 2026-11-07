#!/usr/bin/env node
/**
 * Writes one Uplink leg's result as a machine-readable summary:
 *
 *   uplink-deps-summary.mjs <uplink> --code <n> --deps <deps.json> --work <dir> [--run-url <url>]
 *
 * `code` is the exit status of `uplink-tools deps` (0 up to date, 10 behind,
 * 2 a channel could not be read). The summary goes to `<work>/summary.json`, so
 * the leg's artifact carries it, and as a table to GITHUB_STEP_SUMMARY.
 */
import { appendFileSync, existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { join, resolve } from "node:path";
import { pathToFileURL } from "node:url";

const readJson = (file) => {
  try {
    return JSON.parse(readFileSync(file, "utf8"));
  } catch {
    return undefined;
  }
};

/** The summary of one leg, from the dependency report and what the bump run recorded. */
export function compose({ uplink, code, report, outcomes, runUrl }) {
  const watched = (report?.dependencies ?? []).filter((d) => !d.reportOnly);
  let dependencies;
  if (![0, 2, 10].includes(code)) {
    dependencies = [{ name: uplink, outcome: "error", reason: `the dependency read exited ${code}` }];
  } else if (code === 2) {
    dependencies = watched.map((d) => {
      const errors = (d.channels ?? []).map((c) => c.error).filter(Boolean);
      return errors.length > 0
        ? { name: d.name, from: d.pinned, outcome: "error", reason: errors.join("; ") }
        : { name: d.name, from: d.pinned, to: d.newest, outcome: d.state === "behind" ? "behind" : "up-to-date" };
    });
    if (dependencies.length === 0) {
      dependencies = [{ name: uplink, outcome: "error", reason: "the dependency report could not be read" }];
    }
  } else if (code === 0) {
    dependencies = watched.map((d) => ({ name: d.name, from: d.pinned, to: d.newest, outcome: "up-to-date" }));
  } else if (outcomes) {
    const bumped = new Map(outcomes.map((o) => [o.name, o]));
    dependencies = watched.map((d) =>
      bumped.get(d.name) ?? { name: d.name, from: d.pinned, to: d.newest, outcome: "up-to-date" },
    );
  } else {
    dependencies = watched
      .filter((d) => d.state === "behind")
      .map((d) => ({ name: d.name, from: d.pinned, to: d.newest, outcome: "error", reason: "the bump did not finish" }));
  }
  const worst = ["error", "red", "unverified", "green", "already-open", "behind"].find((o) =>
    dependencies.some((d) => d.outcome === o),
  );
  return {
    schema: "uplink-deps-summary/1",
    uplink,
    state: worst ?? "up-to-date",
    ...(runUrl ? { run: runUrl } : {}),
    dependencies,
  };
}

/** The summary as a markdown table for the job's summary page. */
export function markdown(summary) {
  const rows = summary.dependencies.map(
    (d) =>
      `| ${d.name} | ${d.from ?? "-"} | ${d.to ?? "-"} | ${d.outcome} | ${[d.reason, d.url].filter(Boolean).join(" ")} |`,
  );
  return [
    `### ${summary.uplink}: ${summary.state}`,
    "",
    "| Dependency | Pinned | Newest | Outcome | Detail |",
    "|---|---|---|---|---|",
    ...(rows.length > 0 ? rows : ["| none | | | up-to-date | |"]),
    "",
  ].join("\n");
}

function flag(argv, name) {
  const at = argv.indexOf(name);
  return at === -1 ? undefined : argv[at + 1];
}

export function main(argv) {
  const uplink = argv[0];
  const work = flag(argv, "--work");
  const code = Number(flag(argv, "--code"));
  if (!uplink || !work || Number.isNaN(code)) {
    console.error("usage: uplink-deps-summary.mjs <uplink> --code <n> --deps <deps.json> --work <dir> [--run-url <url>]");
    return 2;
  }
  const deps = flag(argv, "--deps");
  const outcomesFile = join(resolve(work), "outcomes.json");
  const summary = compose({
    uplink,
    code,
    report: deps && existsSync(deps) ? readJson(deps) : undefined,
    outcomes: existsSync(outcomesFile) ? readJson(outcomesFile)?.outcomes : undefined,
    runUrl: flag(argv, "--run-url"),
  });
  mkdirSync(resolve(work), { recursive: true });
  writeFileSync(join(resolve(work), "summary.json"), `${JSON.stringify(summary, null, 2)}\n`);
  if (process.env.GITHUB_STEP_SUMMARY) appendFileSync(process.env.GITHUB_STEP_SUMMARY, markdown(summary));
  console.log(markdown(summary));
  return 0;
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  process.exit(main(process.argv.slice(2)));
}
