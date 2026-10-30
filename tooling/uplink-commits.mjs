#!/usr/bin/env node
/**
 * The commits one Uplink's next release is made of, as the file
 * `uplink-tools version --commits` and `release prepare --commits` read.
 *
 *   node tooling/uplink-commits.mjs <uplink id> [--since <ref>] [--out <file>]
 *
 * One repository holds every Uplink, so an Uplink's history is a filter over the
 * shared one. A commit belongs to an Uplink when its scope names it
 * (`feat(kerbcast): ...`), or when it touched that Uplink's directory and its
 * scope names no other Uplink. A commit that touched several Uplinks and is
 * scoped to one belongs to that one alone.
 *
 * The list is simplified before it is handed on: release commits are dropped,
 * and a revert is dropped together with the commit it undoes, found by the
 * description they share. A subject that is not a Conventional Commit is left
 * for the tool to ignore.
 *
 * `--since` defaults to the Uplink's latest full-release tag reachable from
 * HEAD, so a candidate's changelog holds everything since the last release
 * players could install. With no such tag it reads the whole history.
 */
import { spawnSync } from "node:child_process";
import { readdirSync, readFileSync, writeFileSync, existsSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const SUBJECT = /^(\w+)(?:\(([^)]*)\))?(!)?:\s+(.+)$/;

function git(root, args) {
  const ran = spawnSync("git", args, { cwd: root, encoding: "utf8", maxBuffer: 256 * 1024 * 1024 });
  if (ran.status !== 0) {
    throw new Error(`git ${args.join(" ")} failed:\n${ran.stderr}`);
  }
  return ran.stdout;
}

/** Every name an Uplink answers to in a commit scope: its id and its directory. */
export function uplinkNames(root) {
  const names = new Map();
  const dir = join(root, "uplinks");
  for (const entry of readdirSync(dir)) {
    const file = join(dir, entry, "uplink.json");
    if (!existsSync(file)) continue;
    const id = JSON.parse(readFileSync(file, "utf8")).id;
    names.set(id, { dir: entry, names: new Set([id, entry]) });
  }
  return names;
}

/** The latest full-release tag of `id` reachable from HEAD, or undefined. */
export function lastRelease(root, id) {
  const tags = git(root, [
    "tag",
    "--merged",
    "HEAD",
    "--sort=-v:refname",
    "--list",
    `${id}-v*`,
  ])
    .split("\n")
    .filter((tag) => new RegExp(`^${id}-v\\d+\\.\\d+\\.\\d+$`).test(tag));
  return tags[0];
}

/**
 * The simplified commits of `id` since `since`, oldest first, as
 * `{ subject, breaking }` objects.
 */
export function uplinkCommits(root, id, since) {
  const all = uplinkNames(root);
  const own = all.get(id);
  if (!own) throw new Error(`no Uplink under uplinks/ declares the id ${id}`);
  const range = since ? [`${since}..HEAD`] : ["HEAD"];
  const log = git(root, [
    "log",
    "--no-merges",
    "--reverse",
    "--name-only",
    "--format=%x1e%s%x1f%b%x1f",
    ...range,
  ]);
  const others = new Set(
    [...all.entries()].filter(([other]) => other !== id).flatMap(([, u]) => [...u.names]),
  );
  const commits = [];
  for (const record of log.split("\x1e").slice(1)) {
    const [subject, body, files] = record.split("\x1f");
    const match = SUBJECT.exec(subject.trim());
    if (!match) continue;
    const scope = match[2];
    const touched = files
      .split("\n")
      .some((file) => file.startsWith(`uplinks/${own.dir}/`));
    const named = scope !== undefined && own.names.has(scope);
    if (!(named || (touched && !(scope !== undefined && others.has(scope))))) continue;
    commits.push({
      subject: subject.trim(),
      type: match[1].toLowerCase(),
      description: match[4].trim(),
      breaking: match[3] === "!" || /^BREAKING[ -]CHANGE:/m.test(body),
    });
  }
  const dropped = new Set();
  commits.forEach((commit, at) => {
    if (commit.type === "release") dropped.add(at);
    if (commit.type !== "revert") return;
    dropped.add(at);
    const undone = commits.findIndex(
      (other, i) =>
        i < at && !dropped.has(i) && other.type !== "revert" && other.description === commit.description,
    );
    if (undone >= 0) dropped.add(undone);
  });
  return commits
    .filter((_, at) => !dropped.has(at))
    .map(({ subject, breaking }) => ({ subject, breaking }));
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  const args = process.argv.slice(2);
  const id = args[0];
  const value = (flag) => {
    const at = args.indexOf(flag);
    return at < 0 ? undefined : args[at + 1];
  };
  if (!id || id.startsWith("--")) {
    console.error("usage: uplink-commits.mjs <uplink id> [--since <ref>] [--out <file>]");
    process.exit(2);
  }
  const root = join(dirname(fileURLToPath(import.meta.url)), "..");
  const since = value("--since") ?? lastRelease(root, id);
  const json = `${JSON.stringify(uplinkCommits(root, id, since), null, 2)}\n`;
  const out = value("--out");
  if (out) writeFileSync(out, json);
  else process.stdout.write(json);
  console.error(`${id}: commits since ${since ?? "the start of history"}`);
}
