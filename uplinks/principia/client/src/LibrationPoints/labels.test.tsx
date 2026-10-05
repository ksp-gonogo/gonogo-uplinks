import {
  act,
  setupStreamFixture,
  waitFor,
} from "@ksp-gonogo/sitrep-sdk/testing";
import { renderWidget } from "@ksp-gonogo/ui-kit/testing";
import { describe, expect, it } from "vitest";
import kerbinMun from "./__fixtures__/kerbin-mun-no-craft.json" with {
  type: "json",
};
import kerbolKerbin from "./__fixtures__/low-kerbin-orbit.json" with {
  type: "json",
};
import atL1 from "./__fixtures__/mun-l1-holding-station.json" with {
  type: "json",
};
import "./index.js";

/**
 * The secondary body sits between L1 and L2, a few label widths from each, so
 * the three names collide unless the body's is on the other side of the axis
 * from the points'. The axis is y = 0 in the diagram's own units.
 */
type Scene = typeof kerbinMun | typeof atL1 | typeof kerbolKerbin;

function mount(scene: Scene, pair = "Mun") {
  const fixture = setupStreamFixture({ pinnedUt: scene._stream.pinnedUt });
  const view = renderWidget("libration-points", {
    instanceId: "lp-labels",
    config: { pair },
    wrapper: fixture.Provider,
  });
  act(() => {
    for (const e of scene._stream.emits) fixture.emit(e.topic, e.payload);
  });
  return view;
}

async function drawn(view: { container: HTMLElement }): Promise<Element> {
  return await waitFor(() => {
    const found = view.container.querySelector("[data-libration-frame]");
    if (found === null) throw new Error("nothing drawn yet");
    return found;
  });
}

function label(svg: Element, text: string): Element {
  const found = [...svg.querySelectorAll("text")].find(
    (t) => t.textContent === text,
  );
  if (found === undefined) throw new Error(`no "${text}" label drawn`);
  return found;
}

function labelY(svg: Element, text: string): number {
  return Number(label(svg, text).getAttribute("y"));
}

describe("LibrationDiagram labels", () => {
  it("names the secondary below the axis, where the collinear points' names are not", async () => {
    const svg = await drawn(mount(kerbinMun));
    expect(labelY(svg, "Mun")).toBeGreaterThan(0);
    for (const point of ["L1", "L2", "L3"]) {
      expect(labelY(svg, point)).toBeLessThan(0);
    }
    await act(async () => {});
  });

  it("drops a craft's name to its own line where it would sit on the body's", async () => {
    // The relay is 46 km off L1, which is a sixth of a separation from the Mun.
    const svg = await drawn(mount(atL1));
    const vessel = svg.querySelector("[data-libration-vessel] text");
    if (vessel === null) throw new Error("no craft name drawn");
    const mun = labelY(svg, "Mun");
    expect(Number(vessel.getAttribute("y"))).toBeGreaterThanOrEqual(mun + 12);
    await act(async () => {});
  });

  it("parts L1's and L2's names where the two points sit closer than a name is wide", async () => {
    // Kerbin is a millionth of Kerbol's mass, so its L1 and L2 are a hair either side of it.
    const svg = await drawn(mount(kerbolKerbin, "Kerbin"));
    const l1 = label(svg, "L1");
    const l2 = label(svg, "L2");
    expect(l1.getAttribute("text-anchor")).toBe("end");
    expect(l2.getAttribute("text-anchor")).toBe("start");
    expect(Number(l1.getAttribute("x"))).toBeLessThan(
      Number(l2.getAttribute("x")),
    );
    await act(async () => {});
  });
});
