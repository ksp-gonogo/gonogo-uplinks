import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

// The "resolves to a core gonogo Value type" half of the uplink-types-out-of-core
// plan's Unit guard: a wire-visible Value<"..."> in this Uplink's OWN
// generated contract must still resolve to the core unit-system module
// (@ksp-gonogo/sitrep-sdk), never a locally hand-rolled Value type. See
// KosRtConfig.Configure's `valueImportFrom` argument, which is the mechanism
// this test verifies actually took effect in the emitted file, not just in the
// C# call site.
//
// This slice declares no quantity at all: every unit is a non-quantity token
// (id / text / flag / count) or sits on an inbound-only "...Args" type that
// ApplyUnitValueTypes deliberately skips. So the import must point at core and
// no property may use it; a Value<> appearing here is a new quantity, and the
// assertions below say where to record it.

const generatedContractPath = join(
  dirname(fileURLToPath(import.meta.url)),
  "__generated__/contract.ts",
);

const source = () => readFileSync(generatedContractPath, "utf8");

describe("generated contract.ts: Value usage resolves to core", () => {
  it("imports Value from @ksp-gonogo/sitrep-sdk and retypes no property", () => {
    const src = source();

    expect(src).toMatch(
      /import\s*\{\s*Value,\s*Vec3Of\s*\}\s*from\s*['"]@ksp-gonogo\/sitrep-sdk['"]/,
    );
    expect(src.replace(/^import.*$/m, "")).not.toMatch(/\b(Value|Vec3Of)</);
  });

  // The other side of the accounting, asserted rather than left as prose,
  // because "no Values here" is indistinguishable from "the retyping broke"
  // unless the reason is checked. A kOS CPU list is identifiers and state
  // names: there is no magnitude in it to carry, so every one of
  // KosProcessorInfo's six fields must stay a bare string/number/boolean even
  // though all six DO declare a unit.
  it("leaves the non-quantity tokens bare on the one Topic payload", () => {
    const src = source();
    const processorInfo = src.slice(
      src.indexOf("export interface KosProcessorInfo"),
      src.indexOf("export interface KosFilesListArgs"),
    );

    expect(processorInfo).toMatch(/coreId:\s*number;/);
    /* The one nullable field of the six, and the union is the point of it: the
       tag is null when the part carries no name-tag, which is not the same as a
       part whose tag nobody read. */
    expect(processorInfo).toMatch(/tag\?:\s*string \| null;/);
    expect(processorInfo).toMatch(/hasBooted:\s*boolean;/);
    expect(processorInfo).toMatch(/processorMode:\s*string;/);
    expect(processorInfo).not.toMatch(/Value</);
  });

  // Command args are wire-WRITES and are never wrapped: a widget
  // JSON-stringifies these straight to the mod, and there is no unwrap step
  // coming back. Seven of the ten types here are args, so this rule governs
  // most of this file's subject matter and gets its own assertion.
  it("leaves every inbound-only command-arg type bare", () => {
    const src = source();

    for (const name of [
      "KosRunArgs",
      "KosTerminalOpenArgs",
      "KosKeystrokeArgs",
      "KosTerminalResizeArgs",
      "KosTerminalCloseArgs",
    ]) {
      const start = src.indexOf(`export interface ${name}\n`);
      expect(
        start,
        `${name} missing from the generated contract`,
      ).toBeGreaterThan(-1);
      const body = src.slice(start, src.indexOf("}", start));
      expect(body, `${name} must not carry a Value<>`).not.toMatch(/Value</);
    }

    // KosTerminalResizeArgs is the sharp case: cols/rows declare Units.Count,
    // which is NOT a non-quantity token (RtConfig's NonQuantityUnits leaves
    // Count out deliberately), so these two would retype to Value<"count"> on
    // any other type. They stay bare purely because of the "...Args" rule, so
    // they are what proves that rule is still in force rather than merely
    // written down.
    expect(src).toMatch(/cols:\s*number;/);
    expect(src).toMatch(/rows:\s*number;/);
  });
});
