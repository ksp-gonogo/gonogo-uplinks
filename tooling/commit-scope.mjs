/**
 * The commit scope rule: a commit that touches Uplink directories names exactly
 * those Uplinks in its scope, so the per-Uplink release notes built from commit
 * scopes put each line where it belongs.
 *
 *   `fix(kerbcast): ...`       touches uplinks/kerbcast only
 *   `fix(kerbcast,rp1): ...`   touches uplinks/kerbcast and uplinks/rp1 only
 *   `build(uplinks): ...`      for a change touching three or more Uplinks (a re-pin)
 *
 * A commit touching no Uplink directory keeps whatever scope it has. The commit-msg
 * hook runs this over the staged paths and CI runs it over the commits a push adds.
 *
 *   node tooling/commit-scope.mjs --since <sha> [--to <ref>]
 *   node tooling/commit-scope.mjs --message <file>      (staged paths)
 */
import { spawnSync } from "node:child_process";
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { scopeNames, uplinkNames } from "./uplink-commits.mjs";

/**
 * Commits up to and including this one predate the rule and are never checked;
 * history is not rewritten to satisfy it.
 */
export const SCOPE_CHECK_AFTER = "c48c54e23e5b161e76a2e6b339cfa61a4b235930";

/** Below this many touched Uplinks the ids are listed, above it `uplinks` stands for them. */
export const UPLINKS_SCOPE_MIN = 3;

const SUBJECT = /^(\w+)(?:\(([^)]*)\))?(!)?:\s+(.+)$/;

/**
 * The scope for a commit that touched `files`: the Uplink ids, or `uplinks` from
 * UPLINKS_SCOPE_MIN of them, or undefined when no Uplink directory was touched.
 */
export function scopeFor(files, names) {
  const ids = new Set();
  for (const file of files) {
    const dir = /^uplinks\/([^/]+)\//.exec(file)?.[1];
    const id = [...names.entries()].find(([, u]) => u.dir === dir)?.[0];
    if (id) ids.add(id);
  }
  if (ids.size === 0) return undefined;
  return ids.size >= UPLINKS_SCOPE_MIN ? "uplinks" : [...ids].sort().join(",");
}

/**
 * Why `subject` does not name the Uplinks `files` touch, or undefined when it does.
 * `names` is `uplinkNames(root)`.
 */
export function scopeProblem(subject, files, names) {
  const match = SUBJECT.exec(subject.trim());
  if (!match || match[1] === "release") return undefined;
  const touched = new Set();
  for (const file of files) {
    const dir = /^uplinks\/([^/]+)\//.exec(file)?.[1];
    const id = [...names.entries()].find(([, u]) => u.dir === dir)?.[0];
    if (id) touched.add(id);
  }
  if (touched.size === 0) return undefined;
  const wanted = [...touched].sort();
  const scopes = scopeNames(match[2]);
  if (scopes.length === 1 && scopes[0] === "uplinks") {
    return touched.size >= UPLINKS_SCOPE_MIN
      ? undefined
      : `the scope "uplinks" is for a change touching ${UPLINKS_SCOPE_MIN} or more Uplinks, this touches ${wanted.join(", ")}: scope it (${wanted.join(",")})`;
  }
  const named = new Set();
  for (const scope of scopes) {
    const id = [...names.entries()].find(([, u]) => u.names.has(scope))?.[0];
    if (!id) {
      return `the scope names "${scope}", which is not an Uplink, but the commit touches ${wanted.join(", ")}: scope it (${wanted.join(",")})`;
    }
    named.add(id);
  }
  const same = named.size === touched.size && [...named].every((id) => touched.has(id));
  if (same) return undefined;
  const missing = wanted.filter((id) => !named.has(id));
  const extra = [...named].filter((id) => !touched.has(id)).sort();
  const parts = [];
  if (missing.length) parts.push(`touches ${missing.join(", ")} without naming it`);
  if (extra.length) parts.push(`names ${extra.join(", ")} without touching it`);
  return `the commit ${parts.join(" and ")}: scope it (${wanted.join(",")})`;
}

function git(root, args) {
  const ran = spawnSync("git", args, { cwd: root, encoding: "utf8", maxBuffer: 256 * 1024 * 1024 });
  if (ran.status !== 0) throw new Error(`git ${args.join(" ")} failed:\n${ran.stderr}`);
  return ran.stdout;
}

/**
 * Where a check of the commits after `since` starts: `since` itself when it is a
 * commit at or after SCOPE_CHECK_AFTER, otherwise SCOPE_CHECK_AFTER (a new branch's
 * all-zero "before", or a push whose base is older than the rule).
 */
export function effectiveStart(root, since) {
  const known = (ref) => spawnSync("git", ["cat-file", "-e", `${ref}^{commit}`], { cwd: root }).status === 0;
  const descends = (ancestor, ref) =>
    spawnSync("git", ["merge-base", "--is-ancestor", ancestor, ref], { cwd: root }).status === 0;
  if (since && known(since) && descends(SCOPE_CHECK_AFTER, since)) return since;
  return SCOPE_CHECK_AFTER;
}

/** The scope problems of every non-merge commit in `range`, as `{ sha, subject, problem }`. */
export function rangeProblems(root, range) {
  const names = uplinkNames(root);
  const log = git(root, ["log", "--no-merges", "--name-only", "--format=%x1e%H%x1f%s%x1f", range]);
  const found = [];
  for (const record of log.split("\x1e").slice(1)) {
    const [sha, subject, files] = record.split("\x1f");
    const problem = scopeProblem(subject, files.split("\n").filter(Boolean), names);
    if (problem) found.push({ sha, subject, problem });
  }
  return found;
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  const args = process.argv.slice(2);
  const value = (flag) => {
    const at = args.indexOf(flag);
    return at < 0 ? undefined : args[at + 1];
  };
  const root = join(dirname(fileURLToPath(import.meta.url)), "..");
  const message = value("--message");
  const since = value("--since");
  if (message) {
    const subject = readFileSync(message, "utf8").split("\n")[0];
    if (/^(Revert|Merge) /.test(subject)) process.exit(0);
    const files = git(root, ["diff", "--cached", "--name-only"]).split("\n").filter(Boolean);
    const problem = scopeProblem(subject, files, uplinkNames(root));
    if (problem) {
      console.error(`commit-msg: refusing a scope that does not match what the commit touches.\n\n  ${subject}\n\n${problem}`);
      process.exit(1);
    }
  } else if (args[0] === "--scope-for") {
    const files = git(root, ["diff", "--cached", "--name-only"]).split("\n").filter(Boolean);
    const scope = scopeFor(files, uplinkNames(root));
    if (scope) process.stdout.write(scope);
  } else if (since) {
    const range = `${effectiveStart(root, since)}..${value("--to") ?? "HEAD"}`;
    const bad = rangeProblems(root, range);
    for (const { sha, subject, problem } of bad) {
      console.error(`${sha.slice(0, 10)} ${subject}\n  ${problem}`);
    }
    if (bad.length) process.exit(1);
    console.error(`commit scopes: every commit in ${range} matches what it touches`);
  } else {
    console.error("usage: commit-scope.mjs --since <sha> [--to <ref>] | --scope-for (staged paths) | --message <file>");
    process.exit(2);
  }
}
