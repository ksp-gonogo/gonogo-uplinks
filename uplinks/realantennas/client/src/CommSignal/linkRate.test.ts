import { getContributionsForSlot, value } from "@ksp-gonogo/sitrep-sdk";
import { describe, expect, it } from "vitest";
import type { CommsDataRate } from "../__generated__/contract.js";
import { realAntennasLinkRate } from "./linkRate.js";

const rate = (down: number | undefined): CommsDataRate =>
  ({
    upBitsPerSec: value("bit/s", 1),
    downBitsPerSec: down === undefined ? undefined : value("bit/s", down),
  }) as CommsDataRate;

describe("realAntennasLinkRate", () => {
  it("passes the downlink rate in bits per second and names no target", () => {
    expect(realAntennasLinkRate(rate(262_000))).toEqual([
      { bitsPerSec: 262_000 },
    ]);
  });

  it("draws nothing without a rate", () => {
    expect(realAntennasLinkRate(rate(undefined))).toBeNull();
    expect(realAntennasLinkRate(undefined)).toBeNull();
  });
});

describe("the contribution", () => {
  it("fills the link-rate slot above the default priority so it wins when another Uplink fills it too", async () => {
    await import("./linkRate.js");
    const mine = getContributionsForSlot("comm-signal.link-rate");
    const entry = mine.find(
      (c) => c.id === "realantennas:comm-signal-link-rate",
    );
    expect(entry?.requires).toBe("realantennas");
    expect(entry?.priority).toBe(2);
  });
});
