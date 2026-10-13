#!/usr/bin/env node
/**
 * Fails when git tracks a file that holds an author's private working notes or
 * tool configuration: the per-assistant instruction files, the MCP server
 * config, or anything under an assistant config folder, at any depth. This repo is public, so such a file is
 * published the moment it is committed.
 *
 * It proves itself first: a planted list containing each kind must be reported
 * and an ordinary list must not, or it exits BLIND.
 */

import { execFileSync } from "node:child_process";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");

const NOTES = ["CLAUDE", "AGENTS", "GEMINI"].map((name) => `${name}\\.md`).join("|");
const CONFIG_DIR = ["claude"].map((name) => `\\.${name}`).join("|");
const PRIVATE_NOTE_PATH = new RegExp(`(^|/)(${NOTES}|\\.mcp\\.json)$|(^|/)(${CONFIG_DIR})/`);

export const privateNoteFaults = (tracked) => tracked.filter((file) => PRIVATE_NOTE_PATH.test(file));

const planted = privateNoteFaults(["README.md", `${"CLAUDE"}.md`, `uplinks/x/${"AGENTS"}.md`, `.${"claude"}/settings.json`, ".mcp.json", `${"GEMINI"}.md`]);
const ordinary = privateNoteFaults(["README.md", "uplinks/x/uplink.json", "docs/claude-notes.md"]);
if (planted.length !== 5 || ordinary.length !== 0) {
  console.error("check-private-notes: BLIND, the planted private files were not told apart from ordinary ones.");
  process.exit(1);
}

if (process.argv[1] && join(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const tracked = execFileSync("git", ["ls-files"], { cwd: root, encoding: "utf8" }).split("\n").filter(Boolean);
  if (tracked.length < 100) {
    console.error(`check-private-notes: BLIND, git ls-files returned only ${tracked.length} paths.`);
    process.exit(1);
  }
  const faults = privateNoteFaults(tracked);
  if (faults.length > 0) {
    console.error(`check-private-notes: private working notes must stay untracked:\n  ${faults.join("\n  ")}`);
    process.exit(1);
  }
  console.log(`check-private-notes: ${tracked.length} tracked paths, none are private notes.`);
}
