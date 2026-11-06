import type { CommandBracketOverlay } from "@ksp-gonogo/kerbcast-react";
import { RECKONING_MARK, ReckoningMarkSvg } from "@ksp-gonogo/ui-kit";
import { type NetworkKnowledge, networkReadout } from "./networkKnowledge.js";

const HEARD_COLOUR = "var(--kerbcast-bracket-clear, #4caf50)";

function cornerColour(k: NetworkKnowledge): string {
  if (k.kind === "modelled") return RECKONING_MARK.modelled.color;
  if (k.kind === "held" || k.kind === "blackout") return RECKONING_MARK.held.color;
  return HEARD_COLOUR;
}

/**
 * The bracket additions for a ground camera: the network corner (bottom right)
 * takes the colour of how the viewing command centre knows the craft, and the
 * held square or the modelled triangle replaces the bracket there when that is
 * not a current observation, and the readout gains the network half after the camera half.
 * Useful for telling the operator, beside what the lens can see, whether the
 * craft is where the centre last heard it. Used by the camera feed widget.
 *
 * `undefined` knowledge leaves the shared brackets as they are.
 */
export function groundBracketOverlay(
  knowledge: NetworkKnowledge | undefined,
): CommandBracketOverlay | undefined {
  if (!knowledge) return undefined;
  const marked =
    knowledge.kind === "modelled"
      ? "modelled"
      : knowledge.kind === "held" || knowledge.kind === "blackout"
        ? "held"
        : null;
  return {
    corners: {
      bottomRight: { colour: cornerColour(knowledge), hidden: marked !== null },
    },
    render: (ctx) =>
      marked === null ? null : (
        <ReckoningMarkSvg
          kind={marked}
          x={ctx.geometry.bottomRight.x}
          y={ctx.geometry.bottomRight.y}
          scale={1.4}
        />
      ),
    readout: (defaultText) =>
      defaultText === ""
        ? defaultText
        : `${defaultText} · ${networkReadout(knowledge)}`,
  };
}
