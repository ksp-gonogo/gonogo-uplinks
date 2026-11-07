#!/usr/bin/env node
/**
 * One Uplink's dependency watch, run by `uplink-deps.yml`:
 *
 *   uplink-deps.mjs <uplink-dir-name> --gamedata <dir> --work <dir> [--managed <dir>]
 *
 * `uplink-tools deps` reads what is behind; this decides what to do about it,
 * which is repository policy and not something an Uplink author's tool should
 * know: a branch, a commit, a pull request or an issue per dependency version,
 * and no second one for a version that already has one. It exits 0 when nothing
 * is behind, 2 when a channel could not be read (an outage is a red leg, never
 * a quiet one), and 1 when it could not carry a bump through.
 *
 * Environment: GH_TOKEN for `gh`, KSP_MANAGED_TOKEN to push the reference set,
 * and the Actions variables GITHUB_SERVER_URL, GITHUB_REPOSITORY, GITHUB_RUN_ID.
 */
import { spawnSync } from "node:child_process";
import {
  cpSync,
  existsSync,
  mkdirSync,
  mkdtempSync,
  readdirSync,
  readFileSync,
  statSync,
  writeFileSync,
} from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join, relative, resolve } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import { describeMoves, diffInterface, parseDeclarations, usedBy } from "./principia-proto.mjs";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");

export const WATCH_LABEL = "uplink-deps";
export const IN_GAME_LABEL = "needs-in-game-test";

/**
 * Mods whose interface is readable from a public file at the release tag, for
 * the ones that ship no binary the checks can load. The vetted copy is
 * committed in the Uplink and moves with every bump that does not break it.
 */
export const PROTO_WATCH = {
  principia: {
    repo: "mockingbirdnest/Principia",
    path: "serialization/journal.proto",
    vetted: "journal.proto",
    sources: "mod",
  },
};

const MARKER = /<!-- uplink-deps: ([^/\s]+)\/(.+?):(\S+) -->/;

export const slug = (text) =>
  text
    .toLowerCase()
    .replace(/[^a-z0-9.]+/g, "-")
    .replace(/^-+|-+$/g, "");

/** What names one dependency at one version: the same string every run, so a second run recognises the first. */
export const keyOf = (uplink, dependency, version) => `${uplink}/${dependency}:${version}`;

export const markerOf = (key) => `<!-- uplink-deps: ${key} -->`;

export const branchOf = (uplink, dependency, version) =>
  `deps/${uplink}/${slug(dependency)}-${slug(version)}`;

/** The key an open pull request or issue carries in its body, or undefined. */
export function keyIn(item) {
  const match = MARKER.exec(item.body ?? "");
  return match ? { uplink: match[1], dependency: match[2], version: match[3] } : undefined;
}

/** Open items that already carry exactly this dependency version. */
export const existingFor = (items, key) =>
  items.filter((item) => {
    const found = keyIn(item);
    return found && keyOf(found.uplink, found.dependency, found.version) === key;
  });

function olderThan(a, b) {
  const x = a.split(/[.-]/).map((part) => (/^\d+$/.test(part) ? Number(part) : part));
  const y = b.split(/[.-]/).map((part) => (/^\d+$/.test(part) ? Number(part) : part));
  for (let i = 0; i < Math.max(x.length, y.length); i++) {
    if (x[i] === y[i]) continue;
    if (x[i] === undefined) return true;
    if (y[i] === undefined) return false;
    if (typeof x[i] === "number" && typeof y[i] === "number") return x[i] < y[i];
    return String(x[i]) < String(y[i]);
  }
  return false;
}

/** Open items for the same dependency at an older version, which the new one replaces. */
export const supersededBy = (items, uplink, dependency, version) =>
  items.filter((item) => {
    const found = keyIn(item);
    return (
      found &&
      found.uplink === uplink &&
      found.dependency === dependency &&
      olderThan(found.version, version)
    );
  });

const FOOTER =
  "Types and tests passed; behaviour is not checked. Load order, patches and play against the game are not attempted, so a change in how the mod behaves stays an in-game test.";

const fence = (text) => `\`\`\`\n${String(text).replace(/```/g, "'''")}\n\`\`\``;

const checksTable = (checks) =>
  [
    "| Check | Result |",
    "|---|---|",
    ...checks.map((c) => `| ${c.name} | ${c.status} |`),
  ].join("\n");

