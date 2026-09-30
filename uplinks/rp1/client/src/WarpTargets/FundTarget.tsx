import { CommandButton, NULL_DISPLAY, Row, Text, Unit } from "@ksp-gonogo/ui-kit";
import type { Rp1FundTarget } from "../__generated__/contract.js";

/** Withdraw a target RP-1's own screen stood up. Must match `Rp1TargetCommands.CancelFundCommand`. */
export const RP1_FUND_TARGET_CANCEL_COMMAND = "rp1.fundTarget.cancel";

/**
 * A fund target RP-1 is holding: what it is, how long RP-1 thinks it will take,
 * and the one press that withdraws it.
 *
 * <para>Only RP-1's own Maintenance screen stands one of these up, and it is a
 * warp stop condition that persists past the warp it stopped, so it is drawn
 * beside the warp controls where an unexplained halt would be noticed.</para>
 *
 * <para>No arm-then-confirm on the cancel. It spends nothing, and it is undone by
 * setting the target again, so an armed press would train an operator to
 * double-tap a reversible act.</para>
 */
export function StandingFundTarget({
  handle,
  target,
}: Readonly<{
  handle: Parameters<typeof CommandButton>[0]["handle"];
  target: Rp1FundTarget;
}>) {
  return (
    <Row as="div">
      <Text size="xs" level="muted">
        {target.targetFunds == null ? (
          NULL_DISPLAY
        ) : (
          <Unit value={target.targetFunds} decimals={0} />
        )}
        {target.timeLeft != null && (
          <>
            {" · "}
            <Unit value={target.timeLeft} /> away
          </>
        )}
      </Text>
      <CommandButton
        args={{}}
        aria-label="Cancel the fund target"
        commandLabel="Cancel the fund target"
        handle={handle}
        label="Cancel"
        size="sm"
      />
    </Row>
  );
}
