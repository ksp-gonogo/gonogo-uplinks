import assert from "node:assert/strict";
import { existsSync, mkdirSync, mkdtempSync, readFileSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { test } from "node:test";
import { repointBuildProps, repointPackageJson, usePublishedPackages } from "./use-published-packages.mjs";

const manifest = {
  dependencies: { react: "^19.0.0", "@ksp-gonogo/ui-kit": "file:../../../vendor/ui-kit-0.1.0-abc.tgz" },
  devDependencies: {
    "@ksp-gonogo/sitrep-sdk": "file:../../../vendor/sdk.tgz",
    "@ksp-gonogo/uplink-tools": "file:../../../vendor/t.tgz",
  },
};

test("each vendored Gonogo dependency becomes the exact version, others are left", () => {
  const out = JSON.parse(repointPackageJson(JSON.stringify(manifest), "1.0.0-rc.27"));
  assert.equal(out.dependencies["@ksp-gonogo/ui-kit"], "1.0.0-rc.27");
  assert.equal(out.devDependencies["@ksp-gonogo/sitrep-sdk"], "1.0.0-rc.27");
  assert.equal(out.devDependencies["@ksp-gonogo/uplink-tools"], "1.0.0-rc.27");
  assert.equal(out.dependencies.react, "^19.0.0");
});

test("a manifest with nothing vendored is reported unchanged", () => {
  assert.equal(repointPackageJson('{"dependencies":{"react":"19"}}', "1.0.0-rc.1"), null);
});

test("the contract version moves, and a props file without one is refused", () => {
  const props =
    "<Project><PropertyGroup><GonogoContractVersion>1.0.0-pin.gabc</GonogoContractVersion></PropertyGroup></Project>";
  assert.match(repointBuildProps(props, "1.0.0-rc.27"), />1\.0\.0-rc\.27</);
  assert.throws(() => repointBuildProps("<Project/>", "1.0.0-rc.27"), /no GonogoContractVersion/);
});

test("a tree is rewritten, lockfiles go, nuget.org is the only feed, and a range is refused", () => {
  const root = mkdtempSync(join(tmpdir(), "published-"));
  const client = join(root, "uplinks", "demo", "client");
  mkdirSync(client, { recursive: true });
  mkdirSync(join(root, "uplinks", "nomod"), { recursive: true });
  writeFileSync(join(client, "package.json"), JSON.stringify(manifest));
  writeFileSync(join(client, "package-lock.json"), "{}");
  writeFileSync(
    join(root, "Directory.Build.props"),
    "<Project><PropertyGroup><GonogoContractVersion>1</GonogoContractVersion></PropertyGroup></Project>",
  );
  assert.deepEqual(usePublishedPackages(root, "1.0.0-rc.27"), ["demo"]);
  assert.equal(existsSync(join(client, "package-lock.json")), false);
  assert.doesNotMatch(readFileSync(join(root, "nuget.config"), "utf8"), /vendor/);
  assert.throws(() => usePublishedPackages(root, "^1.0.0"), /not an exact version/);
});