const changedList = (changed) =>
  changed.length === 0 ? "none" : changed.map((file) => `\`${file}\``).join(", ");

export const prTitle = (uplink, dependency, version) =>
  `chore(${uplink}): build against ${dependency} ${version}`;

/** The pull request body for a green or unverified bump. */
export function prBody({ result, dependency, version, key, managed }) {
  const lines = [
    `Moves ${result.bumps.map((b) => `**${b.name}** from \`${b.from ?? "-"}\` to \`${b.to}\``).join(", ")} in the ${result.uplink} Uplink.`,
    "",
    "| Dependency | From | To | Binds | Ran against the new version |",
    "|---|---|---|---|---|",
    ...result.bumps.map(
      (b) =>
        `| ${b.name} | \`${b.from ?? "-"}\` | \`${b.to}\` | ${b.binds} | ${result.exercised[b.name] ?? "nothing"} |`,
    ),
    "",
    checksTable(result.checks),
    "",
    `Files changed: ${changedList(result.changed)}`,
  ];
  for (const bump of result.bumps) {
    if (bump.ckanMinVersion) {
      lines.push(`CKAN \`min_version\` for ${bump.name}: \`${bump.ckanMinVersion}\``);
    }
    if (bump.url) lines.push(`Release: ${bump.url}`);
  }
  for (const [name, note] of Object.entries(result.reference ?? {})) {
    lines.push(`Reference for ${name}: ${note}`);
  }
  if (managed) lines.push(`Reference set: ${managed}`);
  lines.push("");
  if (result.verdict === "unverified") {
    lines.push(
      `Nothing in CI ran against ${dependency} ${version}; the Uplink reaches it by reflection.`,
      "",
    );
  }
  lines.push(FOOTER, "", markerOf(key));
  return lines.join("\n");
}

export const issueTitle = (uplinkName, dependency, version) =>
  `${uplinkName} Uplink: fails its checks against ${dependency} ${version}`;

/** The issue body for a red bump: what broke in the Uplink, and nothing addressed to anyone else. */
export function issueBody({ result, dependency, version, key, branch, runUrl }) {
  const failing = result.checks.filter((c) => c.status === "fail");
  const lines = [
    `The ${result.uplink} Uplink fails ${failing.length === 1 ? "a check" : "its checks"} when it is built against ${dependency} ${version}.`,
    "",
    ...failing.flatMap((c) => [`### ${c.name}`, "", fence(c.excerpt ?? "no output"), ""]),
    `Files the bump changed: ${changedList(result.changed)}`,
    `Branch: \`${branch}\``,
  ];
  if (runUrl) lines.push(`Logs: ${runUrl}`);
  lines.push("", markerOf(key));
  return lines.join("\n");
}

