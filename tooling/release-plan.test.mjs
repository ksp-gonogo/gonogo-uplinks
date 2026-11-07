/**
 * What a release dispatch is allowed to ask for, and the shape of the workflows
 * that carry it out. The workflows are read as text because their rules are
 * their shape: a guard that is not there cannot be exercised by running it.
 */
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { test } from "node:test";
import { fileURLToPath } from "node:url";
import { latestVersion, planLegs, prepareArgs } from "./release-plan.mjs";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
const workflow = (name) =>
  readFileSync(join(ROOT, ".github", "workflows", name), "utf8");

const leg = (id, over = {}) => ({
  name: id.toLowerCase(),
  id,
  client: true,
  mod_csproj: `uplinks/${id}/mod/x.csproj`,
  ...over,
});
const legs = [leg("kos"), leg("kerbcast"), leg("scansat"), leg("modonly", { client: false })];
const major = (table) => (l) => table[l.id] ?? 46;

test("a candidate is the default, and full needs saying", () => {
  assert.deepEqual(prepareArgs({ bump: "auto", full: false }), ["--bump", "auto", "--rc"]);
  assert.deepEqual(prepareArgs({ bump: "auto", full: true }), ["--bump", "auto"]);
  assert.deepEqual(prepareArgs({ version: "1.0.0-rc.5", full: false }), [
    "--version",
    "1.0.0-rc.5",
  ]);
});

test("a version and full must agree", () => {
  assert.throws(() => prepareArgs({ version: "1.0.0", full: false }), /full release/);
  assert.throws(() => prepareArgs({ version: "1.0.0-rc.1", full: true }), /candidate/);
  assert.throws(() => prepareArgs({ version: "1.0", full: false }), /not a version/);
  assert.throws(() => prepareArgs({ bump: "huge", full: false }), /none of them/);
});

test("all means every Uplink that has both halves, in id order", () => {
  assert.deepEqual(planLegs(legs, ["all"], major({})).map((l) => l.id), [
    "kerbcast",
    "kos",
    "scansat",
  ]);
});

test("an unknown Uplink, or one with a missing half, is refused by name", () => {
  assert.throws(() => planLegs(legs, ["nope"], major({})), /no Uplink .* nope/);
  assert.throws(() => planLegs(legs, ["modonly"], major({})), /no client/);
});

test("a set pinned to two contract Majors names the odd one out", () => {
  assert.throws(
    () => planLegs(legs, ["all"], major({ kos: 45 })),
    /kos to 45, where the rest are on 46/,
  );
  assert.deepEqual(planLegs(legs, ["kos"], major({ kos: 45 })).map((l) => l.id), ["kos"]);
});

const TAGS = [
  "kerbcast-v1.0.0-rc.9",
  "kerbcast-v1.0.0-rc.10",
  "kerbcast-v1.0.0-rc.2",
  "kos-v1.0.0-rc.1",
  "kos-v1.0.0-rc.2",
  "kerbalism-v1.0.0-rc.5",
  "kerbalism-v1.0.0-rc.7",
  "scansat-v0.9.0",
  "scansat-v1.0.0-rc.3",
  "scansat-v1.0.0",
  "mechjeb-v1.0.0-rc.4",
  "rc-0123abc",
];

test("an Uplink's latest version is its newest tag, numbers compared as numbers", () => {
  assert.equal(latestVersion(TAGS, "kerbcast"), "1.0.0-rc.10");
  assert.equal(latestVersion(TAGS, "kerbalism"), "1.0.0-rc.7");
  assert.equal(latestVersion(TAGS, "kos"), "1.0.0-rc.2");
});

test("a release sorts above the candidates for it and below the next minor", () => {
  assert.equal(latestVersion(TAGS, "scansat"), "1.0.0");
  assert.equal(latestVersion([...TAGS, "scansat-v1.1.0-rc.1"], "scansat"), "1.1.0-rc.1");
});

test("another Uplink's tag, an id that merely starts the same and a stray tag are not an Uplink's", () => {
  assert.equal(latestVersion(["kos-v1.0.0-rc.1", "kos-extra-v2.0.0"], "kos"), "1.0.0-rc.1");
  assert.equal(latestVersion(TAGS, "never-released"), undefined);
});

test("a bump of rc names each Uplink's own newest tag, so each gets the next candidate of its own", () => {
  const args = prepareArgs({ bump: "rc", full: false });
  assert.deepEqual(args, ["--bump", "rc", "--rc"]);
  const prepare = readFileSync(join(ROOT, ".github", "workflows", "_uplink-tasks.yml"), "utf8");
  assert.match(prepare, /release-plan\.mjs from "\$\{\{ inputs\.id \}\}"/);
  assert.match(prepare, /release prepare \$\{\{ inputs\.prepare_args \}\} \$\{from:\+--from "\$from"\}/);
  const per = Object.fromEntries(
    ["kerbcast", "kos", "kerbalism", "mechjeb"].map((id) => [id, latestVersion(TAGS, id)]),
  );
  assert.deepEqual(per, {
    kerbcast: "1.0.0-rc.10",
    kos: "1.0.0-rc.2",
    kerbalism: "1.0.0-rc.7",
    mechjeb: "1.0.0-rc.4",
  });
});

