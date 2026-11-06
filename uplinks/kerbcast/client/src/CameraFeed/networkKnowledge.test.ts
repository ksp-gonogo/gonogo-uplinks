import { value } from "@ksp-gonogo/sitrep-sdk";
import { describe, expect, it } from "vitest";
import {
  feedKnowledgeEntry,
  formatAge,
  networkKnowledge,
  networkReadout,
} from "./networkKnowledge.js";

const entry = (knowledge: string, lastKnown = 100) => ({
  centre: "ground:KSC",
  craftId: 7,
  knowledge,
  lastKnownUt: value("ut", lastKnown),
});

describe("networkKnowledge", () => {
  it("reads a heard craft as heard, or seen when the lens has it", () => {
    expect(networkKnowledge(entry("heard"), true, 110, false)).toEqual({ kind: "heard", ageSeconds: null });
    expect(networkKnowledge(entry("heard"), true, 110, true)).toEqual({ kind: "seen", ageSeconds: null });
  });

  it("reads a seen craft as seen", () => {
    expect(networkKnowledge(entry("seen"), true, 110, false)?.kind).toBe("seen");
  });

  it("reads a modelled craft as modelled, with the time since it was last known", () => {
    expect(networkKnowledge(entry("modelled", 100), true, 352, false)).toEqual({ kind: "modelled", ageSeconds: 252 });
  });

  it("reads a held craft as held, with the time since it was last known", () => {
    expect(networkKnowledge(entry("held", 100), true, 160, false)).toEqual({ kind: "held", ageSeconds: 60 });
  });

  it("reads no route to the camera's centre as blackout whatever the entry says", () => {
    expect(networkKnowledge(entry("heard"), false, 160, false)).toEqual({ kind: "blackout", ageSeconds: 60 });
  });

  it("says nothing for a craft the centre has no entry for, or a word it does not know", () => {
    expect(networkKnowledge(undefined, true, 1, false)).toBeUndefined();
    expect(networkKnowledge(entry("unheard-of"), true, 1, false)).toBeUndefined();
  });
});

describe("feedKnowledgeEntry", () => {
  const entries = [
    { centre: "ground:KSC", craftId: 7, knowledge: "heard" },
    { centre: "ground:KSC", craftId: 9, knowledge: "modelled" },
    { centre: "ground:Dish", craftId: 9, knowledge: "held" },
  ];

  it("reads the knowledge of the craft the camera is aimed at, not the active one", () => {
    // The active craft is 7; this camera watches 9.
    expect(feedKnowledgeEntry(entries, "ground:KSC", 9)?.knowledge).toBe("modelled");
  });

  it("reads the camera's own centre's knowledge of that craft, not another centre's", () => {
    expect(feedKnowledgeEntry(entries, "ground:Dish", 9)?.knowledge).toBe("held");
  });

  it("finds nothing for a craft the centre does not know, a camera with no subject, or no entries yet", () => {
    expect(feedKnowledgeEntry(entries, "ground:KSC", 11)).toBeUndefined();
    expect(feedKnowledgeEntry(entries, "ground:KSC", 0)).toBeUndefined();
    expect(feedKnowledgeEntry(entries, undefined, 7)).toBeUndefined();
    expect(feedKnowledgeEntry(undefined, "ground:KSC", 7)).toBeUndefined();
  });
});

describe("networkReadout", () => {
  it("writes the label alone for heard and seen, and the age after the others", () => {
    expect(networkReadout({ kind: "heard", ageSeconds: null })).toBe("HEARD");
    expect(networkReadout({ kind: "modelled", ageSeconds: 252 })).toBe("MODELLED 4min 12s");
    expect(networkReadout({ kind: "blackout", ageSeconds: 3780 })).toBe("BLACKOUT 1h 3min");
  });

  it("formats ages", () => {
    expect(formatAge(12)).toBe("12s");
    expect(formatAge(252)).toBe("4min 12s");
    expect(formatAge(3780)).toBe("1h 3min");
  });
});
