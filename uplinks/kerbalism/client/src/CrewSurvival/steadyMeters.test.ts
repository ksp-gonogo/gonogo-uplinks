import type { MeterEntry, Reading, Value } from "@ksp-gonogo/sitrep-sdk";
import { value } from "@ksp-gonogo/sitrep-sdk";
import { describe, expect, it } from "vitest";
import { steadyMeters } from "./steadyMeters.js";

/** One frame's meter for a rule the model is advancing: every frame is a new object. */
function meterAt(frame: number, fraction: number, drift: number): MeterEntry {
  const modelled = fraction + drift * frame;
  const reading: Reading<Value<"ratio">> = {
    state: "observed",
    value: value("ratio", fraction),
    atUt: value("ut", 1000 + frame),
    reckoning: {
      status: "available",
      atUt: value("ut", 1000 + frame),
      beyondReceived: true,
      modelled: value("ratio", modelled),
      basis: "rate-integration",
      band: {
        value: value("ratio", modelled),
        lo: value("ratio", modelled - 0.02),
        hi: value("ratio", modelled + 0.02),
        kind: "sigma1",
      },
    },
  } as never;
  return {
    id: "Jebediah Kerman:radiation",
    label: "Radiation dose",
    value: reading,
    tone: "ok",
    row: "Jebediah Kerman",
  } as never;
}

describe("steadyMeters", () => {
  it("keeps one reading while a steady model advance stays inside a percent", () => {
    const first = steadyMeters([meterAt(0, 0.4, 0.00001)]);
    const seen = new Set<unknown>([first?.[0].value]);
    for (let frame = 1; frame <= 300; frame++) {
      seen.add(steadyMeters([meterAt(frame, 0.4, 0.00001)])?.[0].value);
    }
    expect(seen.size).toBe(1);
  });

  it("hands over a new reading once the drawn figure moves", () => {
    const first = steadyMeters([meterAt(0, 0.4, 0.001)]);
    let moved = first?.[0].value;
    for (let frame = 1; frame <= 40 && moved === first?.[0].value; frame++) {
      moved = steadyMeters([meterAt(frame, 0.4, 0.001)])?.[0].value;
    }
    expect(moved).not.toBe(first?.[0].value);
  });

  it("forgets a meter that left the list", () => {
    const first = steadyMeters([meterAt(0, 0.4, 0)]);
    steadyMeters([]);
    const again = steadyMeters([meterAt(1, 0.4, 0)]);
    expect(again?.[0].value).not.toBe(first?.[0].value);
  });
});
