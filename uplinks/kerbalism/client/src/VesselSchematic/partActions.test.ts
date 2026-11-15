import type { InstrumentEntry } from "@ksp-gonogo/sitrep-sdk";
import { describe, expect, it } from "vitest";
import { computeKerbalismPartActions } from "./partActions.js";

/**
 * An instrument row taken through a JSON round-trip, so an unread field
 * arrives as the null the mod writes rather than as an omitted key.
 */
function instrument(
  fields: Record<string, unknown>,
  ext: Record<string, unknown> = {
    kind: "experiment",
    runningState: "Stopped",
  },
): InstrumentEntry {
  return JSON.parse(
    JSON.stringify({
      partId: "42",
      partName: "Mystery Goo Containment Unit",
      experimentId: "mysteryGoo",
      title: "Mystery Goo Observation",
      continuous: true,
      running: false,
      extensions: { kerbalism: ext },
      ...fields,
    }),
  );
}

describe("computeKerbalismPartActions", () => {
  it("offers Start for a stopped experiment, keyed by its part", () => {
    expect(computeKerbalismPartActions([instrument({})])).toEqual([
      {
        partId: "42",
        name: "mysteryGoo.start",
        label: "Start Mystery Goo Observation",
        group: "Science",
        active: true,
        command: "science.experiment.start",
        args: { partId: "42", experimentId: "mysteryGoo" },
      },
    ]);
  });

  it("offers Stop for a running experiment", () => {
    const [entry] = computeKerbalismPartActions([
      instrument(
        { running: true },
        { kind: "experiment", runningState: "Running" },
      ),
    ]);
    expect(entry.label).toBe("Stop Mystery Goo Observation");
    expect(entry.command).toBe("science.experiment.stop");
  });

  it("draws a broken experiment's button disabled rather than dropping it", () => {
    const [entry] = computeKerbalismPartActions([
      instrument({}, { kind: "experiment", runningState: "Broken" }),
    ]);
    expect(entry.active).toBe(false);
  });

  it("draws a button disabled when only the derived status says broken", () => {
    const [entry] = computeKerbalismPartActions([
      instrument(
        {},
        { kind: "experiment", runningState: "Stopped", expStatus: "Broken" },
      ),
    ]);
    expect(entry.active).toBe(false);
  });

  it("names the experiment by its id when the title did not resolve", () => {
    const [entry] = computeKerbalismPartActions([instrument({ title: null })]);
    expect(entry.label).toBe("Start mysteryGoo");
  });

  it("offers nothing for a state that is unknown", () => {
    expect(
      computeKerbalismPartActions([instrument({ running: null })]),
    ).toEqual([]);
  });

  it("leaves a stock instrument, a scanner and an unkeyed row alone", () => {
    expect(
      computeKerbalismPartActions([
        instrument({ extensions: undefined }),
        instrument({}, { kind: "scanner" }),
        instrument({ partId: null }),
        instrument({ experimentId: null }),
      ]),
    ).toEqual([]);
  });

  it("is empty with no instruments", () => {
    expect(computeKerbalismPartActions(undefined)).toEqual([]);
    expect(computeKerbalismPartActions(null)).toEqual([]);
  });
});
