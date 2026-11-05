#!/usr/bin/env node
/**
 * The release notes of one Uplink's release: the subjects of the commits that
 * belong to it since its previous full release, grouped the way its CHANGELOG.md
 * groups them. The GitHub Release and the SpaceDock version carry this text.
 *
 *   node tooling/uplink-notes.mjs <uplink id> [--tag <release tag>] [--since <ref>] [--out <file>]
 *
 * An Uplink's first full release has no change list. With `--tag` the notes cover the commits up to that tag, since the full
 * release before it, so a re-run of an old release writes that release's notes.
 * Without it they cover HEAD since the Uplink's latest full release, which is
 * what a candidate's changelog holds.
 */
import { writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { lastRelease, uplinkCommits } from "./uplink-commits.mjs";

const SUBJECT = /^(\w+)(?:\(([^)]*)\))?(!)?:\s+(.+)$/;

/** The kinds of change that reach players, in the order the notes list them. */
const SECTIONS = [
  ["feat", "Features"],
  ["fix", "Fixes"],
  ["perf", "Performance"],
  ["compatibility", "Compatibility"],
];

/**
 * Scopes that name work on the repository, its contract pins, generated code,
 * release machinery or add-on packaging rather than anything a player sees. A
 * commit whose scopes are all of these is left out, whatever its type.
 */
const DEVELOPER_SCOPES = new Set([
  "codegen",
  "contract",
  "vendor",
  "deps",
  "release",
  "repo",
  "mod",
  "add-ons",
  "build",
  "ci",
  "tooling",
]);

/**
 * A chore whose description says which Gonogo version the Uplink now supports
 * ("update to support gonogo 1.2"). The word "support" and a dotted version
 * number are both required, so a re-pin of the packages or a contract number
 * does not pass.
 */
const COMPATIBILITY = /\bsupports?\s+(?:the\s+)?gonogo\s+v?\d+\.\d+/i;

/**
 * The notes for `commits`, as `{ subject, breaking }` objects: breaking changes
 * first, then features, fixes and performance changes, each entry the commit's
 * description. A commit reaches the notes when its type is feat, fix or perf and
 * it names at least one scope outside DEVELOPER_SCOPES. A commit with no scope
 * names nothing a player uses, so it is left out too. A chore matching
 * COMPATIBILITY is the one exception: it is listed last under Compatibility,
 * whatever its scope.
 */
export function releaseNotes(commits) {
  let changes = [];
  for (const { subject, breaking } of commits) {
    const match = SUBJECT.exec(subject);
    if (!match) continue;
    const scopes = (match[2] ?? "").split(",").map((scope) => scope.trim()).filter(Boolean);
    const type = match[1].toLowerCase();
    const compatibility = type === "chore" && COMPATIBILITY.test(match[4]);
    if (!compatibility && scopes.every((scope) => DEVELOPER_SCOPES.has(scope))) continue;
    changes.push({
      type: compatibility ? "compatibility" : type,
      description: match[4].trim(),
      breaking: breaking === true || match[3] === "!",
    });
  }
  const lines = [];
  const entry = (change) => `- ${change.description}`;
  const seen = new Set();
  changes = changes.filter(({ description }) => !seen.has(description) && seen.add(description));
  const breaking = changes.filter((change) => change.breaking);
  if (breaking.length > 0) lines.push("### Breaking changes", "", ...breaking.map(entry), "");
  for (const [type, title] of SECTIONS) {
    const own = changes.filter((change) => change.type === type && !change.breaking);
    if (own.length > 0) lines.push(`### ${title}`, "", ...own.map(entry), "");
  }
  return lines.length > 0 ? `${lines.join("\n").trimEnd()}\n` : "No changes that reach players.\n";
}

/**
 * The notes of `id` for the release `tag`, or for HEAD when there is no tag. An
 * Uplink with no earlier full release has no change list: its first release is
 * only the release.
 */
export function notesFor(root, id, { tag, since } = {}) {
  const until = tag ?? "HEAD";
  const start = since ?? lastRelease(root, id, tag ? `${tag}^` : "HEAD");
  if (start === undefined) return "First release.\n";
  return releaseNotes(uplinkCommits(root, id, start, until));
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  const args = process.argv.slice(2);
  const id = args[0];
  const value = (flag) => {
    const at = args.indexOf(flag);
    return at < 0 ? undefined : args[at + 1];
  };
  if (!id || id.startsWith("--")) {
    console.error("usage: uplink-notes.mjs <uplink id> [--tag <release tag>] [--since <ref>] [--out <file>]");
    process.exit(2);
  }
  const root = join(dirname(fileURLToPath(import.meta.url)), "..");
  const text = notesFor(root, id, { tag: value("--tag"), since: value("--since") });
  const out = value("--out");
  if (out) writeFileSync(out, text);
  else process.stdout.write(text);
}