/** Whether text carries an `@` outside a fenced block, where it would notify someone. */
export function mentionsOutsideFences(text) {
  return text
    .split(/```[\s\S]*?```/)
    .join("")
    .replace(/`[^`]*`/g, "")
    .includes("@");
}

/**
 * Puts one check's outcome into a bump result, replacing the entry of that name,
 * and turns the verdict red when it failed. A check that passes never changes a
 * verdict the bump already reached.
 */
export function applyCheck(result, check) {
  const at = result.checks.findIndex((c) => c.name === check.name);
  if (at === -1) result.checks.push(check);
  else result.checks[at] = check;
  if (check.status === "fail") result.verdict = "red";
  return result;
}

/** The one line a run summary gives for why a red bump is red. */
export function reasonOf(result) {
  const failing = result.checks.find((c) => c.status === "fail");
  if (!failing) return "a check failed";
  const lines = String(failing.excerpt ?? "").split("\n").filter((line) => line.trim() !== "");
  const error = lines.find((line) => /^error /.test(line)) ?? lines[0];
  return `${failing.name}: ${error ?? "failed"}`;
}

function sh(command, args, { cwd = ROOT, env, allowFail = false } = {}) {
  const ran = spawnSync(command, args, {
    cwd,
    env: { ...process.env, ...env },
    encoding: "utf8",
    maxBuffer: 64 * 1024 * 1024,
  });
  if (ran.status !== 0 && !allowFail) {
    throw new Error(
      `${command} ${args.join(" ")} exited ${ran.status}\n${ran.stdout}${ran.stderr}`,
    );
  }
  return { status: ran.status ?? 1, out: ran.stdout ?? "", err: ran.stderr ?? "" };
}

const ghJson = (args) => JSON.parse(sh("gh", args).out || "[]");

function openItems() {
  const fields = "number,title,body";
  const common = ["--label", WATCH_LABEL, "--state", "open", "--limit", "200", "--json", fields];
  return {
    prs: ghJson(["pr", "list", ...common]),
    issues: ghJson(["issue", "list", ...common]),
  };
}

function* dllsUnder(dir) {
  for (const entry of readdirSync(dir)) {
    const path = join(dir, entry);
    if (statSync(path).isDirectory()) yield* dllsUnder(path);
    else if (entry.endsWith(".dll")) yield path;
  }
}

/** Commits the new release's assemblies to a branch of the private reference set and returns the sha, or why it could not. */
function commitReference({ managed, referenceOut, branch, subject }) {
  if (!managed || !existsSync(referenceOut)) return { note: "no assemblies to commit" };
  const dlls = [...dllsUnder(referenceOut)];
  if (dlls.length === 0) return { note: "the release ships no assemblies" };
  for (const dll of dlls) {
    const target = join(managed, "GameData", relative(referenceOut, dll));
    mkdirSync(dirname(target), { recursive: true });
    cpSync(dll, target);
  }
  sh("git", ["config", "user.name", "github-actions[bot]"], { cwd: managed });
  sh("git", ["config", "user.email", "41898282+github-actions[bot]@users.noreply.github.com"], {
    cwd: managed,
  });
  sh("git", ["checkout", "-B", branch], { cwd: managed });
  sh("git", ["add", "-A", "GameData"], { cwd: managed });
  if (sh("git", ["diff", "--cached", "--quiet"], { cwd: managed, allowFail: true }).status === 0) {
    return { note: "the reference set already holds these assemblies" };
  }
  sh("git", ["commit", "-q", "-m", subject], { cwd: managed });
  const token = process.env.KSP_MANAGED_TOKEN;
  if (!token) throw new Error("KSP_MANAGED_TOKEN is not set, so the reference set cannot be pushed");
  sh("git", [
    "push",
    "--force",
    `https://x-access-token:${token}@github.com/ksp-gonogo/ksp-managed.git`,
    `HEAD:refs/heads/${branch}`,
  ], { cwd: managed });
  const sha = sh("git", ["rev-parse", "HEAD"], { cwd: managed }).out.trim();
  return { note: `ksp-managed ${sha} on branch ${branch}` };
}

function flag(argv, name) {
  const at = argv.indexOf(name);
  return at === -1 ? undefined : argv[at + 1];
}

/**
 * `uplink-tools check` as a normal build runs it: the client is bundled and the
 * bundle baked first, because `bake/stale` compares the baked hash with the
 * client as it builds now and a fresh checkout has none.
 */
export function rebakeAndCheck(name) {
  const tools = ["tooling/uplink-tools.mjs", name];
  const hasClient = existsSync(join(ROOT, "uplinks", name, "client", "package.json"));
  const modDir = join(ROOT, "uplinks", name, "mod");
  const hasMod = existsSync(modDir) && readdirSync(modDir).some((f) => f.endsWith(".csproj"));
  if (hasClient && hasMod) {
    const out = mkdtempSync(join(tmpdir(), "uplink-deps-bundle-"));
    const bundled = sh("node", [...tools, "bundle", "--out", out], { allowFail: true });
    const file = bundled.status === 0 ? findClientBundle(out) : undefined;
    if (!file) {
      return {
        name: "check",
        status: "fail",
        excerpt: `the client did not bundle\n${bundled.out}${bundled.err}`.trimEnd().split("\n").slice(-15).join("\n"),
      };
    }
    const baked = sh("node", [...tools, "bake", "--bundle", file], { allowFail: true });
    if (baked.status !== 0) {
      return {
        name: "check",
        status: "fail",
        excerpt: `bake failed\n${baked.out}${baked.err}`.trimEnd().split("\n").slice(-15).join("\n"),
      };
    }
  }
  const ran = sh("node", [...tools, "check"], { allowFail: true });
  return ran.status === 0
    ? { name: "check", status: "pass" }
    : {
        name: "check",
        status: "fail",
        excerpt: `${ran.out}${ran.err}`.trimEnd().split("\n").slice(-15).join("\n"),
      };
}

