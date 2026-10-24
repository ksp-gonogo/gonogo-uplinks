import type {
  CommandBracketContext,
  CommandBracketOverlay,
} from "@ksp-gonogo/kerbcast-react";
import { type PanelBadge, RECKONING_MARK } from "@ksp-gonogo/ui-kit";
import {
  type CommandKnowledgeSample,
  type CommandNetworkState,
  commandKnowledgeAt,
  formatKnowledgeAge,
} from "./commandKnowledge.js";

const NETWORK_WORD: Record<CommandNetworkState, string> = {
  heard: "HEARD",
  seen: "SEEN",
  modelled: "MODELLED",
  held: "HELD",
  blackout: "BLACKOUT",
};

/** Which reckoning mark a network state wears: none for a current fix. */
export function markKindFor(
  network: CommandNetworkState,
): "modelled" | "held" | null {
  if (network === "modelled") return "modelled";
  if (network === "held" || network === "blackout") return "held";
  return null;
}

function knowledgeFor(
  flightId: number,
  ctx: CommandBracketContext,
): CommandKnowledgeSample | null {
  return commandKnowledgeAt(flightId, ctx.displayUt);
}

/**
 * The readout words for what the command centre knew at the displayed frame,
 * such as `MODELLED 4m12s`. The age runs from the last fix to the frame's UT,
 * so it matches the picture on screen. A UT that was estimated rather than
 * read from the frame says so.
 */
export function knowledgeReadout(
  sample: CommandKnowledgeSample,
  ctx: CommandBracketContext,
): string {
  const parts = [NETWORK_WORD[sample.network]];
  if (sample.lastKnownUt !== null) {
    parts.push(formatKnowledgeAge(ctx.displayUt - sample.lastKnownUt));
  }
  const words = parts.join(" ");
  return ctx.utSource === "estimated" ? `${words} · EST` : words;
}

/**
 * Tells a command camera's target brackets how the command centre knows the
 * target: a held or modelled target has its corners drawn in the state's
 * colour, and the readout says how the target is known and how old the last
 * fix is. Both are evaluated at the displayed frame's UT, never at now. A
 * current fix keeps Kerbcast's own colours, and a feed with no knowledge
 * published for it is drawn as Kerbcast draws it. The corners themselves,
 * their dashes when the target is occluded and their absence over a blanked
 * feed stay Kerbcast's.
 * Used by the camera feed widget.
 */
export function buildTargetBracketOverlay(
  flightId: number,
): CommandBracketOverlay {
  return {
    corners: (ctx) => {
      const sample = knowledgeFor(flightId, ctx);
      const kind = sample ? markKindFor(sample.network) : null;
      if (kind === null) return null;
      const colour = RECKONING_MARK[kind].color;
      return { topLeft: { colour }, bottomRight: { colour } };
    },
    readout: (defaultText, ctx) => {
      const sample = knowledgeFor(flightId, ctx);
      if (!sample) return defaultText;
      const words = knowledgeReadout(sample, ctx);
      return defaultText === "" ? words : `${defaultText} · ${words}`;
    },
  };
}

/**
 * The header badge for a target that is modelled or held, so the state shows
 * outside the picture when the operator has hidden the brackets. Null for a
 * current fix or no knowledge.
 */
export function describeKnowledgeBadge(
  sample: CommandKnowledgeSample | null,
): PanelBadge | null {
  if (!sample || markKindFor(sample.network) === null) return null;
  const word = NETWORK_WORD[sample.network];
  return {
    id: "target-knowledge",
    label: word,
    tone: sample.network === "modelled" ? "info" : "warn",
    title: `Target position: ${word.toLowerCase()}`,
  };
}
