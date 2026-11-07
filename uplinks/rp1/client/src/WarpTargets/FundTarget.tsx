import {
  Button,
  type CommandButtonHandle,
  NULL_DISPLAY,
  Row,
  RowName,
  Stack,
  Text,
  Unit,
} from "@ksp-gonogo/ui-kit";
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
  handle: CommandButtonHandle;
  target: Rp1FundTarget;
}>) {
  return (
    <Stack gap="related-dense">
      <Row as="div">
        <RowName>Fund target</RowName>
        <Text size="xs">
          {target.targetFunds == null ? (
            NULL_DISPLAY
          ) : (
            <Unit value={target.targetFunds} decimals={0} />
          )}
        </Text>
      </Row>
      {target.timeLeft != null && (
        <Row as="div">
          <RowName>Reached in</RowName>
          <Text size="xs">
            <Unit value={target.timeLeft} />
          </Text>
        </Row>
      )}
      <Button
        command={handle.with({}, { label: "Cancel the fund target" })}
        variant="ghost"
        aria-label="Cancel the fund target"
        size="sm"
      >
        Cancel
      </Button>
    </Stack>
  );
}