function findClientBundle(dir) {
  for (const entry of readdirSync(dir)) {
    const path = join(dir, entry);
    if (statSync(path).isDirectory()) {
      const found = findClientBundle(path);
      if (found) return found;
    } else if (entry.endsWith(".client.js")) return path;
  }
  return undefined;
}

/**
 * Diffs the interface a mod publishes at the new release against the copy
 * vetted for the pinned one. A name that cannot be read is an error, never a
 * red: an outage says nothing about the mod.
 */
export async function interfaceCheck({ name, watch, report, dep, fetchText = fetchRaw }) {
  const uplinkDir = join(ROOT, "uplinks", name);
  const vettedFile = join(uplinkDir, watch.vetted);
  if (!existsSync(vettedFile)) throw new Error(`${watch.vetted} is not committed for ${name}, so there is nothing to diff against`);
  const vetted = readFileSync(vettedFile, "utf8");
  const proto = await fetchText(`https://raw.githubusercontent.com/${watch.repo}/${dep.newest}/${watch.path}`);
  const used = usedBy(parseDeclarations(vetted).keys(), join(uplinkDir, watch.sources));
  const moves = diffInterface(vetted, proto, used);
  const sentence = describeMoves(moves, dep.pinned, dep.newest);
  return {
    proto,
    check: sentence
      ? {
          name: "interface",
          status: "fail",
          excerpt: [
            sentence,
            `Gone: ${moves.removed.join(", ") || "none"}`,
            `Different shape: ${moves.changed.join(", ") || "none"}`,
            `New in the release: ${moves.added.join(", ") || "none"}`,
          ].join("\n"),
        }
      : { name: "interface", status: "pass" },
  };
}

async function fetchRaw(url) {
  const headers = process.env.GH_TOKEN ? { Authorization: `Bearer ${process.env.GH_TOKEN}` } : {};
  const response = await fetch(url, { headers });
  if (!response.ok) throw new Error(`${url} answered ${response.status}`);
  return response.text();
}

