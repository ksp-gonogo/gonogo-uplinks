import {
  act,
  setupStreamFixture,
  waitFor,
} from "@ksp-gonogo/sitrep-sdk/testing";
import { renderWidget } from "@ksp-gonogo/ui-kit/testing";
import { describe, expect, it } from "vitest";
import lowKerbinOrbit from "./__fixtures__/low-kerbin-orbit.json" with {
  type: "json",
};
import atL1 from "./__fixtures__/mun-l1-holding-station.json" with {
  type: "json",
};
import "./index.js";

type Scene = typeof atL1 | typeof lowKerbinOrbit;

/** The same scene with the craft's orbit replaced. */
function withOrbit(scene: Scene, orbit: Record<string, unknown>): Scene {
  return {
    ...scene,
    _stream: {
      ...scene._stream,
      emits: scene._stream.emits.map((e) =>
        e.topic === "vessel.orbit"
          ? { ...e, payload: { ...e.payload, ...orbit } }
          : e,
      ),
    },
  } as Scene;
}

async function keepingOf(scene: Scene): Promise<string | null> {
  const fixture = setupStreamFixture({ pinnedUt: scene._stream.pinnedUt });
  const view = renderWidget("libration-points", {
    instanceId: "lp-keeping",
    config: scene._scene.config,
    wrapper: fixture.Provider,
  });
  act(() => {
    for (const e of scene._stream.emits) fixture.emit(e.topic, e.payload);
  });
  const vessel = await waitFor(() => {
    const found = view.container.querySelector("[data-libration-vessel]");
    if (found === null) throw new Error("no craft drawn yet");
    return found;
  });
  const keeping = vessel.getAttribute("data-libration-vessel");
  await act(async () => {});
  return keeping;
}

describe("station keeping", () => {
  it("holds station for a craft turning with the pair close to the point", async () => {
    expect(await keepingOf(atL1)).toBe("on-station");
  });

  /**
   * A circular Kerbin orbit through the same spot, 46 km off L1, moves about
   * 150 m/s relative to the point and leaves it within hours. Position alone
   * cannot tell the two apart.
   */
  it("does not hold station for a craft passing the point at speed", async () => {
    const passing = withOrbit(atL1, {
      sma: 9_900_000,
      ecc: 0,
      argPe: 0,
      meanAnomalyAtEpoch: 1.7,
    });
    expect(await keepingOf(passing)).not.toBe("on-station");
  });

  it("is never on station for a craft in low Kerbin orbit, whatever pair is nearest", async () => {
    expect(await keepingOf(lowKerbinOrbit)).toBe("elsewhere");
  });
});
