import {
  registerAugment,
  useAlarmRequest,
  useCommand,
  useTelemetry,
} from "@ksp-gonogo/sitrep-sdk";
import { Button, Inline, Stack, Text } from "@ksp-gonogo/ui-kit";
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

/** The request key, so asking again retargets the one alarm rather than adding another. */
export const RP1_NEXT_COMPLETION_ALARM_KEY = "next-completion";

/** Seconds before the project finishes to drop out of time warp. */
const LEAD_SECONDS = 10;

/**
 * What RP-1 is waiting for, beside the warp ladder that already exists.
 *
 * <para><b>An augment rather than a widget.</b> Warping is one act with one
 * piece of state, and the dashboard already has a control for it. RP-1 does not
 * add a second kind of warp; it adds something worth warping TO. So this binds
 * <c>warp-control.stepper</c>, the slot that exists for exactly this, and an
 * operator reads one warp control rather than hunting for whichever panel owns
 * the mod's version.</para>
 *
 * <para><b>It sets an alarm and warps nothing.</b> The button asks for an alarm
 * that follows the instant <c>rp1.nextCompletion</c> publishes. The mod reads
 * that instant on every tick, stops the warp ten seconds before it and fires at
 * it, so the alarm keeps up when a shorter project overtakes the one it was
 * waiting for, and it works with no screen open. RP-1 manages no warp for it:
 * what stops the warp is the alarm, in the operator's own alarm list, where
 * they can rename or remove it.</para>
 *
 * <para><b>It spends nothing.</b> Setting the alarm changes no queue, no
 * balance and no project, and the label says so.</para>
 *
 * <para><b>Nothing here stops warp.</b> The host widget's own "1x" button
 * already ends a warp, and a second control would be two buttons doing one
 * thing.</para>
 *
 * <para>The press is single, not armed: the alarm is reversible from the alarm
 * list, and an arm-then-confirm on a reversible act trains an operator to
 * double-press everything.</para>
 */
export function WarpTargets() {
  const available = current(useTelemetry("rp1.available"));
  const fundTarget = current(useTelemetry("rp1.fundTarget"));
  const next = current(useTelemetry("rp1.nextCompletion"));
  const requestAlarm = useAlarmRequest(RP1);

  // Unconditional and above the early return on purpose: a hook after it would
  // change count on the first frame RP-1 answers.
  const cancelFundTarget = useCommand(RP1_FUND_TARGET_CANCEL_COMMAND);

  // Invisible on every install without RP-1, which is most of them. An augment
  // that renders an empty row on a stock game is clutter that says nothing.
  if (available !== true) {
    return null;
  }

  const waiting = next?.ut != null;
  const project = next?.label ?? "the next project";

  return (
    <Stack gap="caption">
      <Inline gap="related-packed">
        <Button
          aria-label={`Set an alarm for when ${project} finishes. It spends nothing.`}
          disabled={!waiting}
          onClick={() =>
            requestAlarm({
              key: RP1_NEXT_COMPLETION_ALARM_KEY,
              name: "Next RP-1 project finishes",
              trigger: {
                kind: "instant",
                topic: "rp1.nextCompletion",
                fieldPath: "ut",
                leadSeconds: LEAD_SECONDS,
              },
            })
          }
          size="sm"
          type="button"
        >
          next completion
        </Button>
        <Text size="xs" level="muted">
          {waiting ? project : "nothing in progress"}
        </Text>
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
