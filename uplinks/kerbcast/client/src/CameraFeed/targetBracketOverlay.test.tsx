import { commandReadout, type EffectiveCommandTrack } from "@ksp-gonogo/kerbcast";
import {
  bracketGeometry,
  type CommandBracketContext,
  containedContentRect,
} from "@ksp-gonogo/kerbcast-react";
import { RECKONING_MARK } from "@ksp-gonogo/ui-kit";
import { afterEach, describe, expect, it } from "vitest";
import {
  clearCommandKnowledge,
  type CommandKnowledgeSample,
  formatKnowledgeAge,
  latestCommandKnowledge,
  publishCommandKnowledge,
} from "./commandKnowledge.js";
import {
  buildTargetBracketOverlay,
  describeKnowledgeBadge,
} from "./targetBracketOverlay.js";

const FLIGHT = 7;

function track(over: Partial<EffectiveCommandTrack> = {}): EffectiveCommandTrack {
  return {
    hasFix: true,
    rangeM: 11_508_000,
    bracketHalfPx: 40,
    frameHeightPx: 576,
    framingFits: true,
    occluded: false,
    occluder: "",
    sunlit: true,
    blank: null,
    authority: null,
    camera: "inView",
    ...over,
  } as EffectiveCommandTrack;
}

const MODELLED: CommandKnowledgeSample = {
  ut: 100,
  network: "modelled",
  lastKnownUt: 100,
  uncertaintyM: 1200,
};

type Corners = {
  topLeft?: { colour?: string; dashed?: boolean; hidden?: boolean };
  bottomRight?: { colour?: string; dashed?: boolean; hidden?: boolean };
} | null;

/**
 * What the SDK hands the overlay for one frame, and what comes back. The SDK's
 * own bracket component is not exported, so the overlay is driven the way the
 * SDK drives it: the context, then the corners and readout calls.
 */
function draw(
  state: EffectiveCommandTrack,
  displayUt: number,
  utSource: "exact" | "estimated" | "override" = "exact",
) {
  const geometry = bracketGeometry(
    containedContentRect(640, 360, 640, 360),
    state.bracketHalfPx,
    state.frameHeightPx,
  );
  const ctx: CommandBracketContext = {
    geometry,
    width: 640,
    height: 360,
    displayUt,
    utSource,
    state,
  };
  const overlay = buildTargetBracketOverlay(FLIGHT);
  const readout = overlay.readout?.(
    state.blank ? "" : commandReadout(state),
    ctx,
  );
  const corners = (overlay.corners as (c: CommandBracketContext) => Corners)(
    ctx,
  );
  return {
    corners,
    readout: readout ?? "",
    drawn: overlay.render?.(ctx) ?? null,
  };
}

afterEach(() => clearCommandKnowledge());

