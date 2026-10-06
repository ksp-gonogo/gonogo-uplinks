import type { HeldGrade } from "@ksp-gonogo/sitrep-sdk";
import { describe, expect, it } from "vitest";
import { outOfContactReason } from "./planReading.js";

describe("why a held flight plan stopped updating", () => {
  const grades: readonly HeldGrade[] = [
    "held",
    "disconnected",
    "last-before-blackout",
    "recorded",
    "loading",
    "no-game",
  ];

  it("has words for every grade, each its own", () => {
    const reasons = grades.map(outOfContactReason);
    for (const reason of reasons) expect(reason).toMatch(/burns below/);
    expect(new Set(reasons).size).toBe(grades.length);
  });

  it("says the game is loading, or that none is loaded, where that is why", () => {
    expect(outOfContactReason("loading")).toMatch(/game is loading a scene/);
    expect(outOfContactReason("no-game")).toMatch(/No game is loaded/);
  });
});
