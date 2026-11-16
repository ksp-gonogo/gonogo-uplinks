import { PerfBudget } from "@ksp-gonogo/sitrep-sdk";
import {
  act,
  setupStreamFixture,
  waitFor,
} from "@ksp-gonogo/sitrep-sdk/testing";
import { renderWidget } from "@ksp-gonogo/ui-kit/testing";
import { describe, expect, it, vi } from "vitest";
import scene from "./__fixtures__/mun-l1-holding-station.json" with {
  type: "json",
};
import "./index.js";

/*
 * A model carrying the craft's orbit hands the widget a reckoning whose value
 * is a new object on every read, which is what rebuilds the merged orbit each
 * render. The harness has no model for `vessel.orbit`, so the reading is given
 * one here, with the same elements the observation carries.
 */
vi.mock("@ksp-gonogo/sitrep-sdk", async (importOriginal) => {
  const real = await importOriginal<typeof import("@ksp-gonogo/sitrep-sdk")>();
  return {
    ...real,
    useTelemetry: ((topic: string) => {
      const reading = real.useTelemetry(topic as never) as {
        state: string;
        value: Record<string, unknown>;
      };
      if (topic !== "vessel.orbit" || reading.state !== "observed")
        return reading;
      return {
        ...reading,
        reckoning: {
          status: "available",
          value: { meanAnomalyAtEpoch: reading.value.meanAnomalyAtEpoch },
        },
      };
    }) as typeof real.useTelemetry,
  };
});

const FRAMES = 60;

function librationBudget(): PerfBudget {
  const found = PerfBudget.getAll().find((b) =>
    b.name.startsWith("Libration point sets"),
  );
  if (found === undefined) throw new Error("libration budget not registered");
  return found;
}

/** Re-renders the widget about once per frame inside one view-instant bucket and returns the sets computed. */
async function setsComputedOver(config: Record<string, unknown>) {
  const fixture = setupStreamFixture({ pinnedUt: 1000 });
  const view = renderWidget("libration-points", {
    instanceId: "lp-bucket",
    config,
    wrapper: fixture.Provider,
  });
  const emits = scene._stream.emits;
  act(() => {
    for (const e of emits) fixture.emit(e.topic, e.payload);
  });
  await waitFor(() => {
    if (view.container.querySelector("[data-libration-vessel]") === null)
      throw new Error("no craft drawn yet");
  });
  await act(async () => {});
  const identity = emits.find((e) => e.topic === "vessel.identity")?.payload;
  const budget = librationBudget();
  budget.resetWindow();
  for (let i = 0; i < FRAMES; i++) {
    fixture.emit(
      "vessel.identity",
      { ...identity, name: `Munar Relay L1 ${i}` },
      { validAt: i + 1, deliveredAt: i + 1 },
    );
    await act(async () => {
      await new Promise((r) => setTimeout(r, 20));
    });
  }
  await act(async () => {});
  const total = budget.windowTotal();
  budget.reset();
  return total;
}

describe("libration point bucket", () => {
  it("solves no new points for a chosen pair while only the craft's orbit changes", async () => {
    expect(await setsComputedOver({ pair: "Mun" })).toBe(0);
  });

  it("solves no new points on Auto while only the craft's orbit changes", async () => {
    expect(await setsComputedOver({})).toBe(0);
  });
});
