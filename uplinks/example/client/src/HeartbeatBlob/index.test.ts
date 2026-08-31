import { value } from "@ksp-gonogo/sitrep-sdk";
import type { ContributionTopics } from "@ksp-gonogo/sitrep-sdk";
import { describe, expect, it } from "vitest";
import { computeHeartbeatBlob } from "./index.js";

/**
 * A pure `compute` is the easiest thing in an Uplink to test well, and these three
 * cases are the ones worth writing for any contribution: nothing yet, something,
 * and the boundary the arithmetic turns on.
 *
 * `value(...)` mints a real wrapped Value, which is what a decoded payload
 * actually carries. A bare `{ ticks: 42 }` would be a shape the wire never sends,
 * and a test built on one passes while telling you nothing about the code path
 * that unwraps.
 */
function topicsWith(
  bodies: string[],
  ticks?: number,
): ContributionTopics<"system-view.entities"> {
  return {
    "system.bodies": { bodies: bodies.map((name, index) => ({ index, name })) },
    ...(ticks === undefined
      ? {}
      : { "example.heartbeat": { ut: value("ut", 1_000_000), ticks: value("count", ticks) } }),
  } as ContributionTopics<"system-view.entities">;
}

describe("computeHeartbeatBlob", () => {
  it("contributes nothing before a heartbeat has arrived", () => {
    // Not an entry with a zero radius: a mark on the screen that means "no data"
    // is a mark the reader still has to dismiss.
    expect(computeHeartbeatBlob(topicsWith(["Kerbin"]))).toBeNull();
  });

  it("contributes nothing when it does not know where to put the mark", () => {
    // The position needs a parent body. Guessing one would draw the blob
    // somewhere real, which is worse than drawing nothing.
    expect(computeHeartbeatBlob(topicsWith([], 42))).toBeNull();
  });

  it("parks one blob on the home body, sized by where the cadence has got to", () => {
    const entries = computeHeartbeatBlob(topicsWith(["Kerbin"], 42));

    expect(entries).toHaveLength(1);
    const entry = entries?.[0];
    expect(entry?.position).toMatchObject({ kind: "fixed", parentName: "Kerbin" });
    expect(entry?.meta).toMatchObject({ ticks: 42 });
  });

  it("wraps the radius rather than growing without bound", () => {
    // The whole reason the size is a cadence and not a measurement: ticks climb
    // forever, and a radius that climbed with them would eventually be a blob the
    // size of the system. 42 and 102 are one cycle apart and must draw the same.
    const early = computeHeartbeatBlob(topicsWith(["Kerbin"], 42))?.[0];
    const later = computeHeartbeatBlob(topicsWith(["Kerbin"], 102))?.[0];

    expect(later?.shape).toEqual(early?.shape);
  });
});
