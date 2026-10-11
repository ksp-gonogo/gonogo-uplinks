import {
  registerAugment,
  useCommand,
  useTelemetry,
} from "@ksp-gonogo/sitrep-sdk";
import { CommandButton, Inline, Stack } from "@ksp-gonogo/ui-kit";
import { current } from "../shared/current.js";
import { RP1 } from "../uplink.js";
// Side-effect import: hydrates these Topics' units at decode time. Here rather
// than left to the entry point's import order, because this file is the
// consumer that would silently receive bare numbers without it.
import "../topics.js";
import {
  RP1_FUND_TARGET_CANCEL_COMMAND,
  StandingFundTarget,
} from "./FundTarget.js";

/** Warp until the career's next project finishes. Must match `Rp1WarpCommands.ToCompleteCommand`. */
export const RP1_WARP_TO_COMPLETE_COMMAND = "rp1.warp.toComplete";

/**
 * RP-1's warp target, beside the warp ladder that already exists.
 *
 * <para><b>Why this is an augment rather than a widget.</b> Warping is one act
 * with one piece of state, and the dashboard already has a control for it. RP-1
 * does not add a second kind of warp; it adds something worth warping TO, which
 * is a stop condition rather than a new concept. So this binds
 * <c>warp-control.stepper</c>, the slot that exists for exactly this, and an
 * operator reads one warp control rather than hunting for whichever panel owns
 * the mod's version.</para>
 *
 * <para><b>RP-1 drives warp for ONE thing.</b> Stopping a warp at a balance is
 * a threshold alarm on the career balance, set from the Finances tab beside
 * RP-1's forecast of when it fires. What stays here is a fund target RP-1's own
 * Maintenance screen stood up, because it halts warps and an operator should
 * see it beside the warp controls.</para>
 *
 * <para><b>Warp-to-complete stays, and its replacement does not exist.</b>
 * Nothing publishes "the next project to finish" as an instant a threshold could
 * be armed against: the candidates live across <c>rp1.buildQueue</c>,
 * <c>rp1.constructions</c>, <c>rp1.research</c> and <c>rp1.training</c>, and a
 * dotted path cannot index a list. Deleting it would remove the capability
 * rather than relocate it.</para>
 *
 * <para><b>Nothing here stops warp.</b> RP-1's own controller destroys itself the
 * moment it sees a warp rate of zero, so the host widget's existing "1x" button
 * already ends an RP-1 warp and a second control would be two buttons doing one
 * thing. That is a decision recorded in <c>Rp1WarpCommands</c> with the IL that
 * settles it, not an omission.</para>
 *
 * <para>The press is single, not armed: warping is reversible by the button next
 * door, and an arm-then-confirm on a reversible act trains an operator to
 * double-press everything.</para>
 */
export function WarpTargets() {
  const available = current(useTelemetry("rp1.available"));
  const fundTarget = current(useTelemetry("rp1.fundTarget"));

  // Unconditional and above the early return on purpose: a hook after it would
  // change count on the first frame RP-1 answers.
  const toComplete = useCommand(RP1_WARP_TO_COMPLETE_COMMAND);
  const cancelFundTarget = useCommand(RP1_FUND_TARGET_CANCEL_COMMAND);

  // Invisible on every install without RP-1, which is most of them. An augment
  // that renders an empty row on a stock game is clutter that says nothing.
  if (available !== true) {
    return null;
  }

  return (
    <Stack gap="caption">
      <Inline gap="related-packed">
        {/*
        Named for WHAT it warps to, on the operator's ruling that "next" alone did
        not say. The specific project would be better still and is not on this
        widget's wire: the next-to-finish is whichever of rp1.buildQueue,
        rp1.constructions, rp1.research and rp1.training has least time left, and
        reading four topics to label one button is a trade worth asking about
        rather than assuming.

        The "warp to" prefix came off the label because the section is already
        headed WARP, so every control was repeating it, and the render gate found
        it cut off at 38px. The full sentence stays in the accessible name, which
        costs no width.
      */}
        <CommandButton
          args={{}}
          aria-label="Warp until RP-1's next project finishes"
          commandLabel="Warp to next project completion"
          handle={toComplete}
          label="next completion"
          size="sm"
        />
      </Inline>

      {fundTarget?.active === true && (
        <StandingFundTarget handle={cancelFundTarget} target={fundTarget} />
      )}
    </Stack>
  );
}

registerAugment({
  id: "rp1-warp-targets",
  augments: "warp-control.stepper",
  component: WarpTargets,
  priority: 0,
  owner: RP1,
});
