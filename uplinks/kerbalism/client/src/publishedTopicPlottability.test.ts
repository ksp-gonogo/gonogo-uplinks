import type { Value } from "@ksp-gonogo/sitrep-sdk";
import { value } from "@ksp-gonogo/sitrep-sdk";
import type { StreamFixture } from "@ksp-gonogo/sitrep-sdk/testing";
import { makeMeta, setupStreamFixture } from "@ksp-gonogo/sitrep-sdk/testing";
import { describe, expect, it } from "vitest";

/**
 * What shape a processor's published Topic has to be in for a chart to reach it.
 *
 * Written against `kerbalism.resourceProjection`, a derived channel that carried seven scalars
 * per resource and could not be plotted, though not for a shortage of numbers.
 * The reason outlives that channel, which is why it is pinned here on a probe.
 *
 * Scalars inside an array are unreachable. `TimelineStore`'s
 * `resolveDerivedTopic` splits a subtopic on its last dot and takes exactly one
 * segment, so a payload rooted at `{resources: [...]}` offers exactly one
 * subtopic, whose value is the array. There is no syntax that indexes an
 * element, and keying by name instead would still need two segments.
 *
 * A published processor grows no reckoned tail at all: `sampleReckonedTail` walks a
 * raw topic's own model, and a published processor declares none.
 */

const INPUT = "vessel.resources";

const INGESTED_AT = 1000;

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
    validAt: INGESTED_AT,
    payload,
    meta: makeMeta({ validAt: INGESTED_AT, deliveredAt: INGESTED_AT }),
    epoch: 0,
  });
}

/** A processor whose published scalars sit one level down, inside an array. */
const collection = {
  topic: "probe.collection",
  deps: [INPUT],
  compute: (
    [amounts]: readonly [unknown],
    frame: { viewUt: number },
  ) => {
    if (!amounts) return undefined;
    return {
      resources: [
        {
          name: "Food",
          projected: value("units", frame.viewUt - INGESTED_AT),
        },
      ],
    } satisfies { resources: { name: string; projected: Value<"units"> }[] };
  },
  fields: true,
};

function fixtureWithProbes(pinnedUt: number) {
  const fixture = setupStreamFixture({ pinnedUt });
  fixture.store.publishProcessor(collection);
  ingest(fixture, INPUT, AMOUNTS);
  fixture.store.beginFrame();
  return fixture;
}

describe("why an array-rooted published Topic reaches no chart", () => {
  it("carries scalars, so a shortage of numbers is not the reason", () => {
    const fixture = fixtureWithProbes(1600);

    const record = fixture.store.sample<{
      resources: { projected: Value<"units"> }[];
    }>("probe.collection")?.payload;

    expect(record?.resources[0]?.projected.magnitude).toBe(600);
  });

  it("offers no subtopic that reaches an element's own fields", () => {
    const fixture = fixtureWithProbes(1600);

    // A published subtopic is ONE segment past the channel, so this resolves to
    // a `projected` key on the record root, which does not exist.
    expect(fixture.store.sample("probe.collection.projected")?.payload).toBe(
      undefined,
    );
  });
});
