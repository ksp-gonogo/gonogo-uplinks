import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { test } from "node:test";
import { fileURLToPath } from "node:url";
import { CLIENTLESS_BANNER, buildClientlessReadme, clientlessDeclarationFaults } from "./clientless-page.mjs";

const declared = {
  id: "someMod",
  name: "Some Mod",
  description: "Integrates Some Mod into Gonogo.",
  repo: "https://github.com/o/r",
  gamedata: "GonogoSomeModUplink",
  mod: { name: "Some Mod", tier: "ckan", builtAgainst: "1.2.3" },
};

test("the page carries the sections every other Uplink's page does", () => {
  const page = buildClientlessReadme(declared);
  assert.ok(page.startsWith(CLIENTLESS_BANNER));
  assert.match(page, /\n# Some Mod\n\nIntegrates Some Mod into Gonogo\.\n\nAn Uplink for \[Gonogo\]/);
  assert.match(page, /\nBuilt against Some Mod 1\.2\.3\.\n/);
  assert.match(page, /Install the Some Mod Uplink with CKAN: search for `GonogoSomeModUplink`, tick it and apply\. CKAN also installs Gonogo itself and Some Mod\./);
  assert.match(page, /Without CKAN, download `GonogoSomeModUplink\.zip`/);
  assert.match(page, /Releases: https:\/\/github\.com\/o\/r\/releases\?q=someMod-v/);
  assert.match(page, /\| Wraps \| Some Mod \(ckan\) \|/);
});

test("the page never calls the Uplink one without widgets", () => {
  assert.doesNotMatch(buildClientlessReadme(declared), /widget/i);
});

test("an Uplink with no description has no page", () => {
  assert.throws(() => buildClientlessReadme({ ...declared, description: " " }), /no `description`/);
  assert.equal(clientlessDeclarationFaults(declared).length, 0);
});

test("every committed client-less page is current", () => {
  const root = join(fileURLToPath(import.meta.url), "../..");
  for (const name of ["actiongroupsextended", "contractconfigurator"]) {
    const dir = join(root, "uplinks", name);
    const written = readFileSync(join(dir, "README.md"), "utf8");
    assert.equal(written, buildClientlessReadme(JSON.parse(readFileSync(join(dir, "uplink.json"), "utf8"))));
  }
});
