import { describe, expect, it } from "vitest";
import { readRealAntennasStationExt } from "./stationExt";

describe("readRealAntennasStationExt", () => {
  it("narrows a station's bag to RealAntennas' own namespace", () => {
    const station = {
      extensions: { realantennas: { techLevel: 4, antennaCount: 2 } },
    };

    expect(readRealAntennasStationExt(station)).toEqual({
      techLevel: 4,
      antennaCount: 2,
    });
  });

  it("is undefined when RealAntennas is not the elected backend", () => {
    expect(readRealAntennasStationExt({})).toBeUndefined();
    expect(readRealAntennasStationExt({ extensions: null })).toBeUndefined();
    expect(
      readRealAntennasStationExt({ extensions: { other: { a: 1 } } }),
    ).toBeUndefined();
    expect(readRealAntennasStationExt(undefined)).toBeUndefined();
  });
});