export async function main(argv) {
  const name = argv[0];
  const gamedata = flag(argv, "--gamedata");
  const work = resolve(flag(argv, "--work") ?? join(ROOT, ".deps-work"));
  const managed = flag(argv, "--managed");
  if (!name) {
    console.error("usage: uplink-deps.mjs <uplink-dir-name> --gamedata <dir> --work <dir> [--managed <dir>]");
    return 1;
  }
  const tools = ["tooling/uplink-tools.mjs", name];

  const read = sh("node", [...tools, "deps", "--json"], { allowFail: true });
  if (read.status === 0) {
    console.log(`${name}: nothing is behind`);
    return 0;
  }
  if (read.status !== 10) {
    console.error(`::error title=${name} dependency read failed::${read.out}${read.err}`);
    return 2;
  }
  const report = JSON.parse(read.out);
  const behind = report.dependencies.filter((d) => d.state === "behind" && !d.reportOnly);
  const uplinkName =
    JSON.parse(readFileSync(join(ROOT, "uplinks", name, "uplink.json"), "utf8")).name ?? name;

  for (const label of [WATCH_LABEL, IN_GAME_LABEL]) {
    sh("gh", ["label", "create", label, "--force", "--color", label === WATCH_LABEL ? "0e8a16" : "d93f0b"], {
      allowFail: true,
    });
  }
  const runUrl = process.env.GITHUB_RUN_ID
    ? `${process.env.GITHUB_SERVER_URL}/${process.env.GITHUB_REPOSITORY}/actions/runs/${process.env.GITHUB_RUN_ID}`
    : "";
  let failed = false;
  const outcomes = [];
  const record = (dep, outcome, extra = {}) =>
    outcomes.push({ name: dep.name, from: dep.pinned, to: dep.newest, outcome, ...extra });
  mkdirSync(work, { recursive: true });
  const writeOutcomes = () =>
    writeFileSync(join(work, "outcomes.json"), `${JSON.stringify({ uplink: name, outcomes }, null, 2)}\n`);

  try {
    for (const dep of behind) {
      const key = keyOf(report.uplink, dep.name, dep.newest);
      const { prs, issues } = openItems();
      if (existingFor([...prs, ...issues], key).length > 0) {
        console.log(`${key}: already has an open pull request or issue`);
        record(dep, "already-open");
        continue;
      }
      const branch = branchOf(report.uplink, dep.name, dep.newest);
      const dir = join(work, slug(dep.name));
      mkdirSync(dir, { recursive: true });
      const resultFile = join(dir, "result.json");
      const referenceOut = join(dir, "reference");

      sh("git", ["fetch", "origin", "staging"]);
      sh("git", ["checkout", "-f", "-B", branch, "origin/staging"]);
      sh("git", ["clean", "-fdq", "--", `uplinks/${name}`]);
      const args = [
        ...tools,
        "deps",
        "bump",
        dep.name,
        "--result",
        resultFile,
        "--reference-out",
        referenceOut,
        "--skip",
        "check",
      ];
      if (gamedata) args.push("--gamedata", resolve(gamedata));
      const bumped = sh("node", args, { allowFail: true });
      console.log(bumped.out + bumped.err);
      if (![0, 1, 3].includes(bumped.status) || !existsSync(resultFile)) {
        console.error(`::error title=${key}::the bump could not be applied\n${bumped.err}`);
        failed = true;
        record(dep, "error", { reason: "the bump could not be applied" });
        continue;
      }
      const result = JSON.parse(readFileSync(resultFile, "utf8"));
      let proto;
      try {
        applyCheck(result, rebakeAndCheck(name));
        const watch = PROTO_WATCH[name];
        if (watch) {
          const verdict = await interfaceCheck({ name, watch, report, dep });
          applyCheck(result, verdict.check);
          proto = verdict.proto;
        }
      } catch (err) {
        const reason = err instanceof Error ? err.message : String(err);
        console.error(`::error title=${key}::${reason}`);
        failed = true;
        record(dep, "error", { reason });
        continue;
      }
      const subject = prTitle(report.uplink, dep.name, dep.newest);

      sh("git", ["config", "user.name", "github-actions[bot]"]);
      sh("git", ["config", "user.email", "41898282+github-actions[bot]@users.noreply.github.com"]);

      let managedNote;
      if (result.verdict !== "red") {
        managedNote = commitReference({
          managed,
          referenceOut,
          branch,
          subject: `${dep.name} ${dep.newest}`,
        }).note;
      }
      if (proto && result.verdict !== "red") {
        writeFileSync(join(ROOT, "uplinks", name, PROTO_WATCH[name].vetted), proto);
      }
      sh("git", ["add", "-A", `uplinks/${name}`]);
      sh("git", ["commit", "-q", "-m", subject]);
      sh("git", ["push", "--force", "origin", `HEAD:refs/heads/${branch}`]);

      const bodyFile = join(dir, "body.md");
      let created;
      if (result.verdict === "red") {
        writeFileSync(
          bodyFile,
          issueBody({ result, dependency: dep.name, version: dep.newest, key, branch, runUrl }),
        );
        created = sh("gh", [
          "issue", "create",
          "--title", issueTitle(uplinkName, dep.name, dep.newest),
          "--body-file", bodyFile,
          "--label", WATCH_LABEL,
        ]).out.trim();
      } else {
        writeFileSync(
          bodyFile,
          prBody({ result, dependency: dep.name, version: dep.newest, key, managed: managedNote }),
        );
        const labels = [WATCH_LABEL, ...(result.verdict === "unverified" ? [IN_GAME_LABEL] : [])];
        created = sh("gh", [
          "pr", "create",
          "--base", "staging",
          "--head", branch,
          "--title", subject,
          "--body-file", bodyFile,
          ...labels.flatMap((label) => ["--label", label]),
        ]).out.trim();
      }
      console.log(`${key}: ${result.verdict}, ${created}`);
      record(dep, result.verdict, {
        url: created,
        ...(result.verdict === "red" ? { reason: reasonOf(result) } : {}),
      });

      const number = created.split("/").pop();
      const old = supersededBy([...prs, ...issues], report.uplink, dep.name, dep.newest);
      for (const item of old) {
        const kind = prs.some((p) => p.number === item.number) ? "pr" : "issue";
        sh("gh", [kind, "close", String(item.number), "--comment", `Superseded by #${number}`], {
          allowFail: true,
        });
      }
    }
  } finally {
    writeOutcomes();
  }
  return failed ? 1 : 0;
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  main(process.argv.slice(2)).then(
    (code) => process.exit(code),
    (err) => {
      console.error(err instanceof Error ? err.message : String(err));
      process.exit(1);
    },
  );
}
