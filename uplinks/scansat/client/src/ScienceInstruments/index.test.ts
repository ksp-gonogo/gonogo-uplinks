import { describe, expect, it } from "vitest";
import {
  computeScanScienceInstruments,
  parseScanScience,
  SCAN_SCIENCE_READING_ID,
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

/** The bag with `scansat.science` observed, or held when `held` is set. */
function topicsWith(
  science: unknown,
  held = false,
): ScienceInstrumentTopics {
  const reading = held
    ? {
        state: "held",
        value: science,
        grade: "disconnected",
        reckoning: { status: "none" },
      }
    : { state: "observed", value: science, reckoning: { status: "none" } };
  return {
    "scansat.science": science,
    [SCAN_SCIENCE_READING_ID]: reading,
  } as unknown as ScienceInstrumentTopics;
}

describe("parseScanScience", () => {
  it("normalises a wire entry into the slot's row shape", () => {
    expect(parseScanScience([SCAN_ENTRY])).toEqual([SCAN_ENTRY]);
  });

  it("declines the frame rather than reading a missing flag as false", () => {
    // The slot takes plain booleans and the host widget draws a badge per flag, so a
    // row has no third state for "nobody read this". `=== true` decided it as
    // OFF, and an absent `rerunnable` in particular drew a ONE-SHOT badge on a
    // scanner SCANsat hard-codes as rerunnable. No row can say it, so the whole
    // frame declines.
    expect(parseScanScience([{ partId: "7" }])).toBeNull();
  });

  it("declines the frame rather than reading a non-boolean flag as false", () => {
    expect(parseScanScience([{ ...SCAN_ENTRY, rerunnable: "yes" }])).toBeNull();
  });

  it("declines the frame rather than dropping an entry with no partId", () => {
    // partId is the row's React key and the host widget's identity for it, so an
    // entry without one cannot be drawn. Skipping it handed the host widget a SHORT
    // list, which it counts in its own header as a complete one: the operator
    // could not tell one scanner from two of which one was unreadable.
    expect(parseScanScience([{ partTitle: "Nameless" }, SCAN_ENTRY])).toBeNull();
  });

  it("declines the frame rather than dropping an entry that is not an object", () => {
    expect(parseScanScience([SCAN_ENTRY, 42])).toBeNull();
  });

  it("contributes nothing for a frame that is not a list", () => {
    expect(parseScanScience(null)).toBeNull();
    expect(parseScanScience(undefined)).toBeNull();
    expect(parseScanScience({ partId: "42" })).toBeNull();
  });
});

describe("computeScanScienceInstruments", () => {
  it("contributes the vessel's scanners, each carrying the reading its flags came from", () => {
    const topics = topicsWith([SCAN_ENTRY]);
    expect(computeScanScienceInstruments(topics)).toEqual([
      { ...SCAN_ENTRY, reading: topics[SCAN_SCIENCE_READING_ID] },
    ]);
  });

  it("keeps a held frame's scanners and hands them the held reading, so the host marks them", () => {
    const rows = computeScanScienceInstruments(topicsWith([SCAN_ENTRY], true));
    expect(rows?.map((row) => row.partId)).toEqual(["42"]);
    expect(rows?.[0]?.reading.state).toBe("held");
    expect(rows?.[0]?.reading.grade).toBe("disconnected");
  });

  it("contributes nothing before scansat.science has arrived", () => {
    expect(computeScanScienceInstruments(topicsWith(undefined))).toBeNull();
    expect(
      computeScanScienceInstruments({
        "scansat.science": undefined,
      } as unknown as ScienceInstrumentTopics),
    ).toBeNull();
  });

  it("contributes nothing on a vessel with no scanners", () => {
    expect(computeScanScienceInstruments(topicsWith([]))).toEqual([]);
  });
});
