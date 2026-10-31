import { describe, expect, it } from "vitest";
import { RateHold } from "./rateHold.js";

describe("RateHold", () => {
  it("passes the first rate of a resource through", () => {
    const hold = new RateHold();
    expect(hold.filter(10, { ElectricCharge: -0.085 })).toEqual({
      ElectricCharge: -0.085,
    });
  });

  it("holds the real draw through the recorded near-zero samples", () => {
    const hold = new RateHold();
    const out = [-0.085, 0.0005, 0.0005, -0.084, -0.085, 0.0005].map(
      (rate, i) => hold.filter(10 + i, { ElectricCharge: rate }).ElectricCharge,
    );
    expect(out).toEqual([-0.085, -0.085, -0.085, -0.084, -0.085, -0.085]);
  });

  it("accepts a reversal that is not tiny against the held rate", () => {
    // Leaving shadow: -0.5 becomes +3. A sixth of the held magnitude is not a glitch.
    const hold = new RateHold();
    hold.filter(10, { ElectricCharge: -0.5 });
    expect(hold.filter(11, { ElectricCharge: 3 }).ElectricCharge).toBe(3);
  });

  it("accepts a tiny opposite rate that persists past the hold", () => {
    const hold = new RateHold();
    hold.filter(10, { ElectricCharge: -0.085 });
    expect(hold.filter(20, { ElectricCharge: 0.0005 }).ElectricCharge).toBe(
      -0.085,
    );
    expect(hold.filter(50, { ElectricCharge: 0.0005 }).ElectricCharge).toBe(
      0.0005,
    );
  });

  it("treats a measured zero as a real statement", () => {
    const hold = new RateHold();
    hold.filter(10, { ElectricCharge: -0.085 });
    expect(hold.filter(11, { ElectricCharge: 0 }).ElectricCharge).toBe(0);
  });

  it("gives the same answer when the same observation is filtered twice", () => {
    const hold = new RateHold();
    hold.filter(10, { ElectricCharge: -0.085 });
    const once = hold.filter(11, { ElectricCharge: 0.0005 });
    expect(hold.filter(11, { ElectricCharge: 0.0005 })).toEqual(once);
  });

  it("starts over when the observation moves backwards", () => {
    const hold = new RateHold();
    hold.filter(100, { ElectricCharge: -0.085 });
    expect(hold.filter(50, { ElectricCharge: 0.0005 }).ElectricCharge).toBe(
      0.0005,
    );
  });
});
