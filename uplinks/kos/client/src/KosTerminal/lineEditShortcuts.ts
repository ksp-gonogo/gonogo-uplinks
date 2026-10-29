/** The in-progress line and the insertion point within it. */
export interface LineEditState {
  text: string;
  cursor: number;
}

export type LineEdit =
  | "lineStart"
  | "lineEnd"
  | "wordLeft"
  | "wordRight"
  | "deleteWordBack"
  | "deleteToStart";

export type EditPlatform = "mac" | "other";

/** The parts of a key event the shortcuts are matched on. */
export interface LineEditKey {
  key: string;
  metaKey: boolean;
  altKey: boolean;
  ctrlKey: boolean;
  shiftKey: boolean;
}

/** The platform the page runs on, as far as text-editing shortcuts differ. */
export function detectEditPlatform(
  nav: Pick<Navigator, "platform" | "userAgent"> | undefined = typeof navigator ===
  "undefined"
    ? undefined
    : navigator,
): EditPlatform {
  const label = `${nav?.platform ?? ""} ${nav?.userAgent ?? ""}`;
  return /Mac|iPhone|iPad/i.test(label) ? "mac" : "other";
}

/**
 * The line edit a key press asks for on this platform, or `null` when the press
 * is not one of the text-editing shortcuts. macOS: Cmd+Left/Right to the line's
 * start or end, Option+Left/Right by word, Option+Backspace deletes a word,
 * Cmd+Backspace deletes to the line's start. Windows and Linux: Home and End
 * reach the ends through the terminal's own key sequences, so only
 * Ctrl+Left/Right by word and Ctrl+Backspace deleting a word are matched here.
 * Used by the kOS terminal's input line.
 */
export function matchLineEdit(
  event: LineEditKey,
  platform: EditPlatform,
): LineEdit | null {
  if (event.shiftKey) return null;
  const { key } = event;
  if (platform === "mac") {
    if (event.ctrlKey) return null;
    if (event.metaKey && !event.altKey) {
      if (key === "ArrowLeft") return "lineStart";
      if (key === "ArrowRight") return "lineEnd";
      if (key === "Backspace") return "deleteToStart";
    }
    if (event.altKey && !event.metaKey) {
      if (key === "ArrowLeft") return "wordLeft";
      if (key === "ArrowRight") return "wordRight";
      if (key === "Backspace") return "deleteWordBack";
    }
    return null;
  }
  if (event.metaKey || event.altKey || !event.ctrlKey) return null;
  if (key === "ArrowLeft") return "wordLeft";
  if (key === "ArrowRight") return "wordRight";
  if (key === "Backspace") return "deleteWordBack";
  return null;
}

const WORD_CHAR = /[\p{L}\p{N}_]/u;

function isWordChar(ch: string): boolean {
  return WORD_CHAR.test(ch);
}

/** The cursor position one word to the left: past any gap, then the word. */
function wordStartBefore(text: string, cursor: number): number {
  let i = cursor;
  while (i > 0 && !isWordChar(text[i - 1])) i--;
  while (i > 0 && isWordChar(text[i - 1])) i--;
  return i;
}

/** The cursor position one word to the right: past any gap, then the word. */
function wordEndAfter(text: string, cursor: number): number {
  let i = cursor;
  while (i < text.length && !isWordChar(text[i])) i++;
  while (i < text.length && isWordChar(text[i])) i++;
  return i;
}

/**
 * Applies a line edit to the composed line. A press that changes nothing returns
 * the same object, so a caller can skip a state update.
 */
export function applyLineEdit(
  comp: LineEditState,
  edit: LineEdit,
): LineEditState {
  switch (edit) {
    case "lineStart":
      return comp.cursor === 0 ? comp : { ...comp, cursor: 0 };
    case "lineEnd":
      return comp.cursor === comp.text.length
        ? comp
        : { ...comp, cursor: comp.text.length };
    case "wordLeft": {
      const cursor = wordStartBefore(comp.text, comp.cursor);
      return cursor === comp.cursor ? comp : { ...comp, cursor };
    }
    case "wordRight": {
      const cursor = wordEndAfter(comp.text, comp.cursor);
      return cursor === comp.cursor ? comp : { ...comp, cursor };
    }
    case "deleteWordBack": {
      const start = wordStartBefore(comp.text, comp.cursor);
      if (start === comp.cursor) return comp;
      return {
        text: comp.text.slice(0, start) + comp.text.slice(comp.cursor),
        cursor: start,
      };
    }
    case "deleteToStart":
      if (comp.cursor === 0) return comp;
      return { text: comp.text.slice(comp.cursor), cursor: 0 };
  }
}

/** Whether an edit removes text, which leaves history browsing like typing does. */
export function isDeletion(edit: LineEdit): boolean {
  return edit === "deleteWordBack" || edit === "deleteToStart";
}
