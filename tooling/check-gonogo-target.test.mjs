import assert from "node:assert/strict";
import { mkdirSync, mkdtempSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { test } from "node:test";
import {
  compatOf,
  contractStamp,
  inspect,
  pinnedGonogo,
  problemsFor,
  restoredStamp,
  summaryFor,
} from "./check-gonogo-target.mjs";

const pinned = {
  apiVersion: "7.0.0",
  contract: "52.2",
  stamp: "52.2",
  sdkVersion: "1.0.0",
  packageVersion: "1.0.0",
};
const client = { apiVersion: "7.0.0", contractMajor: 52, contractMinor: 2 };

const dllWith = (stamp) =>
  Buffer.concat([
    Buffer.from("xx"),
    Buffer.from("SitrepContractVersion"),
    Buffer.from([stamp.length]),
    Buffer.from(stamp),
  ]);

test("a client built for the pinned version, with a matching mod, has no problems", () => {
  assert.deepEqual(problemsFor("kos", pinned, { client, mod: { stamp: "52.2" } }), []);
});

test("a client built for another major is refused and names the Uplink and both versions", () => {
  const problems = problemsFor("kos", pinned, { client: { ...client, apiVersion: "6.0.0" } });
  assert.equal(problems.length, 1);
  assert.match(problems[0], /^kos: the client was built for extension API 6\.0\.0 .*pins Gonogo 1\.0\.0 \(extension API 7\.0\.0\)/);
});

test("a client that records no apiVersion is refused", () => {
  const { apiVersion, ...bare } = client;
  assert.deepEqual(problemsFor("kos", pinned, { client: bare }), [
    "kos: gonogo-uplink.json records no apiVersion, so the client's target cannot be shown",
  ]);
});

test("a client and a mod on another contract are refused", () => {
  const problems = problemsFor("kos", pinned, {
    client: { ...client, contractMinor: 1 },
    mod: { stamp: "51.0" },
  });
  assert.equal(problems.length, 2);
  assert.match(problems[0], /contract 52\.1 and the pin is contract 52\.2/);
  assert.match(problems[1], /mod was built against contract 51\.0 .* is contract 52\.2/);
});

test("an Uplink with no client or no mod is judged on the half it has", () => {
  assert.deepEqual(problemsFor("x", pinned, { client: undefined, mod: { stamp: "52.2" } }), []);
  assert.deepEqual(problemsFor("x", pinned, { client, mod: undefined }), []);
});

test("the summary says what was built for and what was pinned", () => {
  const text = summaryFor("kos", pinned, { client, mod: { stamp: "52.2" } });
  assert.match(text, /client built for \| extension API 7\.0\.0, contract 52\.2/);
  assert.match(text, /pinned \| Gonogo packages 1\.0\.0 \/ 1\.0\.0: extension API 7\.0\.0, contract 52\.2/);
});

test("the stamp and the compat constants are read from their files' own text", () => {
  assert.equal(contractStamp(dllWith("52.2")), "52.2");
  assert.equal(contractStamp(Buffer.from("nothing")), undefined);
  assert.deepEqual(
    compatOf('export const EXTENSION_API_VERSION = "7.0.0";\nexport const CONTRACT_MAJOR = 52;\nexport const CONTRACT_MINOR = 3;'),
    { apiVersion: "7.0.0", contract: "52.3" },
  );
  assert.equal(compatOf("export const CONTRACT_MAJOR = 52;"), undefined);
});

test("a mod that was not restored is refused, and a restored one gives its stamp", () => {
  const root = mkdtempSync(join(tmpdir(), "gonogo-target-"));
  assert.throws(() => restoredStamp(join(root, "mod")), /does not exist/);

  const folder = join(root, "packages");
  const lib = join(folder, "kspgonogo.sitrep.contract", "1.0.0", "lib", "net472");
  mkdirSync(lib, { recursive: true });
  writeFileSync(join(lib, "Sitrep.Contract.dll"), dllWith("52.1"));
  mkdirSync(join(root, "mod", "obj"), { recursive: true });
  writeFileSync(
    join(root, "mod", "obj", "project.assets.json"),
    JSON.stringify({
      libraries: { "KspGonogo.Sitrep.Contract/1.0.0": { path: "kspgonogo.sitrep.contract/1.0.0" } },
      packageFolders: { [folder]: {} },
    }),
  );
  assert.deepEqual(restoredStamp(join(root, "mod")), { stamp: "52.1", version: "1.0.0" });
});

test("the vendored packages give a pin, and an Uplink's own manifest is read against it", () => {
  const found = pinnedGonogo();
  assert.match(found.apiVersion, /^\d+\.\d+\.\d+$/);
  assert.match(found.stamp, /^\d+\.\d+$/);
  assert.equal(found.contract, found.stamp);
  const { client: kosClient } = inspect("kos");
  assert.ok(kosClient, "the kos client manifest was found");
});
