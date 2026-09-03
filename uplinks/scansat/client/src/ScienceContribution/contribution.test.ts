import {
  getAugmentsForSlot,
  getContributionsForSlot,
} from "@ksp-gonogo/sitrep-sdk";
import { describe, expect, it } from "vitest";
import { parseScanScience } from "./index";
// Importing the real module (not a throwaway test double) runs its module-load
// `SCANSAT.registerContribution(...)` exactly once: the same way the app picks
// this up via the package's bare `import "./ScienceContribution"`. So this
// suite deliberately never clears the registry before reading it, that would
// wipe the one real registration this file exists to exercise, and
// re-importing an already-evaluated ES module is a no-op so it would never
// come back.
import "./index";

const SCAN_WIRE = {
  partId: "42",
  partTitle: "SCANsat SAR Altimetry Sensor",
  expId: "SCANsatAltimetryHiRes",
  deployed: false,
  hasData: true,
  rerunnable: true,
  inoperable: false,
};

/** The one registration this module makes, found the way the host finds it. */
function registration() {
  const found = getContributionsForSlot("experiments.instruments");
  expect(found).toHaveLength(1);
  return found[0];
}

describe("SCANsat science: the experiments.instruments contribution", () => {
  it("registers against the host's instrument slot, presence-gated on scansat", () => {
    const def = registration();
    // Auto-namespaced by the client handle, so two Uplinks can never collide
    // on a local id.
    expect(def.id).toBe("scansat:science-instruments");
    expect(def.requires).toBe("scansat");
    expect(def.deps).toEqual(["scansat.science"]);
    // Attributed, which is what lets Experiments head the section with the
    // Uplink's name rather than a bare id.
    expect(def.owner?.name).toBe("SCANsat");
  });

  it("computes the vessel's SCANsat instruments off its own Topic", () => {
    const entries = registration().compute({ "scansat.science": [SCAN_WIRE] });
    expect(entries).toEqual([SCAN_WIRE]);
  });

  it("contributes an empty list rather than null when the Topic has not spoken", () => {
    // Nothing to say is an empty contribution, never a null the aggregation
    // has to interpret: SCANsat aboard with no scanner and SCANsat silent are
    // both "no instruments from us".
    expect(registration().compute({})).toEqual([]);
    expect(registration().compute({ "scansat.science": [] })).toEqual([]);
  });

  describe("parseScanScience", () => {
    it("returns null for a Topic that has not spoken, and for a non-array", () => {
      expect(parseScanScience(undefined)).toBeNull();
      expect(parseScanScience(null)).toBeNull();
      expect(parseScanScience({ partId: "1" })).toBeNull();
    });

    it("normalises the nullable wire to the slot's plain booleans", () => {
      expect(
        parseScanScience([
          { partId: "7", partTitle: null, expId: null, hasData: null },
        ]),
      ).toEqual([
        {
          partId: "7",
          partTitle: "Unknown part",
          expId: "",
          deployed: false,
          hasData: false,
          rerunnable: false,
          inoperable: false,
        },
      ]);
    });

    it("skips an entry with no partId, since the host keys its rows on one", () => {
      expect(parseScanScience([{ partTitle: "Nameless" }, SCAN_WIRE])).toEqual([
        SCAN_WIRE,
      ]);
    });
  });

  // A guard on the registry rather than on this module's source: the whole
  // point of the conversion is that SCANsat no longer RENDERS into Experiments,
  // so this Uplink must bind neither of the widget's augment slots. Grepping
  // the file for an import would not say this; the registry does.
  it("binds neither of Experiments's augment slots any more", () => {
    expect(getAugmentsForSlot("experiments.actions")).toEqual([]);
    expect(getAugmentsForSlot("experiments.instrument")).toEqual([]);
  });
});
