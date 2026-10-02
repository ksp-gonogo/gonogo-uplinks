import { enumerateTopicFields } from "@ksp-gonogo/sitrep-sdk";
import { describe, expect, it } from "vitest";
import "./topics.js";

describe("rp1 enum registration", () => {
  it("offers an ordinal enum field with the member names its table carries", () => {
    const facility = enumerateTopicFields("rp1.buildable").find(
      (f) => f.path === "facility",
    );
    expect(facility?.enumEncoding).toEqual({
      by: "ordinal",
      names: { 0: "None", 1: "VAB", 2: "SPH" },
    });
  });

  it("offers a name-carrying enum field as one that is already its member name", () => {
    const lock = enumerateTopicFields("rp1.avionics").find(
      (f) => f.path === "lockLevel",
    );
    expect(lock?.enumEncoding).toEqual({ by: "name" });
  });
});
