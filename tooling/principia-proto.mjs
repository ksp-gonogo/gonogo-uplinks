/**
 * Checks a Principia release's public interface without its binary.
 *
 * Principia publishes no release assets, but `serialization/journal.proto` is
 * public at every release tag and the binary's embedded descriptor is generated
 * from it. A message or export the Uplink uses that is gone or reshaped between
 * the vetted release and a new one is exactly the break the Uplink's own
 * descriptor gate would meet in the game, found here before anyone installs it.
 */
import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";

const stripComments = (text) => text.replace(/\/\*[\s\S]*?\*\//g, " ").replace(/\/\/[^\n]*/g, "");

/** Every top-level `message` and `enum` of a proto file, by name, with its body normalised to one line of tokens. */
export function parseDeclarations(proto) {
  const text = stripComments(proto);
  const found = new Map();
  const head = /^(message|enum)\s+([A-Za-z0-9_]+)\s*\{/gm;
  let match;
  while ((match = head.exec(text)) !== null) {
    let depth = 1;
    let at = head.lastIndex;
    while (depth > 0 && at < text.length) {
      const ch = text[at++];
      if (ch === "{") depth++;
      else if (ch === "}") depth--;
    }
    found.set(match[2], text.slice(head.lastIndex, at - 1).replace(/\s+/g, " ").trim());
    head.lastIndex = at;
  }
  return found;
}

/** Names from `names` that the C# sources under `dir` mention as whole words. */
export function usedBy(names, dir) {
  const source = readdirSync(dir)
    .filter((file) => file.endsWith(".cs") && !file.endsWith(".g.cs"))
    .map((file) => readFileSync(join(dir, file), "utf8"))
    .join("\n");
  return [...names].filter((name) => new RegExp(`\\b${name}\\b`).test(source));
}

/**
 * What moved between the vetted copy and a new one: `removed` and `changed`
 * are limited to the declarations the Uplink uses, `added` is every new one.
 */
export function diffInterface(vetted, next, used) {
  const before = parseDeclarations(vetted);
  const after = parseDeclarations(next);
  const wanted = new Set(used);
  const removed = [];
  const changed = [];
  for (const [name, body] of before) {
    if (!wanted.has(name)) continue;
    if (!after.has(name)) removed.push(name);
    else if (after.get(name) !== body) changed.push(name);
  }
  const added = [...after.keys()].filter((name) => !before.has(name));
  return { removed: removed.sort(), changed: changed.sort(), added: added.sort() };
}

/** One sentence naming what moved, or undefined when nothing the Uplink uses did. */
export function describeMoves({ removed, changed }, vettedName, newName) {
  if (removed.length === 0 && changed.length === 0) return undefined;
  const parts = [];
  if (removed.length > 0) parts.push(`${removed.join(", ")} ${removed.length === 1 ? "is" : "are"} gone`);
  if (changed.length > 0) parts.push(`${changed.join(", ")} ${changed.length === 1 ? "has" : "have"} a different shape`);
  return `Principia ${newName} changes the interface this Uplink calls against ${vettedName}: ${parts.join("; ")} in serialization/journal.proto.`;
}
