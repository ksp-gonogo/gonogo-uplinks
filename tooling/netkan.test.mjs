import assert from "node:assert/strict";
import { readFileSync, readdirSync } from "node:fs";
import { dirname, join } from "node:path";
import { test } from "node:test";
import { fileURLToPath } from "node:url";
import { uplinkNames } from "./check-built-against.mjs";
import { internalCkan, readUplink } from "./internal-ckan.mjs";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");

function netkanOf(name) {
  const { uplink } = readUplink(name);
  const path = join(ROOT, "uplinks", name, `${uplink.gamedata}.netkan`);
  return { uplink, netkan: JSON.parse(readFileSync(path, "utf8")) };
}

function licenseOf(name) {
  const dir = join(ROOT, "uplinks", name, "mod");
  const csproj = readdirSync(dir).find((file) => file.endsWith(".csproj"));
  const expression = /<PackageLicenseExpression>([^<]*)/.exec(readFileSync(join(dir, csproj), "utf8"))[1];
  return expression.replace(/-only$/, "");
}

test("every Uplink has a netkan named for its GameData folder, with the release asset it ships", () => {
  for (const name of uplinkNames()) {
    const { uplink, netkan } = netkanOf(name);
    assert.equal(netkan.identifier, uplink.gamedata, name);
    assert.equal(
      netkan.$kref,
      `#/ckan/github/ksp-gonogo/gonogo-uplinks/asset_match/^${uplink.gamedata}\\.zip$`,
      name,
    );
    assert.equal(netkan.x_netkan_github.prereleases, false, name);
    assert.deepEqual(netkan.install, [{ file: `GameData/${uplink.gamedata}`, install_to: "GameData" }], name);
    const version = new RegExp(netkan.x_netkan_version_edit.find).exec(`${uplink.id}-v1.2.3`);
    assert.equal(version?.groups.version, "1.2.3", `${name}: the version edit must strip the release tag's prefix`);
  }
});

test("the version edit's prefix is the Uplink's id, the way prepare-release names the tag", () => {
  for (const name of uplinkNames()) {
    const { uplink, netkan } = netkanOf(name);
    assert.ok(
      netkan.x_netkan_version_edit.find.startsWith(`^${uplink.id}-`),
      `${name}: the tag is ${uplink.id}-v<version>, the netkan reads ${netkan.x_netkan_version_edit.find}`,
    );
  }
});

test("a netkan carries no relationships: the .ckan inside the release zip is the one source", () => {
  for (const name of uplinkNames()) {
    const { netkan } = netkanOf(name);
    for (const key of ["depends", "recommends", "suggests", "conflicts", "supports"]) {
      assert.equal(key in netkan, false, `${name}: the netkan declares ${key}, which would override the .ckan in the zip`);
    }
  }
});

test("the generated .ckan carries Gonogo and the wrapped mod at the version the Uplink was built against", () => {
  for (const name of uplinkNames()) {
    const facts = readUplink(name);
    const { depends } = internalCkan(facts);
    assert.equal(depends.at(-1).name, "Gonogo", name);
    if (facts.uplink.mod?.ckan) {
      const wrapped = depends.find((dep) => dep.name === facts.uplink.mod.ckan);
      const builtAgainst = facts.manifest?.mod?.builtAgainst ?? facts.uplink.mod.builtAgainst;
      assert.equal(wrapped?.min_version, facts.uplink.mod.ckanVersion ?? builtAgainst, name);
    }
  }
});

test("a netkan declares the license of the Uplink's own plugin", () => {
  for (const name of uplinkNames()) {
    assert.equal(netkanOf(name).netkan.license, licenseOf(name), name);
  }
});
