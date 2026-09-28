import {
  Quality,
  type Reading,
  Staleness,
  value,
} from "@ksp-gonogo/sitrep-sdk";
import {
  processorRuntimeFor,
  TimelineStore,
  ViewClock,
} from "@ksp-gonogo/sitrep-sdk/testing";
import { afterEach, describe, expect, it } from "vitest";
import { SHIP_SYSTEMS, type ShipSystems } from "./processor.js";

/**
 * The live bug, closed: a Ship Systems summary knows how current the resource
 * levels it was derived from actually are.
 *
 * Every figure the summary produces (a level, a rate, a time-to-empty) is a
 * function of `vessel.resources`. The processor resolved that dep to
 * `point.payload`, the value channel alone, so it could not tell a current
 * level from one observed twenty minutes ago, and the widget presented a
 * last-contact projection as current with nothing in the render saying so.
 *
 * It now takes the READING and reports its own provenance. Not a nested
 * `Reading`: a summary reasoning across resources is not one Topic's currency.
 */

function fakeWall(start = 0) {
  let now = start;
  return {
    now: () => now,
    advanceBy: (seconds: number) => {
      now += seconds;
    },
  };
}

/** The one-way light-time every sample here travels. */
const LIGHT_TIME_SECONDS = 600;

/** When a sample stamped at `validAt` reaches the console. */
const deliveredAt = (validAt: number) => validAt + LIGHT_TIME_SECONDS;

function lightDelayedStore(wall: { now: () => number }): TimelineStore {
  const clock = new ViewClock({
    nowWall: wall.now,
    warpRate: () => 1,
    delaySeconds: () => LIGHT_TIME_SECONDS,
  });
  return new TimelineStore(clock);
}

function resourcesPoint(validAt: number, water: number) {
  return {
    validAt,
    payload: {
      resources: {
        Water: { current: water, max: 100, active: true },
      },
    },
    meta: {
      source: "vessel:abc",
      validAt,
      seq: 0,
      deliveredAt: deliveredAt(validAt),
      vantage: "ksc",
      quality: Quality.OnRails,
      active: true,
      staleness: Staleness.Fresh,
      timelineEpoch: 0,
    },
    epoch: 0,
  };
}

let deactivate: (() => void) | undefined;
let runtime: ReturnType<typeof processorRuntimeFor> | undefined;

afterEach(() => {
  deactivate?.();
  deactivate = undefined;
  runtime = undefined;
});

/** Activates the summary against `store` for the rest of the case. */
function activateOn(store: TimelineStore): void {
  runtime = processorRuntimeFor(store);
  deactivate = runtime.activate(SHIP_SYSTEMS.id);
}

function readReading(): Reading<ShipSystems> | undefined {
  return runtime?.value<Reading<ShipSystems>>(SHIP_SYSTEMS.id);
}

/* The summary itself. This processor deps on a reading, so what it answers with
   is a reading of the summary, and both value-bearing arms carry one. */
function read(): ShipSystems | undefined {
  const reading = readReading();
  return reading?.state === "observed" || reading?.state === "stale"
    ? reading.value
    : undefined;
}

describe("a Ship Systems summary reports the currency of its levels", () => {
  it("says observed while the levels are current", () => {
    const wall = fakeWall(deliveredAt(100));
    const store = lightDelayedStore(wall);
    activateOn(store);

    store.ingest("vessel.resources", resourcesPoint(100, 80));
    store.beginFrame();

    expect(read()?.levels.state).toBe("observed");
    // The instant, not a bare number: `asOfUt` carries `Value<"ut">`.
    expect(read()?.levels.asOfUt).toEqual(value("ut", 100));
  });

  it("dates its own answer, not just the levels inside it", () => {
    /*
     * The processor deps on a reading, so the ANSWER carries currency too. The
     * `levels` field above is the summary's own statement about the resources
     * it reasoned across; this is the reading the consumer is handed, and a
     * widget marks its panel from it without reaching inside.
     */
    const wall = fakeWall(deliveredAt(100));
    const store = lightDelayedStore(wall);
    activateOn(store);

    store.ingest("vessel.resources", resourcesPoint(100, 80));
    store.beginFrame();
    expect(readReading()?.state).toBe("observed");

    wall.advanceBy(1200);
    store.setTransportConnected(false);
    store.beginFrame();

    const reading = readReading();
    expect(reading?.state).toBe("stale");
    // Dated by the OBSERVATION behind it, never by the frame that read it.
    expect(reading?.asOfUt).toEqual(value("ut", 100));
    // The summary survives the staleness: holding it is the whole point.
    expect(reading?.value?.levels.state).toBe("stale");
  });

  it("still answers when a dep never arrived, rather than gating on it", () => {
    /*
     * `compute` was handed the reading and had already decided what an absent
     * one means, so the dating is laid over its answer rather than deciding
     * whether there is one. Gating here would blank a summary the derivation
     * deliberately produced.
     */
    const wall = fakeWall(deliveredAt(100));
    const store = lightDelayedStore(wall);
    activateOn(store);

    store.beginFrame();
    expect(readReading()?.value).toBeDefined();
  });

  it("says STALE, dated by the observation, once the levels stop arriving", () => {
    // The bug. Before this the summary was identical either way, so a
    // time-to-empty computed off twenty-minute-old levels rendered exactly like
    // one computed off a live reading.
    const wall = fakeWall(deliveredAt(100));
    const store = lightDelayedStore(wall);
    activateOn(store);

    store.ingest("vessel.resources", resourcesPoint(100, 80));
    store.beginFrame();
    expect(read()?.levels.state).toBe("observed");

    wall.advanceBy(1200);
    store.setTransportConnected(false);
    store.beginFrame();

    const levels = read()?.levels;
    expect(levels?.state).toBe("stale");
    // The OBSERVATION's UT, not the frame's: the whole point is that these two
    // have come apart.
    expect(levels?.asOfUt).toEqual(value("ut", 100));
  });

  it("still derives from the last observed levels rather than blanking", () => {
    // Reporting staleness must not mean throwing the numbers away: "80 units at
    // last contact, 20 minutes ago" is the useful statement, and the operator
    // specifically wants the last real value reachable.
    const wall = fakeWall(deliveredAt(100));
    const store = lightDelayedStore(wall);
    activateOn(store);

    store.ingest("vessel.resources", resourcesPoint(100, 80));
    store.beginFrame();
    wall.advanceBy(1200);
    store.setTransportConnected(false);
    store.beginFrame();

    const summary = read()?.summary;
    expect(summary).toBeDefined();
    expect(read()?.levels.state).toBe("stale");
  });

  it("has no observation instant before anything has arrived", () => {
    // `pending` is a real arm: a summary with no levels yet names no instant.
    const wall = fakeWall(deliveredAt(100));
    const store = lightDelayedStore(wall);
    activateOn(store);

    store.beginFrame();

    const levels = read()?.levels;
    expect(levels?.state).toBe("pending");
    expect(levels?.asOfUt).toBeUndefined();
  });
});
