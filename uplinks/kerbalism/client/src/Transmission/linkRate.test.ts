import { getContributionsForSlot, value } from "@ksp-gonogo/sitrep-sdk";
import { describe, expect, it } from "vitest";
import { kerbalismLinkRate } from "./linkRate.js";

describe("kerbalismLinkRate", () => {
  it("passes Kerbalism's rate in bits per second, with its target", () => {
    expect(
      kerbalismLinkRate({
        dataRate: value("bit/s", 144_000),
        target: "DSN: KSC",
      }),
    ).toEqual([{ bitsPerSec: 144_000, target: "DSN: KSC" }]);
  });

  it("leaves the target out when Kerbalism names none", () => {
    expect(
      kerbalismLinkRate({ dataRate: value("bit/s", 9_600), target: null }),
    ).toEqual([{ bitsPerSec: 9_600 }]);
  });

  it("draws nothing without a rate, and never a zero", () => {
    expect(kerbalismLinkRate({ dataRate: null, target: "Relay 1" })).toBeNull();
    expect(kerbalismLinkRate({})).toBeNull();
    expect(kerbalismLinkRate(undefined)).toBeNull();
  });

  it("carries the reading it came from so a held rate is drawn held", () => {
    const entries = kerbalismLinkRate(
      { dataRate: value("bit/s", 1) },
      "disconnected",
    );
    expect(entries?.[0]?.held).toBe("disconnected");
  });
});

describe("the contribution", () => {
  it("fills the link-rate slot at the default priority, so a more detailed comms mod can outrank it", async () => {
    await import("./linkRate.js");
    const mine = getContributionsForSlot("comm-signal.link-rate");
    const entry = mine.find((c) => c.id === "kerbalism:comm-signal-link-rate");
    expect(entry?.requires).toBe("kerbalism");
    expect(entry?.priority ?? 1).toBe(1);
  });
});
