import { describe, expect, it } from "vitest";
import { dismissalSamples, dismissalShare } from "./dismissalCost.js";

const YEAR = 31_557_600;

/** Appointed at 0, dismissal allowed after a month, free after ten years. */
const WINDOW = {
  activatedUt: 0,
  canRemoveFromUt: 30 * 86_400,
  freeToRemoveFromUt: 10 * YEAR,
};

describe("dismissalShare", () => {
  it("is a flat fifth until the least duration ends", () => {
    expect(dismissalShare(WINDOW, 0)).toBe(0.2);
    expect(dismissalShare(WINDOW, 30 * 86_400)).toBe(0.2);
  });

  it("follows RP-1's curve after it, whose argument is the time since appointment", () => {
    const elapsed = 3 * YEAR;
    const u = elapsed / (10 * YEAR - 30 * 86_400);
    const expected = 0.2 * (0.1 / (u * 0.5 + 0.1) - 0.15 * u);
    expect(dismissalShare(WINDOW, elapsed)).toBeCloseTo(expected, 12);
  });

  it("falls monotonically and is zero from the free instant", () => {
    const shares = [1, 2, 5, 9].map((y) => dismissalShare(WINDOW, y * YEAR));
    expect(shares).toEqual([...shares].sort((a, b) => b - a));
    expect(dismissalShare(WINDOW, 10 * YEAR)).toBe(0);
    expect(dismissalShare(WINDOW, 11 * YEAR)).toBe(0);
  });
});

describe("dismissalSamples", () => {
  it("takes the share of today's reputation at each date before the cost is zero", () => {
    const samples = dismissalSamples(WINDOW, 0, 1_000);
    expect(samples.map((s) => s.years)).toEqual([1, 2, 5]);
    expect(samples[0].reputation).toBeCloseTo(
      1_000 * dismissalShare(WINDOW, YEAR),
      9,
    );
  });

  it("offers no date that falls on or after the free instant", () => {
    const nearlyFree = { ...WINDOW, freeToRemoveFromUt: 1.5 * YEAR };
    expect(dismissalSamples(nearlyFree, 0, 1_000).map((s) => s.years)).toEqual([
      1,
    ]);
    expect(dismissalSamples(nearlyFree, 1.5 * YEAR, 1_000)).toEqual([]);
  });
});
