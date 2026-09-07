import { describe, expect, it } from "vitest";
import {
  computeScanScienceInstruments,
  parseScanScience,
  type ScienceInstrumentTopics,
} from "./index.js";

/**
 * One SCANsat scanner as the mod puts it on the wire: every lifecycle flag at
 * the value `ScanScience.Build` hard-codes, so the row it produces is the one
 * an operator actually sees.
 */
const SCAN_ENTRY = {
  partId: "42",
  partTitle: "SCANsat SAR Altimetry Sensor",
  expId: "SCANsatAltimetryHiRes",
  deployed: false,
  hasData: true,
  rerunnable: true,
  inoperable: false,
};

function topicsWith(science: unknown): ScienceInstrumentTopics {
  return { "scansat.science": science } as ScienceInstrumentTopics;
}

describe("parseScanScience", () => {
  it("normalises a wire entry into the slot's row shape", () => {
    expect(parseScanScience([SCAN_ENTRY])).toEqual([SCAN_ENTRY]);
  });

  it("reads a missing flag as false rather than as unknown", () => {
    // The slot takes plain booleans on purpose: the host draws a badge per flag
    // and has no third state to draw, so an absent flag has to be decided here.
    expect(parseScanScience([{ partId: "7" }])).toEqual([
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

  it("skips an entry with no partId", () => {
    // partId is the row's React key and the host's identity for it. An entry
    // without one cannot be drawn, and inventing a key would make two of them
    // collide.
    expect(parseScanScience([{ partTitle: "Nameless" }, SCAN_ENTRY])).toEqual([
      SCAN_ENTRY,
    ]);
  });

  it("contributes nothing for a frame that is not a list", () => {
    expect(parseScanScience(null)).toBeNull();
    expect(parseScanScience(undefined)).toBeNull();
    expect(parseScanScience({ partId: "42" })).toBeNull();
  });
});

describe("computeScanScienceInstruments", () => {
  it("contributes the vessel's scanners", () => {
    expect(computeScanScienceInstruments(topicsWith([SCAN_ENTRY]))).toEqual([
      SCAN_ENTRY,
    ]);
  });

  it("contributes nothing before scansat.science has arrived", () => {
    expect(computeScanScienceInstruments(topicsWith(undefined))).toBeNull();
  });

  it("contributes nothing on a vessel with no scanners", () => {
    expect(computeScanScienceInstruments(topicsWith([]))).toEqual([]);
  });
});
