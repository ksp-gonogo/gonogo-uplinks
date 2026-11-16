#!/usr/bin/env node
/**
 * Publishes one Uplink's client into the `releases` branch, and finishes the
 * push when another release got there first.
 *
 *   node tooling/publish-with-retry.mjs <uplink-dir-name> <tag> <bundle-dir>
 *
 * Uplinks released together each commit to `releases` from the same parent, so
 * every push but the first is refused, either as a non-fast-forward or as a
 * `cannot lock ref` race on the branch itself. `uplink-tools publish` commits
 * the release in `uplinks/<name>/.releases` (the folder that holds
 * `uplink.json`, not `client/`) before it pushes, so a refused push leaves the
 * release committed there. The retry fetches the branch, rebases that commit
 * onto it, waits a short jittered while and runs the same command, which
 * pushes the commit. A failure that is not a refused push, or a refusal with
 * no committed release behind it, fails at once.
 */
import { spawnSync } from "node:child_process";
import { existsSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");

export const MAX_ATTEMPTS = 6;

const REFUSED_PUSH =
  /cannot lock ref|non-fast-forward|\[rejected\]|fetch first|failed to push some refs/i;

const git = (dir, ...args) => {
  const run = spawnSync("git", ["-C", dir, ...args], { encoding: "utf8" });
  return { ok: run.status === 0, out: `${run.stdout ?? ""}${run.stderr ?? ""}`.trim() };
};

const IDENTITY = ["-c", "user.name=uplink-tools", "-c", "user.email=uplink-tools@users.noreply.github.com"];

/**
 * Runs `publish` until it succeeds, rebasing the committed release onto the
 * remote branch between attempts. Returns the exit code to leave with.
 *
 * `publish` returns `{ ok, out }`. `wait` receives the milliseconds to sleep.
 */
export async function publishWithRetry({
  publish,
  checkout,
  attempts = MAX_ATTEMPTS,
  wait = (ms) => new Promise((done) => setTimeout(done, ms)),
  random = Math.random,
  log = console,
}) {
  for (let attempt = 1; ; attempt++) {
    const result = publish();
    if (result.ok) return 0;
    if (!REFUSED_PUSH.test(result.out)) {
      log.error("::error::publish failed for a reason other than a refused push");
      return 1;
    }
    if (attempt >= attempts) {
      log.error(`::error::push to releases still refused after ${attempts} attempts`);
      return 1;
    }
    if (!existsSync(checkout)) {
      log.error(`::error::push refused, but ${checkout} holds no committed release to retry`);
      return 1;
    }
    const fetched = git(checkout, "fetch", "--no-tags", "origin", "+refs/heads/releases:refs/remotes/origin/releases");
    if (!fetched.ok) {
      log.error(`::error::could not fetch releases: ${fetched.out}`);
      return 1;
    }
    const unsent = git(checkout, "rev-list", "--count", "origin/releases..HEAD");
    if (!unsent.ok || unsent.out === "0") {
      log.error("::error::push refused with nothing unsent to retry");
      return 1;
    }
    log.warn(`::warning::push to releases refused (attempt ${attempt} of ${attempts}); rebasing the unsent release onto the remote`);
    const rebased = git(checkout, ...IDENTITY, "rebase", "origin/releases");
    if (!rebased.ok) {
      git(checkout, "rebase", "--abort");
      log.error(`::error::the release does not rebase onto releases: ${rebased.out}`);
      return 1;
    }
    await wait(attempt * 2000 + Math.floor(random() * 3000));
  }
}

if (process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1]) {
  const [name, tag, from] = process.argv.slice(2);
  if (!name || !tag || !from) {
    console.error("usage: publish-with-retry.mjs <uplink-dir-name> <tag> <bundle-dir>");
    process.exit(2);
  }
  const code = await publishWithRetry({
    checkout: join(ROOT, "uplinks", name, ".releases"),
    publish: () => {
      const run = spawnSync(
        "node",
        [join(ROOT, "tooling", "uplink-tools.mjs"), name, "publish", "--from", from, "--push", "--purge", "--tag", tag],
        { encoding: "utf8" },
      );
      process.stdout.write(run.stdout ?? "");
      process.stderr.write(run.stderr ?? "");
      return { ok: run.status === 0, out: `${run.stdout ?? ""}${run.stderr ?? ""}` };
    },
  });
  process.exit(code);
}
