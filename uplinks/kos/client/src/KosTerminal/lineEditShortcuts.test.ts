import { describe, expect, it } from "vitest";
import {
  applyLineEdit,
  detectEditPlatform,
  type EditPlatform,
  type LineEditKey,
  matchLineEdit,
} from "./lineEditShortcuts.js";

function press(key: string, mods: Partial<LineEditKey> = {}): LineEditKey {
  return {
    key,
    metaKey: false,
    altKey: false,
    ctrlKey: false,
    shiftKey: false,
    ...mods,
  };
}

describe("matchLineEdit", () => {
  const mac: Array<[string, LineEditKey, string]> = [
    ["Cmd+Left", press("ArrowLeft", { metaKey: true }), "lineStart"],
    ["Cmd+Right", press("ArrowRight", { metaKey: true }), "lineEnd"],
    ["Option+Left", press("ArrowLeft", { altKey: true }), "wordLeft"],
    ["Option+Right", press("ArrowRight", { altKey: true }), "wordRight"],
    [
      "Option+Backspace",
      press("Backspace", { altKey: true }),
      "deleteWordBack",
    ],
    [
      "Cmd+Backspace",
      press("Backspace", { metaKey: true }),
      "deleteToStart",
    ],
  ];
  it.each(mac)("mac %s", (_name, event, edit) => {
    expect(matchLineEdit(event, "mac")).toBe(edit);
  });

  const other: Array<[string, LineEditKey, string]> = [
    ["Ctrl+Left", press("ArrowLeft", { ctrlKey: true }), "wordLeft"],
    ["Ctrl+Right", press("ArrowRight", { ctrlKey: true }), "wordRight"],
    [
      "Ctrl+Backspace",
      press("Backspace", { ctrlKey: true }),
      "deleteWordBack",
    ],
  ];
  it.each(other)("windows and linux %s", (_name, event, edit) => {
    expect(matchLineEdit(event, "other")).toBe(edit);
  });

  it("leaves plain keys and the other platform's chords alone", () => {
    for (const platform of ["mac", "other"] as EditPlatform[]) {
      expect(matchLineEdit(press("ArrowLeft"), platform)).toBeNull();
      expect(matchLineEdit(press("Backspace"), platform)).toBeNull();
      expect(matchLineEdit(press("a", { ctrlKey: true }), platform)).toBeNull();
      expect(
        matchLineEdit(press("ArrowLeft", { shiftKey: true, altKey: true }), platform),
      ).toBeNull();
    }
    expect(
      matchLineEdit(press("ArrowLeft", { ctrlKey: true }), "mac"),
    ).toBeNull();
    expect(
      matchLineEdit(press("ArrowLeft", { metaKey: true }), "other"),
    ).toBeNull();
    expect(
      matchLineEdit(press("Backspace", { altKey: true }), "other"),
    ).toBeNull();
  });
});

describe("detectEditPlatform", () => {
  it("reads the platform from the navigator", () => {
    expect(detectEditPlatform({ platform: "MacIntel", userAgent: "" })).toBe(
      "mac",
    );
    expect(detectEditPlatform({ platform: "Win32", userAgent: "Windows" })).toBe(
      "other",
    );
    expect(detectEditPlatform({ platform: "Linux x86_64", userAgent: "X11" })).toBe(
      "other",
    );
  });
});

describe("applyLineEdit", () => {
  const line = { text: "print altitude.", cursor: 9 };

  it("jumps to the start and the end", () => {
    expect(applyLineEdit(line, "lineStart")).toEqual({
      text: line.text,
      cursor: 0,
    });
    expect(applyLineEdit(line, "lineEnd")).toEqual({
      text: line.text,
      cursor: line.text.length,
    });
  });

  it("returns the same object when nothing moves", () => {
    const start = { text: "ab", cursor: 0 };
    const end = { text: "ab", cursor: 2 };
    expect(applyLineEdit(start, "lineStart")).toBe(start);
    expect(applyLineEdit(start, "wordLeft")).toBe(start);
    expect(applyLineEdit(start, "deleteWordBack")).toBe(start);
    expect(applyLineEdit(start, "deleteToStart")).toBe(start);
    expect(applyLineEdit(end, "lineEnd")).toBe(end);
    expect(applyLineEdit(end, "wordRight")).toBe(end);
  });

  it("moves by word in both directions", () => {
    expect(applyLineEdit(line, "wordLeft").cursor).toBe(6);
    expect(applyLineEdit({ ...line, cursor: 6 }, "wordLeft").cursor).toBe(0);
    expect(applyLineEdit({ ...line, cursor: 0 }, "wordRight").cursor).toBe(5);
    expect(applyLineEdit({ ...line, cursor: 5 }, "wordRight").cursor).toBe(14);
    expect(applyLineEdit({ ...line, cursor: 14 }, "wordRight").cursor).toBe(15);
  });

  it("steps over a gap of spaces and punctuation before the word", () => {
    const text = "run  foo.ks";
    expect(applyLineEdit({ text, cursor: 5 }, "wordLeft").cursor).toBe(0);
    expect(applyLineEdit({ text, cursor: 3 }, "wordRight").cursor).toBe(8);
  });

  it("deletes the word before the cursor", () => {
    expect(applyLineEdit(line, "deleteWordBack")).toEqual({
      text: "print itude.",
      cursor: 6,
    });
    expect(
      applyLineEdit({ text: "set x to 1 ", cursor: 11 }, "deleteWordBack"),
    ).toEqual({ text: "set x to ", cursor: 9 });
  });

  it("deletes everything before the cursor", () => {
    expect(applyLineEdit(line, "deleteToStart")).toEqual({
      text: "itude.",
      cursor: 0,
    });
  });
});
