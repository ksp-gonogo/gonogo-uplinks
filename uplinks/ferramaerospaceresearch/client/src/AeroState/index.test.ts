import type { AnyContribution, PlotLayer } from "@ksp-gonogo/sitrep-sdk";
import { getContributionsForSlot } from "@ksp-gonogo/sitrep-sdk";
import { describe, expect, it } from "vitest";
import { aeroAttitudeLayers } from "./index.js";

/** A reading in steady flight, with nothing degenerate about it. */
function flying(overrides: Partial<Parameters<typeof aeroAttitudeLayers>[0]> = {}) {
  return {
    alpha: 4.5,
    sideslip: -0.25,
    stall: 0,
    liftToDragRatio: 4.63,
    terminalVelocity: 310,
    stale: false,
    ...overrides,
  };
}

const byId = (layers: PlotLayer[], id: string) =>
  layers.find((l) => l.id === id);

describe("aero attitude layers", () => {
  it("places the current attitude as a point, sideslip across and alpha up", () => {
    const layers = aeroAttitudeLayers(flying());
    const marker = byId(layers, "attitude");
    expect(marker?.kind).toBe("marker");
    expect((marker as Extract<PlotLayer, { kind: "marker" }>).at).toEqual({
      x: -0.25,
      y: 4.5,
    });
  });

  it("draws nothing at all with neither alpha nor sideslip", () => {
    const layers = aeroAttitudeLayers(flying({ alpha: null, sideslip: null }));
    expect(layers).toEqual([]);
  });

  it("still places the point on a craft with no wing to stall", () => {
    // A rocket has alpha and sideslip but no stall fraction: the point still
    // means something even with no stall band to caption it.
    const layers = aeroAttitudeLayers(
      flying({ stall: null, liftToDragRatio: null }),
    );
    expect(byId(layers, "attitude")).toBeDefined();
    expect(byId(layers, "band")).toBeUndefined();
  });

  it("names the stall band as a word, escalating with the fraction", () => {
    expect(byId(aeroAttitudeLayers(flying({ stall: 0 })), "band")).toEqual(
      expect.objectContaining({ text: "ATTACHED", tone: "go" }),
    );
    expect(byId(aeroAttitudeLayers(flying({ stall: 0.2 })), "band")).toEqual(
      expect.objectContaining({ text: "PARTIAL STALL", tone: "warn" }),
    );
    expect(byId(aeroAttitudeLayers(flying({ stall: 0.7 })), "band")).toEqual(
      expect.objectContaining({ text: "STALLED", tone: "nogo" }),
    );
  });

  it("says MODEL STALE and draws the point faintly", () => {
    const layers = aeroAttitudeLayers(flying({ stale: true }));
    expect(
      layers.some((l) => l.kind === "caption" && l.text === "MODEL STALE"),
    ).toBe(true);
    expect(byId(layers, "attitude")?.emphasis).toBe("faint");
  });

  it("carries lift/drag and terminal velocity as corner captions when present", () => {
    const layers = aeroAttitudeLayers(flying());
    expect(byId(layers, "lift-drag")?.kind).toBe("caption");
    expect(byId(layers, "terminal")?.kind).toBe("caption");
  });

  it("omits a corner caption for a figure the model has not published", () => {
    const layers = aeroAttitudeLayers(
      flying({ liftToDragRatio: null, terminalVelocity: null }),
    );
    expect(byId(layers, "lift-drag")).toBeUndefined();
    expect(byId(layers, "terminal")).toBeUndefined();
  });
});

// The registration runs at module load, off this file's own import of
// `./index` above, exactly as it does in the app.
describe("registration", () => {
  it("contributes a whole plot to `plots`, gated on the aerodynamics Domain", () => {
    const ids = (slot: string) =>
      getContributionsForSlot(slot).map((c: AnyContribution) => c.id);
    // Namespaced by the client handle, which is what stops two Uplinks
    // colliding on an id somebody picked independently. Note the plot names no
    // host widget: `plots` is one slot for the app, and this Uplink could not
    // name `landing-status` here even if it wanted to.
    expect(ids("plots")).toContain("aero:aero-state");
    const contribution = getContributionsForSlot("plots").find(
      (c: AnyContribution) => c.id === "aero:aero-state",
    );
    expect(contribution?.requires).toBe("aero");
  });
});
