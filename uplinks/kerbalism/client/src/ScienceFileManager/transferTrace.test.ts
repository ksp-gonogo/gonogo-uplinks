import { describe, expect, it } from "vitest";
import {
  EMPTY_TRANSFER_TRACE,
  foldTransferObservation,
  KERBALISM_TRANSFER_TAGS,
  transferAmplitudes,
  transferTraceVisible,
} from "./transferTrace.js";

describe("KERBALISM_TRANSFER_TAGS", () => {
  it("is continuous fire-and-forget telemetry, because nothing acknowledges a drained file", () => {
    expect(KERBALISM_TRANSFER_TAGS).toEqual({
      direction: "telemetry",
      continuity: "continuous",
      delivery: "fire-and-forget",
    });
  });
});

describe("foldTransferObservation", () => {
  it("adds nothing for an unread rate, so unknown is never drawn as idle", () => {
    const t = foldTransferObservation(EMPTY_TRANSFER_TRACE, 10, null, null);
    expect(t).toBe(EMPTY_TRANSFER_TRACE);
    expect(transferTraceVisible(t)).toBe(false);
  });

  it("records a transmitting observation at the rate it was read", () => {
    const t = foldTransferObservation(EMPTY_TRANSFER_TRACE, 10, 0.004, true);
    expect(t.samples).toEqual([0.004]);
    expect(t.lastUt).toBe(10);
    expect(transferTraceVisible(t)).toBe(true);
  });

  it("records zero when the drive was read and is not transmitting", () => {
    const t = foldTransferObservation(EMPTY_TRANSFER_TRACE, 10, 0.004, false);
    expect(t.samples).toEqual([0]);
  });

  it("bridges a short gap by holding the earlier reading", () => {
    const a = foldTransferObservation(EMPTY_TRANSFER_TRACE, 10, 0.002, true);
    const b = foldTransferObservation(a, 13, 0.004, true);
    expect(b.samples).toEqual([0.002, 0.002, 0.002, 0.004]);
  });

  it("starts over across a gap nothing was observed in", () => {
    const a = foldTransferObservation(EMPTY_TRANSFER_TRACE, 10, 0.002, true);
    const b = foldTransferObservation(a, 60, 0.004, true);
    expect(b.samples).toEqual([0.004]);
  });

  it("ignores an observation that is not newer", () => {
    const a = foldTransferObservation(EMPTY_TRANSFER_TRACE, 10, 0.002, true);
    expect(foldTransferObservation(a, 10, 0.009, true)).toBe(a);
    expect(foldTransferObservation(a, 8, 0.009, true)).toBe(a);
  });

  it("scales amplitudes by the fastest rate in the window", () => {
    const a = foldTransferObservation(EMPTY_TRANSFER_TRACE, 10, 0.002, true);
    const b = foldTransferObservation(a, 11, 0.004, true);
    expect(transferAmplitudes(b)).toEqual([0.5, 1]);
  });
});
