import type { DerivedChannelDefinition, Value } from "@ksp-gonogo/sitrep-sdk";
import { value } from "@ksp-gonogo/sitrep-sdk";
import type { StreamFixture } from "@ksp-gonogo/sitrep-sdk/testing";
import { makeMeta, setupStreamFixture } from "@ksp-gonogo/sitrep-sdk/testing";
import { describe, expect, it } from "vitest";

/**
 * What shape a derived channel has to be in for a chart to reach it.
 *
 * Written against `kerbalism.resourceProjection`, which carried seven scalars
 * per resource and could not be plotted, though not for a shortage of numbers.
 * The reason outlives that channel, which is why it is pinned here on a probe.
 *
 * Scalars inside an ARRAY are unreachable. `TimelineStore`'s
 * `resolveDerivedTopic` splits a subtopic on its LAST dot and takes exactly one
 * segment, so a payload rooted at `{resources: [...]}` offers exactly one
 * subtopic, whose value is the array. There is no syntax that indexes an
 * element, and keying by name instead would still need two segments.
 *
 * A derived channel grows no reckoned tail at all: `sampleReckonedTail` walks a
 * raw topic's own model, and a derived channel declares none.
 */

const INPUT = "vessel.resources";

const CARRIED = [INPUT, "probe.collection"];

const AMOUNTS = {
  resources: {
    Food: { current: value("units", 100), max: value("units", 400) },
  },
};

/**
 * Ingested straight into the store rather than emitted over the stub
 * transport: the transport's delivery is bridged into the store by a mounted
 * `TelemetryProvider`, and nothing here renders a widget.
 */
function ingest(fixture: StreamFixture, topic: string, payload: unknown) {
  fixture.store.ingest(topic, {
    validAt: 1000,
    payload,
    meta: makeMeta({ validAt: 1000, deliveredAt: 1000 }),
    epoch: 0,
  });
}

/** A channel whose scalars sit one level down, inside an array. */
const collection: DerivedChannelDefinition<{
  resources: { name: string; projected: Value<"units"> }[];
}> = {
  topic: "probe.collection",
  inputs: [INPUT],
  derive: (get, viewUt) => {
    const point = get<unknown>(INPUT);
    if (!point || point.payload === null) return undefined;
    return {
      resources: [
        { name: "Food", projected: value("units", viewUt - point.validAt) },
      ],
    };
  },
  fields: true,
};

function fixtureWithProbes(pinnedUt: number) {
  const fixture = setupStreamFixture({ carriedChannels: CARRIED, pinnedUt });
  fixture.store.registerDerivedChannel(collection);
  ingest(fixture, INPUT, AMOUNTS);
  fixture.store.beginFrame();
  return fixture;
}

describe("why an array-rooted channel reaches no chart", () => {
  it("carries scalars, so a shortage of numbers is not the reason", () => {
    const fixture = fixtureWithProbes(1600);

    const record = fixture.store.sample<{
      resources: { projected: Value<"units"> }[];
    }>("probe.collection")?.payload;

    expect(record?.resources[0]?.projected.magnitude).toBe(600);
  });

  it("offers no subtopic that reaches an element's own fields", () => {
    const fixture = fixtureWithProbes(1600);

    // A derived subtopic is ONE segment past the channel, so this resolves to
    // a `projected` key on the record root, which does not exist.
    expect(fixture.store.sample("probe.collection.projected")?.payload).toBe(
      undefined,
    );
  });
});
