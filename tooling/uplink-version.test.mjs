/**
 * An Uplink's manifest reports the version it was built as, which a release
 * sets from its tag. A literal in the source is a second place that version can
 * be written, and the two stop agreeing the first time a release moves.
 */
import assert from "node:assert/strict";
import { readdirSync, readFileSync, statSync } from "node:fs";
import { dirname, join } from "node:path";
import { test } from "node:test";
import { fileURLToPath } from "node:url";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
const UPLINKS = join(ROOT, "uplinks");

/** A `Version = "..."` assignment, not a longer name that ends in Version. */
const LITERAL = /(^|[^\w.])Version\s*=\s*"/m;

function pluginSources(dir) {
  const out = [];
  for (const entry of readdirSync(dir)) {
    if (entry === "obj" || entry === "bin" || entry === "node_modules") continue;
    const path = join(dir, entry);
    if (statSync(path).isDirectory()) out.push(...pluginSources(path));
    else if (entry.endsWith(".cs") && !entry.endsWith(".g.cs")) out.push(path);
  }
  return out;
}

const plugins = readdirSync(UPLINKS).flatMap((id) => {
  const mod = join(UPLINKS, id, "mod");
  return statSync(join(UPLINKS, id)).isDirectory() && existsDir(mod)
    ? pluginSources(mod).map((file) => ({ id, file }))
    : [];
});

function existsDir(path) {
  try {
    return statSync(path).isDirectory();
  } catch {
    return false;
  }
}

test("no plugin source writes a version literal", () => {
  assert.ok(plugins.length > 50, "the walk found the plugin sources");
  const offenders = plugins
    .filter(({ file }) => LITERAL.test(readFileSync(file, "utf8")))
    .map(({ file }) => file.slice(ROOT.length + 1));
  assert.deepEqual(offenders, []);
});

test("every UplinkManifest takes its version from the build", () => {
  const manifests = plugins.filter(({ file }) =>
    /new UplinkManifest\b/.test(readFileSync(file, "utf8")),
  );
  assert.ok(manifests.length >= 12, "the walk found every manifest");
  for (const { id, file } of manifests) {
    assert.match(
      readFileSync(file, "utf8"),
      /Version = UplinkBuildVersion\.Value,/,
      `${id}: ${file.slice(ROOT.length + 1)}`,
    );
  }
});

test("the literal check would see a literal", () => {
  assert.ok(LITERAL.test('Id = "kos",\n    Version = "0.2.0",'));
  assert.ok(!LITERAL.test('const string ReadAgainstVersion = "FAR v1";'));
});
