import { magnitudeOf, value } from "@ksp-gonogo/sitrep-sdk";
import {
  Cluster,
  CommandButton,
  MissionDate,
  NULL_DISPLAY,
  Stack,
  Stepper,
  Text,
  Unit,
} from "@ksp-gonogo/ui-kit";
import { useState } from "react";
import type {
  Rp1ResearchEntry,
  Rp1ResearchRates,
  Rp1ResearchRateStep,
} from "../__generated__/contract.js";

/** Must match `Rp1ResearchRateCommands.SetRateCommand`. */
export const RP1_RESEARCH_SET_RATE_COMMAND = "rp1.research.setRate";

/** RP-1's research slider: twenty steps of 5%, and the full rate is its top. */
const STEPS_PER_UNIT = 20;
const STEPS = Array.from({ length: STEPS_PER_UNIT + 1 }, (_, step) => step);

type Handle = Parameters<typeof CommandButton>[0]["handle"];

const percent = (step: number) => `${step * 5}%`;

/** The stepper names its quantity, since one rate above the list reads as nothing on its own. */
const formatRate = (step: number) => `${percent(step)} work rate`;

/**
 * The slider step a work rate sits on, or null when RP-1 did not say. Rounded,
 * because the rate crosses the wire as a double RP-1 computed.
 */
function stepOf(workRate: Rp1ResearchEntry["workRate"]): number | null {
  const rate = magnitudeOf(workRate);
  return rate === null ? null : Math.round(rate * STEPS_PER_UNIT);
}

/**
 * The research queue's work rate, with what the chosen rate pays researchers,
 * earns in Unlock Credit and when the node being researched would finish, and
 * how the pay and credit differ from the rate the queue runs at now.
 *
 * <para><b>Research is a progressive spend.</b> Researchers are paid every day
 * at any rate, the idle share of their salary when stopped, so a rate is a
 * trade of salary against speed and credit and never an affordability
 * verdict.</para>
 *
 * <para>One rate for the whole queue, because RP-1's slider writes the same
 * rate onto every node. The stepper chooses and the button commits, so stepping
 * through six values does not send six orders across the link.</para>
 */
export function ResearchRateControl({
  queue,
  rates,
  handle,
}: Readonly<{
  queue: readonly Rp1ResearchEntry[];
  rates: Rp1ResearchRates | undefined;
  handle: Handle;
}>) {
  const head = queue[0];
  const current = stepOf(head?.workRate);
  const [chosen, setChosen] = useState<number | null>(null);
  if (head === undefined || current === null) {
    return null;
  }
  const step = chosen ?? current;
  const priced = (rates?.steps ?? []).find((s) => stepOf(s.workRate) === step);
  const now = (rates?.steps ?? []).find((s) => stepOf(s.workRate) === current);
  // A table priced for a node that has since finished would date the wrong one.
  const sameNode = rates?.techId != null && rates.techId === head.techId;
  const node = head.techName ?? head.techId ?? "the node";

  return (
    <Cluster align="start" gap="related-dense" justify="start" wrap>
      <Stepper
        format={formatRate}
        label="Research work rate"
        onChange={setChosen}
        options={STEPS}
        value={step}
      >
        <Stack gap="caption">
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
      </Stepper>
      <CommandButton
        args={{ workRate: step / STEPS_PER_UNIT }}
        aria-label={
          step === current
            ? `Research is already at ${percent(step)}`
            : `Set research to ${percent(step)}`
        }
        commandLabel={`Set research to ${percent(step)}`}
        confirmLabel={`Set ${percent(step)}`}
        disabled={step === current}
        handle={handle}
        label="Set rate"
        size="sm"
      />
    </Cluster>
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
          , Unlock Credit <Unit decimals={0} value={priced.unlockCreditPerDay} />
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
  const pay = difference(priced.researcherSalaryPerDay, now.researcherSalaryPerDay);
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
