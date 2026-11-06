import { render } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { groundBracketOverlay } from "./groundBracketOverlay.js";

const ctx = { geometry: { bottomRight: { x: 40, y: 30 } } } as never;

describe("groundBracketOverlay", () => {
  it("leaves the shared brackets alone without knowledge", () => {
    expect(groundBracketOverlay(undefined)).toBeUndefined();
  });

  it("appends the network half to the camera half of the readout", () => {
    const overlay = groundBracketOverlay({ kind: "modelled", ageSeconds: 252 });

    expect(overlay?.readout?.("OCCLUDED MUN", ctx)).toBe("OCCLUDED MUN · MODELLED 4min 12s");
  });

  it("keeps a blanked feed's readout empty", () => {
    expect(groundBracketOverlay({ kind: "heard", ageSeconds: null })?.readout?.("", ctx)).toBe("");
  });

  it("draws no mark for a craft heard now, and a mark for modelled and held", () => {
    const heard = groundBracketOverlay({ kind: "heard", ageSeconds: null });
    expect(heard?.render?.(ctx)).toBeNull();

    for (const kind of ["modelled", "held", "blackout"] as const) {
      const overlay = groundBracketOverlay({ kind, ageSeconds: 5 });
      const { container } = render(<svg>{overlay?.render?.(ctx)}</svg>);
      expect(container.querySelector("[data-reckoning-mark]")).not.toBeNull();
    }
  });

  it("colours the network corner by how the craft is known", () => {
    const colour = (kind: "heard" | "modelled" | "held") => {
      const c = groundBracketOverlay({ kind, ageSeconds: null })?.corners;
      return (c as { bottomRight: { colour: string } }).bottomRight.colour;
    };
    expect(colour("heard")).toContain("#4caf50");
    expect(colour("modelled")).toContain("modelled");
    expect(colour("held")).toContain("warn");
  });

  it("hides the corner bracket where the modelled or held mark replaces it", () => {
    const hidden = (kind: "heard" | "seen" | "modelled" | "held" | "blackout") =>
      (
        groundBracketOverlay({ kind, ageSeconds: null })?.corners as {
          bottomRight: { hidden: boolean };
        }
      ).bottomRight.hidden;
    expect(hidden("heard")).toBe(false);
    expect(hidden("seen")).toBe(false);
    expect(hidden("modelled")).toBe(true);
    expect(hidden("held")).toBe(true);
    expect(hidden("blackout")).toBe(true);
  });
});
