import {
  createTestTelemetryClient,
  StubTransport,
} from "@ksp-gonogo/sitrep-sdk/testing";
import { describe, expect, it } from "vitest";
import { SCAN_TYPE, type SCANCoverageBitmap } from "../schema.js";
import { applyScanCoverageToMask } from "./scanCoverageSync.js";

/**
 * Coverage is captured for a body when anything subscribes to one of its
 * topics, and the mod reads that off the engine's subscription set. So an API
 * user needs nothing of this Uplink's widgets: a bare `subscribe` through the
 * SDK client is the whole request, and what comes back is the body's bitmap.
 * The mod half, that this subscription is what selects the body, is
 * `ScanChannelsTests.APlainSubscriptionToOneBodysCoverage_IsWhatMakesThatBodyCaptured`.
 */
describe("a plain SDK subscription to one body's coverage", () => {
  it("puts that exact topic on the wire and hands back the bitmap, with no widget mounted", () => {
    const transport = new StubTransport();
    const client = createTestTelemetryClient(transport);
    const topic = `scansat.mask.Minmus.${SCAN_TYPE.Biome}`;
    const received: unknown[] = [];

    const unsubscribe = client.subscribe(topic, (value) => received.push(value));
    expect(transport.isSubscribed(topic)).toBe(true);

    const bitmap: SCANCoverageBitmap = {
      width: 360,
      height: 180,
      type: SCAN_TYPE.Biome,
      bits: btoa(String.fromCharCode(...new Uint8Array((360 * 180) / 8).fill(0xff))),
    };
    transport.emit(topic, bitmap);
    expect(received.at(-1)).toEqual(bitmap);

    // What an author does with it needs no cache either: the same decoder fills any mask.
    const mask = {
      bodyId: "Minmus",
      layerId: "author:biome",
      width: 64,
      height: 32,
      data: new Uint8Array(64 * 32),
    };
    applyScanCoverageToMask(bitmap, mask, {});
    expect(mask.data.every((byte) => byte === 255)).toBe(true);

    unsubscribe();
    expect(transport.isSubscribed(topic)).toBe(false);
  });
});
