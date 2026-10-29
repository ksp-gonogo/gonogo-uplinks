import assert from "node:assert/strict";
import { existsSync, mkdirSync, mkdtempSync, readFileSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { test } from "node:test";
import { findTarballs, repointToTarballs, usePackedGonogo } from "./use-packed-gonogo.mjs";

const NAMES = ["ksp-gonogo-sitrep-sdk-1.0.0-ci.abc.tgz", "ksp-gonogo-ui-kit-1.0.0-ci.abc.tgz", "ksp-gonogo-uplink-tools-1.0.0-ci.abc.tgz"];

function packedDir() {
  const dir = mkdtempSync(join(tmpdir(), "packed-"));
  for (const f of NAMES) writeFileSync(join(dir, f), "");
  writeFileSync(join(dir, "KspGonogo.Sitrep.Contract.1.0.0-ci.abc.nupkg"), "");
  writeFileSync(join(dir, "contract-version.txt"), "1.0.0-ci.abc\n");
  return dir;
}

const manifest = {
  dependencies: { react: "^19.0.0", "@ksp-gonogo/ui-kit": "file:../../../vendor/ui-kit-0.1.0-abc.tgz" },
  devDependencies: { "@ksp-gonogo/sitrep-sdk": "file:../../../vendor/sdk.tgz" },
};

test("each vendored dependency points at its packed tarball, and every sibling is overridden to it", () => {
  const tarballs = findTarballs(packedDir());
  const out = JSON.parse(repointToTarballs(JSON.stringify(manifest), tarballs));
  assert.equal(out.dependencies["@ksp-gonogo/ui-kit"], `file:${tarballs["@ksp-gonogo/ui-kit"]}`);
  assert.equal(out.overrides["@ksp-gonogo/uplink-tools"], `file:${tarballs["@ksp-gonogo/uplink-tools"]}`);
  assert.equal(out.dependencies.react, "^19.0.0");
});

test("a manifest with nothing vendored is reported unchanged", () => {
  assert.equal(repointToTarballs('{"dependencies":{"react":"19"}}', findTarballs(packedDir())), null);
});

test("a missing or doubled tarball is refused", () => {
  const dir = packedDir();
  writeFileSync(join(dir, "ksp-gonogo-ui-kit-1.0.0-ci.def.tgz"), "");
  assert.throws(() => findTarballs(dir), /2 tarball/);
  assert.throws(() => findTarballs(mkdtempSync(join(tmpdir(), "empty-"))), /0 tarball/);
});

test("a tree is rewritten, the old contract package is replaced and the version moves", () => {
  const root = mkdtempSync(join(tmpdir(), "packed-root-"));
  const client = join(root, "uplinks", "demo", "client");
  mkdirSync(client, { recursive: true });
  mkdirSync(join(root, "vendor", "nuget"), { recursive: true });
  writeFileSync(join(root, "vendor", "nuget", "KspGonogo.Sitrep.Contract.1.0.0-pin.gold.nupkg"), "");
  writeFileSync(join(client, "package.json"), JSON.stringify(manifest));
  writeFileSync(join(client, "package-lock.json"), "{}");
  writeFileSync(
    join(root, "Directory.Build.props"),
    "<Project><PropertyGroup><GonogoContractVersion>1</GonogoContractVersion></PropertyGroup></Project>",
  );
  const result = usePackedGonogo(root, packedDir());
  assert.deepEqual(result, { touched: ["demo"], version: "1.0.0-ci.abc" });
  assert.equal(existsSync(join(client, "package-lock.json")), false);
  assert.equal(existsSync(join(root, "vendor", "nuget", "KspGonogo.Sitrep.Contract.1.0.0-pin.gold.nupkg")), false);
  assert.equal(existsSync(join(root, "vendor", "nuget", "KspGonogo.Sitrep.Contract.1.0.0-ci.abc.nupkg")), true);
  assert.match(readFileSync(join(root, "Directory.Build.props"), "utf8"), />1\.0\.0-ci\.abc</);
});
