import assert from "node:assert/strict";
import { test } from "node:test";
import {
  branchOf,
  existingFor,
  issueBody,
  issueTitle,
  keyIn,
  keyOf,
  mentionsOutsideFences,
  prBody,
  prTitle,
  supersededBy,
} from "./uplink-deps.mjs";

const result = (verdict, extra = {}) => ({
  schema: "uplink-bump/1",
  uplink: "rp1",
  bumps: [
    {
      name: "RP-1",
      from: "4.7.0.0",
      to: "4.8.1.0",
      binds: "reflection",
      url: "https://example.org/release",
      ckanMinVersion: "v4.8.1.0",
    },
  ],
  changed: ["uplink.json", "README.md"],
  checks: [
    { name: "check", status: "pass" },
    { name: "tests", status: "fail", excerpt: "FAIL widget\n  expected @ksp-gonogo/x" },
  ],
  exercised: { "RP-1": "nothing ran against 4.8.1.0" },
  reference: {},
  verdict,
  ...extra,
});

const key = keyOf("rp1", "RP-1", "4.8.1.0");

test("a key survives the body that carries it, so a second run recognises the first", () => {
  const body = prBody({ result: result("green"), dependency: "RP-1", version: "4.8.1.0", key });
  assert.deepEqual(keyIn({ body }), { uplink: "rp1", dependency: "RP-1", version: "4.8.1.0" });
  assert.equal(existingFor([{ number: 1, body }], key).length, 1);
  assert.equal(existingFor([{ number: 1, body }], keyOf("rp1", "RP-1", "4.9.0.0")).length, 0);
});

test("an older version of the same dependency is superseded, another dependency or Uplink is not", () => {
  const item = (uplink, dep, version, number) => ({
    number,
    body: `<!-- uplink-deps: ${keyOf(uplink, dep, version)} -->`,
  });
  const open = [
    item("rp1", "RP-1", "4.7.5.0", 1),
    item("rp1", "RP-1", "4.8.1.0", 2),
    item("rp1", "Other", "1.0.0", 3),
    item("kos", "RP-1", "1.0.0", 4),
  ];
  assert.deepEqual(supersededBy(open, "rp1", "RP-1", "4.8.1.0").map((i) => i.number), [1]);
  assert.deepEqual(supersededBy(open, "rp1", "RP-1", "4.10.0.0").map((i) => i.number), [1, 2]);
});

test("a branch name is ASCII even for a tag-released mod", () => {
  assert.equal(branchOf("rp1", "RP-1", "4.8.1.0"), "deps/rp1/rp-1-4.8.1.0");
  assert.match(branchOf("principia", "Principia", "2026091103-Lévy"), /^deps\/principia\/principia-[a-z0-9.-]+$/);
});

test("an unverified pull request says nothing in CI ran against the new version", () => {
  const body = prBody({ result: result("unverified"), dependency: "RP-1", version: "4.8.1.0", key });
  assert.ok(
    body.includes("Nothing in CI ran against RP-1 4.8.1.0; the Uplink reaches it by reflection."),
  );
  assert.ok(body.includes("`v4.8.1.0`"));
});

test("a green pull request makes no such claim", () => {
  const body = prBody({ result: result("green"), dependency: "RP-1", version: "4.8.1.0", key });
  assert.ok(!body.includes("Nothing in CI ran"));
  assert.ok(body.includes("behaviour is not checked"));
});

test("a red issue describes the Uplink, names the branch, and addresses nobody", () => {
  const body = issueBody({
    result: result("red"),
    dependency: "RP-1",
    version: "4.8.1.0",
    key,
    branch: "deps/rp1/rp-1-4.8.1.0",
    runUrl: "https://github.com/o/r/actions/runs/1",
  });
  assert.ok(body.includes("### tests"));
  assert.ok(body.includes("expected @ksp-gonogo/x"));
  assert.ok(body.includes("`deps/rp1/rp-1-4.8.1.0`"));
  assert.ok(!mentionsOutsideFences(body));
  assert.ok(!body.includes("example.org"));
  assert.equal(issueTitle("RP-1", "RP-1", "4.8.1.0"), "RP-1 Uplink: fails its checks against RP-1 4.8.1.0");
});

test("the word that names the test machine appears in nothing it writes", () => {
  const all = [
    prBody({ result: result("unverified"), dependency: "RP-1", version: "4.8.1.0", key }),
    issueBody({ result: result("red"), dependency: "RP-1", version: "4.8.1.0", key, branch: "b" }),
    prTitle("rp1", "RP-1", "4.8.1.0"),
  ].join("\n");
  assert.ok(!/\brig\b/i.test(all));
});

test("a commit subject fits the limit", () => {
  assert.ok(prTitle("ferramaerospaceresearch", "Ferram Aerospace Research", "0.16.1.2").length <= 100);
});
