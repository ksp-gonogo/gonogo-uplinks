#!/usr/bin/env node
/**
 * Every Uplink's vendored dependency must name bytes that are actually here,
 * and no two Uplinks may be re-pointed by one refresh.
 *
 * ## What went wrong without this
 *
 * `vendor/` was one global snapshot: `ksp-gonogo-ui-kit-0.2.0.tgz`, one file,
 * referenced by every client through a `file:` path. Refreshing it for an
 * ARRIVING Uplink therefore re-pointed every Uplink already here, at bytes
 * their lockfiles did not describe. Measured on this repo: kerbcast's arrival
 * left `example` and `scansat` installing kerbcast's ui-kit while their
 * lockfiles recorded a different sha512, and scansat's `uplink-page.test.ts`
 * went red for a generator wording change nobody in scansat had made.
 *
 * The version number cannot be the discriminator. These are packed from a
 * workspace whose versions deliberately do not move, so `0.2.0` names several
 * different sets of bytes over time, and `0.0.1` of the sdk is not even the
 * `0.0.1` on npm. Content is the only thing left, so the sha256 goes in the
 * filename.
 *
 * ## Why a filename hash and not the lockfile
 *
 * The lockfile already records a sha512 per Uplink and it is NOT enforcement:
 * npm does not verify integrity for a `file:` dependency. Measured here, with
 * the mismatch above in place, `npm ci` installed the wrong bytes and exited 0.
 * So the lockfile's integrity is a record, and the filename is the pin: a
 * refresh writes a NEW name and cannot overwrite an existing one, so an Uplink
 * moves only when its own package.json is edited to say so.
 *
 * ## What this asserts
 *
 * 1. Every `file:` reference to `vendor/` resolves to a file that exists
 * 2. That file's content hash matches the hash in its own name
 * 3. Each reference matches the sha512 its Uplink's lockfile records for it
 * 4. Every vendored tarball is named content-addressed, so none can be a
 *    stable-name file waiting to be overwritten
 * 5. It found Uplinks and references at all, because a walk that finds nothing
 *    reports no violations and reads exactly like a clean repo
 *
 * Unreferenced tarballs are REPORTED, never failed: an Uplink mid-upgrade
 * legitimately leaves the old one behind for the others.
 *
 * Usage: node scripts/check-vendor-pins.mjs
 */

import { createHash } from "node:crypto";
import { existsSync, readFileSync, readdirSync } from "node:fs";
import { basename, dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
const VENDOR = join(ROOT, "vendor");

/** Below the current count, far above zero: a deliberate removal must not trip it, a broken walk must. */
const MINIMUM_UPLINKS = 2;
const MINIMUM_REFERENCES = 4;

const NAME = /^(.+)-([0-9a-f]{12})\.tgz$/;

const sha256 = (file) =>
  createHash("sha256").update(readFileSync(file)).digest("hex").slice(0, 12);
const sha512 = (file) =>
  `sha512-${createHash("sha512").update(readFileSync(file)).digest("base64")}`;

const problems = [];
const referenced = new Set();
let uplinks = 0;
let references = 0;

for (const name of readdirSync(join(ROOT, "uplinks")).sort()) {
  const clientDir = join(ROOT, "uplinks", name, "client");
  const pkgPath = join(clientDir, "package.json");
  if (!existsSync(pkgPath)) continue;
  uplinks += 1;

  const pkg = JSON.parse(readFileSync(pkgPath, "utf8"));
  const lockPath = join(clientDir, "package-lock.json");
  const lock = existsSync(lockPath)
    ? JSON.parse(readFileSync(lockPath, "utf8"))
    : null;

  if (!lock) {
    problems.push(
      `${name}: no package-lock.json, so nothing records which bytes it was built against.`,
    );
  }

  for (const section of ["dependencies", "devDependencies"]) {
    for (const [dep, spec] of Object.entries(pkg[section] ?? {})) {
      if (typeof spec !== "string" || !spec.startsWith("file:")) continue;
      references += 1;

      const target = resolve(clientDir, spec.slice("file:".length));
      const file = basename(target);
      referenced.add(file);

      if (!existsSync(target)) {
        problems.push(
          `${name} -> ${dep}: ${spec} does not exist. A fresh clone cannot install this client.`,
        );
        continue;
      }

      const named = NAME.exec(file);
      if (!named) {
        problems.push(
          `${name} -> ${dep}: ${file} is not content-addressed. A stable filename is one a ` +
            `refresh overwrites in place, which re-points every Uplink referencing it.`,
        );
      } else if (named[2] !== sha256(target)) {
        problems.push(
          `${name} -> ${dep}: ${file} claims ${named[2]} and its content hashes to ` +
            `${sha256(target)}. The file has been overwritten since it was named.`,
        );
      }

      const entry = lock?.packages?.[`node_modules/${dep}`];
      if (entry?.integrity && entry.integrity !== sha512(target)) {
        problems.push(
          `${name} -> ${dep}: the lockfile records ${entry.integrity.slice(0, 24)}… and ${file} ` +
            `hashes to ${sha512(target).slice(0, 24)}…. npm does not check this for a file: ` +
            `dependency, so it would install the wrong bytes and exit 0.`,
        );
      }
    }
  }
}

for (const file of existsSync(VENDOR) ? readdirSync(VENDOR).sort() : []) {
  if (!file.endsWith(".tgz")) continue;
  if (!NAME.test(file)) {
    problems.push(
      `vendor/${file} is not content-addressed, so a refresh can overwrite it in place.`,
    );
  } else if (!referenced.has(file)) {
    console.log(`ℹ vendor/${file} is referenced by no Uplink (fine mid-upgrade).`);
  }
}

if (uplinks < MINIMUM_UPLINKS || references < MINIMUM_REFERENCES) {
  console.error(
    `✖ walked ${uplinks} Uplink(s) and ${references} vendored reference(s), expected at least ` +
      `${MINIMUM_UPLINKS} and ${MINIMUM_REFERENCES}. Every assertion here walks that set, so ` +
      `finding nothing reports no violations and is indistinguishable from a clean repo.`,
  );
  process.exit(1);
}

if (problems.length > 0) {
  console.error(`✖ ${problems.length} vendor pin problem(s):`);
  for (const p of problems) console.error(`    ${p}`);
  console.error(
    "\nRefreshing a vendored artefact means adding a NEW content-addressed file and editing the " +
      "package.json of the Uplink you intend to move, then reinstalling so its lockfile agrees. " +
      "It never means overwriting a file the other Uplinks resolve.",
  );
  process.exit(1);
}

console.log(
  `✓ ${references} vendored reference(s) across ${uplinks} Uplink(s): every one exists, is ` +
    `content-addressed, matches its own name and matches the sha512 its lockfile records.`,
);
