import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

// The "resolves to a core gonogo Value type" half of the uplink-types-out-of-core
// plan's Unit guard: a wire-visible Value<"..."> / Vec3Of<"..."> in
// this Uplink's OWN generated contract must still resolve to the core
// unit-system module (@ksp-gonogo/sitrep-sdk), never a locally hand-rolled
// Value type. See ScansatRtConfig.Configure's `valueImportFrom` argument,
// which is the mechanism this test verifies actually took effect in the
// emitted file, not just in the C# call site.
//
// NOT vacuous: ScanningVesselEntry's five degree/metre properties
// (subLatitude/subLongitude/altitude/groundTrackWidthDeg/
// groundTrackLonHalfDeg), ScanSensorEntry's four (fov + minAlt/maxAlt/bestAlt),
// ScanTrackColor's four count channels and ScanAnomalyEntry's latitude/longitude
// all genuinely retype to Value<...> (see ../__generated__/contract.ts). No type
// in this set is an inbound-only "...Args" for ApplyUnitValueTypes to skip (the
// case some earlier relocations had; see the plan doc), so every one of the five
// types contributes.

const generatedContractPath = join(
  dirname(fileURLToPath(import.meta.url)),
  "__generated__/contract.ts",
);

describe("generated contract.ts: Value/Vec3Of usage resolves to core", () => {
  it("imports Value/Vec3Of from @ksp-gonogo/sitrep-sdk whenever either is used", () => {
    const source = readFileSync(generatedContractPath, "utf8");
    const usesValueOrVec3Of = /\b(Value|Vec3Of)</.test(
      source.replace(/^import.*$/m, ""), // strip the import line itself before checking USAGE
    );

    // Not vacuous: the degree/metre/count fields across all five types make this true.
    expect(usesValueOrVec3Of).toBe(true);

    expect(source).toMatch(
      /import\s*\{\s*Value,\s*Vec3Of\s*\}\s*from\s*['"]@ksp-gonogo\/sitrep-sdk['"]/,
    );
  });

  // The nesting is what makes this relocation different from its three
  // predecessors, and it is the thing a regenerated contract could quietly
  // flatten (a future edit dropping ScanningVesselEntry.Sensors, say). If the
  // nested types stop being referenced from the parent, topics.test.ts's
  // nested-decode assertion goes vacuous rather than red, so pin the shape.
  it("keeps ScanningVesselEntry nesting the sensor and track-colour shapes", () => {
    const source = readFileSync(generatedContractPath, "utf8");

    // Nullability optional in both, for the reason given for minAlt below.
    expect(source).toMatch(/sensors\?:\s*ScanSensorEntry\[\](?:\s*\|\s*null)?;/);
    expect(source).toMatch(/trackColor\?:\s*ScanTrackColor(?:\s*\|\s*null)?;/);
    // The deepest declared quantities on the SCANsat surface: if these ever
    // stop being Value<"m">, the nested-hydration path has nothing left to prove.
    //
    // The `| null` is optional in the pattern rather than required, because what
    // is being pinned is the UNIT-CARRYING type and not its nullability. Codegen
    // widens a nullable value-typed member to `Value<"m"> | null` so the type can
    // hold the null the wire sends; that is a different property, guarded
    // elsewhere, and a pattern that demanded it here would fail the day a member
    // legitimately became non-nullable.
    expect(source).toMatch(/minAlt\?:\s*Value<"m">(?:\s*\|\s*null)?;/);
    expect(source).toMatch(/bestAlt\?:\s*Value<"m">(?:\s*\|\s*null)?;/);
  });
});
