/**
 * What keeps a release from reaching players by accident.
 *
 * SpaceDock feeds CKAN, so a step that uploads to SpaceDock puts a mod in front
 * of players. Only a full release may do that. A release candidate is a GitHub
 * prerelease, and a full release is refused unless the operator has set
 * ALLOW_FULL_RELEASE. The workflow is read as text because these rules are its
 * shape: a step that is not there cannot be exercised by running it.
 *
 * The guard check is shown to see before its silence is believed: given the
 * workflow with a guard taken out, it must flag the step, or the test fails as
 * BLIND.
 */
import assert from "node:assert/strict";
import { readdirSync, readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { test } from "node:test";
import { fileURLToPath } from "node:url";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
const WORKFLOWS = join(ROOT, ".github", "workflows");
const read = (name) => readFileSync(join(WORKFLOWS, name), "utf8");

/** A step that sends anything to SpaceDock. */
const TOUCHES_SPACEDOCK = /spacedock\.info/i;

/** The one step allowed to read the SpaceDock secrets without sending anything: it only asks whether they are there. */
const PRESENCE_CHECK = "A full release can reach SpaceDock";

/** The steps of a workflow, each as the text from its `- ` to the next one. */
function steps(text) {
  return text.split(/^(?=      - )/m).filter((chunk) => /^      - /.test(chunk));
}

/** The steps that touch SpaceDock without the two guards on their `if:`. */
export function unguardedSpaceDockSteps(text) {
  return steps(text)
    .filter((step) => TOUCHES_SPACEDOCK.test(step))
    .filter((step) => {
      const condition = /^        if: (.*)$/m.exec(step)?.[1] ?? "";
      return !(
        condition.includes("needs.resolve.outputs.prerelease != 'true'") &&
        condition.includes("needs.resolve.outputs.dry != 'true'")
      );
    })
    .map((step) => /name: (.*)/.exec(step)?.[1] ?? step.slice(0, 40));
}

test("every step that touches SpaceDock is skipped for a candidate and for a dry run", () => {
  const release = read("release.yml");
  assert.ok(
    steps(release).filter((s) => TOUCHES_SPACEDOCK.test(s)).length >= 2,
    "found the SpaceDock steps, so the guard check read something",
  );
  assert.deepEqual(unguardedSpaceDockSteps(release), []);
});

test("the SpaceDock login is read only by the guarded steps and the presence check, which sends nothing", () => {
  const release = read("release.yml");
  for (const step of steps(release).filter((s) => /secrets\.SPACEDOCK/.test(s))) {
    if (step.includes(`- name: ${PRESENCE_CHECK}`)) {
      assert.doesNotMatch(step, /curl|spacedock\.info/i, "the presence check sends nothing");
      assert.match(step, /if: steps\.which\.outputs\.prerelease != 'true'/);
    } else {
      assert.ok(TOUCHES_SPACEDOCK.test(step), `a step reads the login but is neither guarded nor the presence check: ${step.slice(0, 80)}`);
    }
  }
});

test("a full release with no listing id or no login fails before the build, and the dry run only checks the id", () => {
  const release = read("release.yml");
  const resolve = release.slice(release.indexOf("  resolve:"), release.indexOf("  build:"));
  assert.match(resolve, /spacedock-release\.mjs require-mod-id/);
  assert.match(resolve, /not visible to this repository/);
  assert.match(resolve, /workflow_dispatch/);
  assert.doesNotMatch(release, /skipping the upload|NOT updated/, "an unconfigured upload is a failure, never a skip");
});

test("the guard check flags a SpaceDock step whose guard was taken out", () => {
  const release = read("release.yml");
  const noPrereleaseGuard = release.replaceAll(
    "needs.resolve.outputs.prerelease != 'true' && ",
    "",
  );
  assert.notDeepEqual(
    unguardedSpaceDockSteps(noPrereleaseGuard),
    [],
    "BLIND: removing the prerelease guard was not flagged",
  );
  const noDryGuard = release.replaceAll(
    " && needs.resolve.outputs.dry != 'true'",
    "",
  );
  assert.notDeepEqual(
    unguardedSpaceDockSteps(noDryGuard),
    [],
    "BLIND: removing the dry-run guard was not flagged",
  );
});

test("the SpaceDock decision also refuses a candidate inside the step", () => {
  const release = read("release.yml");
  const decide = steps(release).find((s) => /Decide whether SpaceDock/.test(s));
  assert.ok(decide, "the decide step exists");
  assert.match(decide, /spacedock-release\.mjs eligible "\$TAG"/);
  assert.match(decide, /exit 1/);
});

test("no workflow but release.yml talks to SpaceDock", () => {
  for (const name of readdirSync(WORKFLOWS).filter((n) => /\.ya?ml$/.test(n))) {
    if (name === "release.yml") continue;
    assert.doesNotMatch(read(name), TOUCHES_SPACEDOCK, `${name} reaches SpaceDock`);
  }
});

test("nothing pushes to CKAN's repositories", () => {
  for (const name of readdirSync(WORKFLOWS).filter((n) => /\.ya?ml$/.test(n))) {
    assert.doesNotMatch(
      read(name),
      /KSP-CKAN\/(NetKAN|CKAN-meta)[^\n]*(push|pull|gh pr)|git push[^\n]*KSP-CKAN/i,
      `${name} pushes to a CKAN repository; CKAN indexes from SpaceDock`,
    );
  }
});

test("release.yml marks a candidate a prerelease and refuses a full release without the operator's variable", () => {
  const release = read("release.yml");
  assert.match(release, /--prerelease/, "a candidate's GitHub release is a prerelease");
  assert.match(release, /-rc\\\.\[0-9\]\+\$/, "the candidate suffix is -rc.<n>");
  assert.match(release, /vars\.ALLOW_FULL_RELEASE/, "a full release needs the operator's variable");
  assert.match(release, /the operator's to make/, "the refusal says whose a full release is");
});

test("release.yml's dispatch is a dry run that pushes nothing", () => {
  const release = read("release.yml");
  assert.match(release, /workflow_dispatch:/);
  for (const name of ["Publish the client", "Attach the mod to the tag's GitHub release"]) {
    const step = steps(release).find((s) => s.includes(`- name: ${name}`));
    assert.ok(step, `${name} is a step`);
    assert.match(step, /if: needs\.resolve\.outputs\.dry != 'true'/, `${name} is skipped on a dry run`);
  }
  for (const name of ["Dry run, what would be published", "Dry run, what SpaceDock would get"]) {
    const step = steps(release).find((s) => s.includes(`- name: ${name}`));
    assert.ok(step, `${name} is a step`);
    assert.doesNotMatch(step, /--push|--purge|gh release|curl|secrets\./, `${name} changes nothing outside the runner`);
  }
});
