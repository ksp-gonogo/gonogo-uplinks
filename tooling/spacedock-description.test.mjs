import assert from "node:assert/strict";
import { test } from "node:test";
import { buildEditFields, parseEditForm, renderDescription } from "./spacedock-description.mjs";

const ctx = { repo: "o/r", ref: "kos-v1.0.0", readmePath: "uplinks/kos/README.md" };

test("relative images and links become absolute, absolute ones stay", () => {
  const out = renderDescription("![a](docs/a.png) [b](../b.md) [c](https://x.test) [d](#top)", ctx);
  assert.match(out, /\(https:\/\/raw\.githubusercontent\.com\/o\/r\/kos-v1\.0\.0\/uplinks\/kos\/docs\/a\.png\)/);
  assert.match(out, /\(https:\/\/github\.com\/o\/r\/blob\/kos-v1\.0\.0\/uplinks\/b\.md\)/);
  assert.match(out, /\(https:\/\/x\.test\)/);
  assert.match(out, /blob\/kos-v1\.0\.0\/uplinks\/kos\/README\.md#top/);
});

test("details, img tags and comments are flattened", () => {
  const out = renderDescription('<!-- x -->\n<details><summary>More</summary>\n\nbody\n</details>\n<img src="p.png" width="9">', ctx);
  assert.doesNotMatch(out, /<details|<summary|<!--/);
  assert.match(out, /<img src="https:\/\/raw\.githubusercontent\.com\/o\/r\/kos-v1\.0\.0\/uplinks\/kos\/p\.png"/);
  assert.match(out, /\*\*More\*\*/);
});

test("the edit form keeps every field and replaces only the description", () => {
  const html = `<form action="/mod/1/x/edit"><input name="name" value="A"><input name="short-description" value="s"><input name="license" value="MIT"><input name="ml" type="checkbox" value="true" checked><input name="notifications" type="checkbox" value="2"><textarea name="description">old</textarea></form>`;
  assert.deepEqual(buildEditFields(parseEditForm(html), { description: "new" }), [
    ["name", "A"],
    ["short-description", "s"],
    ["license", "MIT"],
    ["ml", "true"],
    ["description", "new"],
  ]);
  assert.throws(() => parseEditForm("<html></html>"), /edit form/);
});

import { certifyEditForm, extractShort, inspectEditForm } from "./spacedock-description.mjs";

test("a form that disagrees with the listing, or lacks a control, writes nothing", () => {
  const html = (license) => `<form action="/m/1/x/edit"><input name="name" value="A"><input name="short-description" value="s"><input name="license" value="${license}"><input name="ml" type="checkbox" value="true"><input name="donation-link" value=""><input name="external-link" value=""><input name="source-link" value=""><textarea name="description">d</textarea></form>`;
  const listing = { name: "A", license: "MIT", short_description: "s", description: "d", donations: null, website: null, source_code: null };
  certifyEditForm(inspectEditForm(html("MIT")), listing);
  assert.throws(() => certifyEditForm(inspectEditForm(html("GPL")), listing), /license/);
  assert.throws(() => certifyEditForm(inspectEditForm('<form action="/x/edit"><input name="name" value="A"></form>'), listing), /no .*control/);
});

test("the short description comes only from an explicit marker", () => {
  assert.equal(extractShort("<!-- spacedock-short: Hi. -->"), "Hi.");
  assert.equal(extractShort("# T"), undefined);
});

import { certifyMl } from "./spacedock-description.mjs";

test("an unset ML/AI flag is never submitted, because the form would store it as ticked", () => {
  const form = { fields: [["ml", "true"]] };
  assert.throws(() => certifyMl(form, '<h2 title="None">'), /never set/);
  assert.throws(() => certifyMl(form, '<h2 title="False">'), /disagrees/);
  certifyMl(form, '<h2 title="True">');
});