test("prepare-release runs on staging only and refuses a full release without the operator's switch", () => {
  const text = workflow("prepare-release.yml");
  assert.match(text, /refs\/heads\/staging/);
  assert.match(text, /ALLOW_FULL_RELEASE/);
  assert.match(text, /merge-base --is-ancestor/);
  assert.ok(
    text.indexOf("ALLOW_FULL_RELEASE") < text.indexOf("release-plan.mjs plan"),
    "the full-release switch is read before anything is planned",
  );
});

test("only the release job pushes, only when the run is not a dry run, and no job makes a release commit", () => {
  const text = workflow("prepare-release.yml");
  const jobs = text.split(/^  (?=[a-z-]+:\n)/m);
  const pushing = jobs.filter((j) => /git push/.test(j.split("\n").filter((l) => !/^\s*#/.test(l)).join("\n")));
  assert.equal(pushing.length, 1, "one job pushes");
  assert.match(pushing[0], /^release:/);
  assert.match(pushing[0], /dry_run == false/);
  assert.doesNotMatch(text, /git commit|git am|format-patch/, "nothing is committed to staging");
  assert.doesNotMatch(text, /push origin HEAD:refs\/heads\/staging/);
});

test("the tags go on the commit that was checked, whatever staging has done since", () => {
  const text = workflow("prepare-release.yml");
  const ci = text.slice(text.indexOf("  ci:"), text.indexOf("  release:"));
  assert.match(ci, /ref: \$\{\{ github\.sha \}\}/);
  const release = text.slice(text.indexOf("  release:"));
  assert.match(release, /ref: \$\{\{ github\.sha \}\}/);
  assert.match(release, /git push --atomic origin "\$sha:refs\/heads\/main"/);
});

test("a release's history is fetched whole, as a string, since 0 is falsy in an expression", () => {
  assert.match(
    workflow("_uplink-tasks.yml"),
    /fetch-depth: \$\{\{ inputs\.prepare_args != '' && '0' \|\| '1' \}\}/,
  );
});

test("a prepare leg runs no task step but its own, so it cannot publish or push", () => {
  const text = workflow("_uplink-tasks.yml");
  const prepare = text.split(/^(?=      - )/m).filter((step) => /prepare_args != ''/.test(step) && /name: Prepare the release/.test(step));
  assert.equal(prepare.length, 1);
  assert.doesNotMatch(prepare[0], /git push|git commit|gh release|publish/);
  assert.doesNotMatch(workflow("prepare-release.yml").split(/^  settle:/m)[0].split(/^  prepare:/m)[1] ?? "", /git push/);
});

test("a release build stamps the tag's version over the committed placeholder before it builds anything", () => {
  const text = workflow("_uplink-tasks.yml");
  const stamp = text.indexOf("name: Stamp the version from the tag");
  assert.ok(stamp > 0, "the leg stamps");
  assert.match(text.slice(stamp, stamp + 400), /if: inputs\.version != '' && inputs\.client/);
  assert.match(text.slice(stamp, stamp + 600), /uplink-tools\.mjs "\$\{\{ inputs\.name \}\}" version "\$\{\{ inputs\.version \}\}"/);
  for (const later of ["name: Typecheck client", "name: Build mod", "name: Build the release pair"]) {
    assert.ok(text.indexOf(later) > stamp, `${later} comes after the stamp`);
  }
});

test("the job that publishes the client stamps the same version, so client.url names it", () => {
  const release = workflow("release.yml");
  const publish = release.slice(release.indexOf("  publish:"));
  const stamp = publish.indexOf("name: Stamp the version from the tag");
  assert.ok(stamp > 0);
  assert.ok(stamp < publish.indexOf("name: Restore the baked hash"), "the stamp comes before the bake and the publish");
  assert.match(publish.slice(stamp, stamp + 400), /version "\$VERSION"/);
});

test("release.yml takes a tag that is on staging, and a dry run is dispatched on staging", () => {
  const release = workflow("release.yml");
  assert.match(release, /name: The tag is on staging/);
  assert.match(release, /merge-base --is-ancestor "\$GITHUB_SHA" origin\/staging/);
  assert.match(release, /\$GITHUB_REF" != refs\/heads\/staging/);
  assert.doesNotMatch(release, /origin\/main|refs\/heads\/main/);
});

test("no Uplink keeps a CHANGELOG.md, and none commits a version", async () => {
  const { readdirSync, existsSync } = await import("node:fs");
  const uplinks = join(ROOT, "uplinks");
  for (const name of readdirSync(uplinks)) {
    assert.ok(!existsSync(join(uplinks, name, "CHANGELOG.md")), `${name} has a CHANGELOG.md`);
    const client = join(uplinks, name, "client", "package.json");
    if (!existsSync(client)) continue;
    assert.equal(JSON.parse(readFileSync(client, "utf8")).version, "0.0.0-development", name);
    const url = JSON.parse(readFileSync(join(uplinks, name, "uplink.json"), "utf8")).client.url;
    assert.ok(url.split("/").includes("0.0.0-development"), `${name}: ${url}`);
    assert.match(readFileSync(join(uplinks, name, "client", "src", "uplink.ts"), "utf8"), /UPLINK_VERSION = "0\.0\.0-development"/, name);
  }
});
