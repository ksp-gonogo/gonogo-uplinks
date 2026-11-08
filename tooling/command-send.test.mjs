/**
 * A command is sent from a kit input, not from a bare call.
 *
 * `dangerouslySendWithoutInput` sends a command with nothing on screen showing
 * the operator that it went, except the panel's delay rail. A control the
 * operator presses takes the command through its `command` prop instead, so it
 * draws sent, refused and the rest. This holds the remaining bare sends in the
 * Uplink clients to an exact list: a file above its count, a file not on the
 * list and an entry whose file no longer reads the name all fail. Moving a file
 * off the list is part of migrating it.
 *
 * The name is unique and an alias has to spell it where it is taken (a
 * destructure, an element access), so a read of the name in code, with comments
 * and string prose set aside, sees every route to it.
 */
import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { test } from "node:test";
import { fileURLToPath } from "node:url";

const NAME = "dangerouslySendWithoutInput";

/** Each remaining bare send, its count, and why no kit input fits it. */
const SEND_WITHOUT_INPUT = {
  "uplinks/kerbcast/client/src/rootProvider.tsx": {
    reads: 1,
    why: "forwards the launch countdown the main screen computes, no press",
  },
  "uplinks/kos/client/src/KosTerminal/index.tsx": {
    reads: 4,
    why: "terminal keystrokes, open, close and resize: typed text and a lease, no button",
  },
  "uplinks/principia/client/src/PlanComposer/index.tsx": {
    reads: 1,
    why: "the upload control's own send, which wraps the draft send so a refusal reaches the button",
  },
  "uplinks/principia/client/src/planDrafts.ts": {
    reads: 1,
    why: "sends a saved draft for the composer's upload control, which owns the press",
  },
  "uplinks/rp1/client/src/VehicleAssembly/Buildable.tsx": {
    reads: 2,
    why: "price quote asked for on mount, no press",
  },
};

/** Tests, type-tests, generated code and build output, none of which ship. */
const EXCLUDED = /\/node_modules\/|\/dist\/|\.test\.|\.spec\.|\.test-d\.|__fixtures__|__generated__|\.g\.tsx?$/;

/**
 * The file floor, held well under the live number so ordinary movement never
 * trips it and only a broken walk does.
 */
const MINIMUM_FILES = 150;

const here = fileURLToPath(import.meta.url);
const root = execFileSync("git", ["rev-parse", "--show-toplevel"], {
  cwd: dirname(here),
  encoding: "utf8",
}).trim();

/** The source with line comments, block comments and the text of strings set aside. */
function codeOf(source) {
  return source
    .replace(/\/\*[\s\S]*?\*\//g, " ")
    .replace(/(^|[^:\\])\/\/[^\n]*/g, "$1")
    .replace(/`(?:[^`\\]|\\.)*`/g, "``")
    .replace(/"(?:[^"\\\n]|\\.)*"/g, (s) => (s === `"${NAME}"` ? s : '""'))
    .replace(/'(?:[^'\\\n]|\\.)*'/g, (s) => (s === `'${NAME}'` ? s : "''"));
}

/** How many times a source names the send, as an identifier or as an element access. */
export function readsOf(source) {
  const code = codeOf(source);
  const identifier = new RegExp(`\\b${NAME}\\b`, "g");
  return (code.match(identifier) ?? []).length;
}

/**
 * The failures for a set of counts against a list: a file above its count, a
 * file not on the list, and an entry that no longer reads the name or reads it
 * fewer times than it records.
 */
export function problemsOf(counts, list) {
  const out = [];
  for (const [file, reads] of [...counts].sort(([a], [b]) => a.localeCompare(b))) {
    const entry = list[file];
    if (!entry) {
      out.push(`${file}: ${reads} read(s) of ${NAME}, not on the list`);
    } else if (reads > entry.reads) {
      out.push(`${file}: ${reads} reads, the list allows ${entry.reads}`);
    }
  }
  for (const [file, entry] of Object.entries(list).sort(([a], [b]) => a.localeCompare(b))) {
    const reads = counts.get(file) ?? 0;
    if (reads === 0) {
      out.push(`${file}: stale, it no longer reads ${NAME}; remove the entry`);
    } else if (reads < entry.reads) {
      out.push(`${file}: stale, it reads ${NAME} ${reads} time(s) and the list says ${entry.reads}; lower the entry`);
    }
  }
  return out;
}

function walk() {
  const listed = execFileSync("git", ["ls-files", "uplinks"], { cwd: root, encoding: "utf8" })
    .split("\n")
    .filter((f) => /\/client\/src\/.*\.tsx?$/.test(f) && !EXCLUDED.test(`/${f}`));
  const counts = new Map();
  for (const file of listed) {
    const reads = readsOf(readFileSync(join(root, file), "utf8"));
    if (reads > 0) counts.set(file, reads);
  }
  return { filesWalked: listed.length, counts };
}

const walked = walk();

test("every send without a kit input is on the list, at its count", () => {
  assert.deepEqual(problemsOf(walked.counts, SEND_WITHOUT_INPUT), []);
});

test("every entry says why", () => {
  for (const [file, entry] of Object.entries(SEND_WITHOUT_INPUT)) {
    assert.ok(entry.why.trim().length > 0, file);
  }
});

test("walks enough files to be a real walk", () => {
  assert.ok(walked.filesWalked >= MINIMUM_FILES, `walked ${walked.filesWalked}`);
});

test("sees what it exists to see (BLIND otherwise)", () => {
  const plants = {
    onClick: `export const W = () => <button onClick={() => void cmd.${NAME}({})}>x</button>;`,
    destructure: `const { ${NAME} } = useCommand("a"); ${NAME}({});`,
    rename: `const { ${NAME}: send } = useCommand("a"); send({});`,
    alias: `const s = cmd.${NAME}; s({});`,
    "element access": `cmd["${NAME}"]({});`,
  };
  for (const [name, source] of Object.entries(plants)) {
    assert.ok(readsOf(source) > 0, `a ${name} read is not counted`);
  }
});

test("does not count the name in a comment, a string or a template", () => {
  assert.equal(readsOf(`// ${NAME}\n/* ${NAME} */\nconst a = "${NAME} is unsafe"; const b = \`${NAME}\`;`), 0);
});

test("fails a file above its count, a file not on the list and a stale entry", () => {
  const list = { "a.ts": { reads: 1, why: "x" } };
  assert.equal(problemsOf(new Map([["a.ts", 2]]), list).length, 1);
  assert.equal(problemsOf(new Map([["b.ts", 1]]), list).length, 2);
  assert.equal(problemsOf(new Map(), list).length, 1);
  assert.deepEqual(problemsOf(new Map([["a.ts", 1]]), list), []);
});
