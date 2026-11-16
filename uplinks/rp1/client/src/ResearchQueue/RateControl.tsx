import {
  type CommandResult,
  magnitudeOf,
  type UseCommandResult,
  useUtNow,
  useValueCommand,
  value,
} from "@ksp-gonogo/sitrep-sdk";
import {
  MissionDate,
  NULL_DISPLAY,
  Slider,
  Stack,
  Text,
  Unit,
} from "@ksp-gonogo/ui-kit";
import { useEffect, useState } from "react";
import type {
  Rp1ResearchEntry,
  Rp1ResearchRateArgs,
  Rp1ResearchRates,
  Rp1ResearchRateStep,
} from "../__generated__/contract.js";

/** Must match `Rp1ResearchRateCommands.SetRateCommand`. */
export const RP1_RESEARCH_SET_RATE_COMMAND = "rp1.research.setRate";

/** RP-1's research slider: twenty steps of 5%, and the full rate is its top. */
const STEPS_PER_UNIT = 20;

type Handle = UseCommandResult<Rp1ResearchRateArgs, CommandResult>;

const percent = (step: number) => `${step * 5}%`;

/**
 * The slider step a work rate sits on, or null when RP-1 did not say. Rounded,
 * because the rate crosses the wire as a double RP-1 computed.
 */
function stepOf(workRate: Rp1ResearchEntry["workRate"]): number | null {
  const rate = magnitudeOf(workRate);
  return rate === null ? null : Math.round(rate * STEPS_PER_UNIT);
}

/**
 * The research queue's work rate as a slider, with what the rate under the
 * thumb pays researchers, earns in Unlock Credit and when the node being
 * researched would finish, and how the pay and credit differ from the rate the
 * queue runs at now. A blue triangle marks the rate the queue is expected to run
 * at now and a yellow square the rate last reported while the reading is held.
 *
 * <para><b>Research is a progressive spend.</b> Researchers are paid every day
 * at any rate, the idle share of their salary when stopped, so a rate is a
 * trade of salary against speed and credit and never an affordability
 * verdict.</para>
 *
 * <para>One rate for the whole queue, because RP-1's slider writes the same
 * rate onto every node. The rate is sent when the operator lets go of the
 * thumb, so dragging through six values sends one command.</para>
 */
export function ResearchRateControl({
  queue,
  rates,
  handle,
  held = false,
}: Readonly<{
  queue: readonly Rp1ResearchEntry[];
  rates: Rp1ResearchRates | undefined;
  handle: Handle;
  /** The research reading is the last one heard rather than a current one. */
  held?: boolean;
}>) {
  const head = queue[0];
  const received = magnitudeOf(head?.workRate);
  const nowUt = useUtNow() ?? 0;
  // This screen's newest rate, so the thumb follows a press before the centre's queue lists it.
  const [own, setOwn] = useState<number | null>(null);
  const rate = useValueCommand(RP1_RESEARCH_SET_RATE_COMMAND, {
    received,
    own: own === null ? null : { value: own, at: value("ut", nowUt) },
  });
  const [previewed, setPreviewed] = useState<number | null>(null);
  const commanded = rate.commanded;
  // biome-ignore lint/correctness/useExhaustiveDependencies: the thumb returns to the commanded rate whenever that moves
  useEffect(() => setPreviewed(null), [commanded]);
  if (head === undefined || received === null || commanded === null) {
    return null;
  }
  const current = Math.round(received * STEPS_PER_UNIT);
  const step = previewed ?? Math.round(commanded * STEPS_PER_UNIT);
  const priced = (rates?.steps ?? []).find((s) => stepOf(s.workRate) === step);
  const now = (rates?.steps ?? []).find((s) => stepOf(s.workRate) === current);
  // A table priced for a node that has since finished would date the wrong one.
  const sameNode = rates?.techId != null && rates.techId === head.techId;
  const node = head.techName ?? head.techId ?? "the node";

  return (
    <Stack gap="caption">
      <Slider
        aria-label="Research work rate"
        command={handle.toArgs((next: number) => ({
          workRate: Math.round(next * STEPS_PER_UNIT) / STEPS_PER_UNIT,
        }), {
            label: `Set research to ${percent(step)}`,
            before: (args) => setOwn(args?.workRate ?? null),
          },
        )}
        expected={rate.expected}
        expectedCaption="expected at the space centre now"
        figure={(v) => `${percent(Math.round(v * STEPS_PER_UNIT))} work rate`}
        lastSeen={held ? received : null}
        lastSeenCaption="last reported"
        max={1}
        min={0}
        onChange={(e) =>
          setPreviewed(Math.round(Number(e.target.value) * STEPS_PER_UNIT))
        }
        step={1 / STEPS_PER_UNIT}
        value={commanded}
      />
      <Text size="xs" level="muted">
        <StepReadout
          step={step}
          priced={priced}
          node={node}
          dated={sameNode}
        />
      </Text>
      {step !== current && priced !== undefined && now !== undefined && (
        <Text size="xs" level="muted">
          <Change priced={priced} now={now} />
        </Text>
      )}
    </Stack>
  );
}

/**
 * What one rate pays, earns and buys. A stopped queue still pays the idle share
 * of salary, and that is named, because "stopped" reads as free and is not.
 */
function StepReadout({
  step,
  priced,
  node,
  dated,
}: Readonly<{
  step: number;
  priced: Rp1ResearchRateStep | undefined;
  node: string;
  dated: boolean;
}>) {
  if (priced === undefined || priced.researcherSalaryPerDay == null) {
    return <>{NULL_DISPLAY} RP-1 has not priced this rate yet</>;
  }
  const salary = <Unit decimals={0} value={priced.researcherSalaryPerDay} />;
  if (step === 0) {
    return (
      <>
        stopped: researchers still paid {salary}, no Unlock Credit, {node} never
        finishes
      </>
    );
  }
  return (
    <>
      researchers paid {salary}
      {priced.unlockCreditPerDay != null && (
        <>
          , Unlock Credit{" "}
          <Unit decimals={0} value={priced.unlockCreditPerDay} />
        </>
      )}
      {dated && priced.finishesAt != null && (
        <>
          , {node} done <MissionDate value={priced.finishesAt} />
        </>
      )}
    </>
  );
}

/** How the chosen rate's pay and credit differ from the rate the queue runs at now. */
function Change({
  priced,
  now,
}: Readonly<{ priced: Rp1ResearchRateStep; now: Rp1ResearchRateStep }>) {
  const pay = difference(
    priced.researcherSalaryPerDay,
    now.researcherSalaryPerDay,
  );
  const credit = difference(priced.unlockCreditPerDay, now.unlockCreditPerDay);
  if (pay === null && credit === null) {
    return null;
  }
  return (
    <>
      against now:
      {pay !== null && <> pay {pay}</>}
      {pay !== null && credit !== null && ","}
      {credit !== null && <> Unlock Credit {credit}</>}
    </>
  );
}

function difference(
  chosen: Rp1ResearchRateStep["researcherSalaryPerDay"],
  now: Rp1ResearchRateStep["researcherSalaryPerDay"],
) {
  const a = magnitudeOf(chosen);
  const b = magnitudeOf(now);
  if (a === null || b === null) {
    return null;
  }
  const delta = a - b;
  return (
    <>
      <Unit decimals={0} value={value("f/day", Math.abs(delta))} />{" "}
      {delta < 0 ? "less" : "more"}
    </>
  );
}
