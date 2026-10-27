import { getContributionsForSlot, value } from "@ksp-gonogo/sitrep-sdk";
import { describe, expect, it } from "vitest";
import { scienceTransmittedReadouts } from "./scienceTransmitted.js";

describe("scienceTransmittedReadouts", () => {
  it("draws the reported total as a science figure labelled Transmitted", () => {
    const [entry] =
      scienceTransmittedReadouts({ scienceTransmitted: value("science", 42.5) }) ??
      [];
    expect(entry?.label).toBe("Transmitted");
    expect(entry?.value).toEqual(value("science", 42.5));
  });

  it("keeps a total of zero, which is a measured nothing sent", () => {
    const entries = scienceTransmittedReadouts({
      scienceTransmitted: value("science", 0),
    });
    expect(entries).toHaveLength(1);
  });

  it("draws nothing when Kerbalism reported no total, rather than a zero", () => {
    expect(scienceTransmittedReadouts({ scienceTransmitted: null })).toBeNull();
    expect(scienceTransmittedReadouts({})).toBeNull();
    expect(scienceTransmittedReadouts(undefined)).toBeNull();
  });

  it("carries the reading it was drawn from so a held total is drawn held", () => {
    const entries = scienceTransmittedReadouts(
      { scienceTransmitted: value("science", 1) },
      "held",
    );
    expect(entries?.[0]?.held).toBe("held");
  });
});

describe("the contribution", () => {
  it("is registered against the Archive readouts slot for the Kerbalism Domain", async () => {
    await import("./scienceTransmitted.js");
    const mine = getContributionsForSlot("science-data.archive-readouts");
    expect(mine.map((c) => c.id)).toContain("kerbalism:science-transmitted");
    expect(mine.find((c) => c.id === "kerbalism:science-transmitted")?.requires).toBe(
      "kerbalism",
    );
  });
});