describe("target bracket overlay", () => {
  it("colours both corners in the modelled hue and gives the age", () => {
    publishCommandKnowledge(FLIGHT, MODELLED);
    const { corners, readout } = draw(track(), 352);
    expect(corners).toEqual({
      topLeft: { colour: RECKONING_MARK.modelled.color },
      bottomRight: { colour: RECKONING_MARK.modelled.color },
    });
    expect(readout).toContain("IN VIEW");
    expect(readout).toContain("MODELLED 4min 12s");
  });

  it("colours both corners in the held hue for a held target and for blackout", () => {
    for (const network of ["held", "blackout"] as const) {
      publishCommandKnowledge(FLIGHT, { ...MODELLED, network });
      expect(draw(track(), 160).corners).toEqual({
        topLeft: { colour: RECKONING_MARK.held.color },
        bottomRight: { colour: RECKONING_MARK.held.color },
      });
    }
  });

  it("leaves Kerbcast's corners alone for a heard or seen target", () => {
    for (const network of ["heard", "seen"] as const) {
      publishCommandKnowledge(FLIGHT, {
        ...MODELLED,
        network,
        lastKnownUt: null,
      });
      const { corners, readout } = draw(track(), 160);
      expect(corners).toBeNull();
      expect(readout).toContain(network.toUpperCase());
      expect(readout).not.toContain(`${network.toUpperCase()} 0`);
    }
  });

  it("never hides, restyles the dashes of or draws over a corner", () => {
    for (const network of ["modelled", "held", "heard"] as const) {
      publishCommandKnowledge(FLIGHT, { ...MODELLED, network });
      for (const state of [
        track(),
        track({ occluded: true, occluder: "Mun" }),
        track({ hasFix: false, rangeM: null, bracketHalfPx: null }),
        track({ blank: "Position too uncertain" }),
      ]) {
        const { corners, drawn } = draw(state, 160);
        expect(drawn).toBeNull();
        for (const corner of [corners?.topLeft, corners?.bottomRight]) {
          expect(corner?.hidden).toBeUndefined();
          expect(corner?.dashed).toBeUndefined();
        }
      }
    }
  });

  it("keeps the readout without a fix and over a blanked feed", () => {
    publishCommandKnowledge(FLIGHT, { ...MODELLED, network: "held" });
    const noFix = draw(
      track({ hasFix: false, rangeM: null, bracketHalfPx: null, camera: "noFix" }),
      160,
    );
    expect(noFix.readout).toContain("NO FIX");
    expect(noFix.readout).toContain("HELD 1min");
    publishCommandKnowledge(FLIGHT, MODELLED);
    expect(draw(track({ blank: "Position too uncertain" }), 160).readout).toBe(
      "MODELLED 1min",
    );
  });

  it("says so when the UT is estimated", () => {
    publishCommandKnowledge(FLIGHT, MODELLED);
    expect(draw(track(), 160, "estimated").readout).toContain(
      "MODELLED 1min · EST",
    );
  });

  it("does not claim est for an exact UT", () => {
    publishCommandKnowledge(FLIGHT, MODELLED);
    expect(draw(track(), 160, "exact").readout).not.toContain("EST");
  });

  it("evaluates at the displayed UT, never ahead of the frame", () => {
    publishCommandKnowledge(FLIGHT, MODELLED);
    publishCommandKnowledge(FLIGHT, {
      ut: 200,
      network: "held",
      lastKnownUt: 100,
      uncertaintyM: 5000,
    });
    const before = draw(track(), 150);
    expect(before.readout).toContain("MODELLED");
    expect(before.readout).not.toContain("HELD");
    expect(before.corners?.topLeft?.colour).toBe(RECKONING_MARK.modelled.color);
    const after = draw(track(), 250);
    expect(after.readout).toContain("HELD 2min 30s");
    expect(after.corners?.topLeft?.colour).toBe(RECKONING_MARK.held.color);
    const earlier = draw(track(), 50);
    expect(earlier.corners).toBeNull();
    expect(earlier.readout).not.toContain("MODELLED");
  });

  it("leaves a feed with no knowledge as Kerbcast draws it", () => {
    const { corners, readout } = draw(track(), 160);
    expect(corners).toBeNull();
    expect(readout).toContain("IN VIEW");
    expect(readout).not.toContain("MODELLED");
  });

  it("keys knowledge by flight", () => {
    publishCommandKnowledge(FLIGHT + 1, MODELLED);
    expect(latestCommandKnowledge(FLIGHT)).toBeNull();
    expect(draw(track(), 160).corners).toBeNull();
  });
});

describe("knowledge header badge and age", () => {
  it("badges a held or modelled target only", () => {
    expect(describeKnowledgeBadge(null)).toBeNull();
    expect(
      describeKnowledgeBadge({ ...MODELLED, network: "heard", lastKnownUt: null }),
    ).toBeNull();
    expect(describeKnowledgeBadge(MODELLED)?.label).toBe("MODELLED");
    expect(describeKnowledgeBadge({ ...MODELLED, network: "held" })?.tone).toBe(
      "warn",
    );
    expect(
      describeKnowledgeBadge({ ...MODELLED, network: "blackout" })?.label,
    ).toBe("BLACKOUT");
  });

  it("formats ages", () => {
    expect(formatKnowledgeAge(45)).toBe("45s");
    expect(formatKnowledgeAge(252)).toBe("4min 12s");
    expect(formatKnowledgeAge(7380)).toBe("2h 3min");
    expect(formatKnowledgeAge(-5)).toBe("0s");
  });
});
