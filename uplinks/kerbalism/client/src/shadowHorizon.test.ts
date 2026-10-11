import { value } from "@ksp-gonogo/sitrep-sdk";
import { describe, expect, it } from "vitest";
import { nextLightChange } from "./shadowHorizon.js";
import {
  BODIES,
  circular,
  HOME_ORBIT_SMA,
  HOME_RADIUS,
  period,
} from "./test/lightFixtures.js";

/*
 * The star sits on the -x side of the planet, so the shadow is centred on the
 * +x direction of the orbit's own frame, which is where mean anomaly 0 puts a
 * circular equatorial craft. The shadow's half-width as seen from the centre of
 * the planet is asin(radius / sma), which gives every expected figure here
 * without the code under test.
 */
describe("the craft's next move between sunlight and the planet's shadow", () => {
  it("leaves the shadow after the rest of the arc when it starts at the middle of it", () => {
    const sma = 900_000;
    const change = nextLightChange(circular(sma, 0), BODIES, 0);
    expect(change?.enters).toBe("sunlight");
    expect(change?.seconds).toBeCloseTo(
      (period(sma) * Math.asin(HOME_RADIUS / sma)) / (2 * Math.PI),
      0,
    );
  });

  it("enters the shadow after the lit arc when it starts opposite the middle of it", () => {
    const sma = 900_000;
    const change = nextLightChange(circular(sma, Math.PI), BODIES, 0);
    expect(change?.enters).toBe("shadow");
    expect(change?.seconds).toBeCloseTo(
      (period(sma) * (Math.PI - Math.asin(HOME_RADIUS / sma))) / (2 * Math.PI),
      0,
    );
  });

  it("holds for hours in a high orbit, where a flat span would have ended in minutes", () => {
    const sma = 6_000_000;
    const change = nextLightChange(circular(sma, Math.PI), BODIES, 0);
    expect(change?.seconds ?? 0).toBeGreaterThan(1200);
  });

  it("shows nothing for an orbit that dips into the planet", () => {
    expect(
      nextLightChange(
        circular(900_000, 0, { ecc: value("1", 0.5) }),
        BODIES,
        0,
      ),
    ).toBeNull();
  });

  it("shows nothing for an open orbit", () => {
    expect(
      nextLightChange(
        circular(-900_000, 0, { ecc: value("1", 1.5) }),
        BODIES,
        0,
      ),
    ).toBeNull();
  });

  it("shows nothing for an orbit around the star itself", () => {
    expect(
      nextLightChange(
        circular(HOME_ORBIT_SMA, 0, { referenceBodyIndex: 0 }),
        BODIES,
        0,
      ),
    ).toBeNull();
  });

  it("shows nothing without a catalogue or an orbit", () => {
    expect(nextLightChange(circular(900_000, 0), undefined, 0)).toBeNull();
    expect(nextLightChange(undefined, BODIES, 0)).toBeNull();
  });

  it("shows nothing for an orbit that rides the terminator and stays lit", () => {
    expect(
      nextLightChange(
        circular(900_000, 0, { inc: value("deg", 90), lan: value("deg", 90) }),
        BODIES,
        0,
      ),
    ).toBeNull();
  });
});
