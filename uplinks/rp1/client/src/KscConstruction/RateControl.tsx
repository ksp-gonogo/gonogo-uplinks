import { magnitudeOf } from "@ksp-gonogo/sitrep-sdk";
import {
  Cluster,
  CommandButton,
  MissionDate,
  NULL_DISPLAY,
  Stepper,
  Text,
  Unit,
} from "@ksp-gonogo/ui-kit";
import { useState } from "react";
import type {
  Rp1ConstructionEntry,
  Rp1ConstructionRateStep,
  Rp1ConstructionRateTable,
} from "../__generated__/contract.js";

/** Must match `Rp1ConstructionCommands.SetRateCommand`. */
export const RP1_CONSTRUCTION_SET_RATE_COMMAND = "rp1.construction.setRate";

/** Must match `Rp1ConstructionCommands.CancelCommand`. */
export const RP1_CONSTRUCTION_CANCEL_COMMAND = "rp1.construction.cancel";

/** RP-1's slider: twenty steps to the full rate, thirty to its fastest rush. */
const STEPS_PER_UNIT = 20;
const STEPS = Array.from({ length: 31 }, (_, step) => step);

type Handle = Parameters<typeof CommandButton>[0]["handle"];

/**
 * The slider step a work rate sits on, or null when RP-1 did not say. Rounded,
 * because RP-1 stores the slider's value through a float.
 */
function stepOf(workRate: Rp1ConstructionEntry["workRate"]): number | null {
  const rate = magnitudeOf(workRate);
  return rate === null ? null : Math.round(rate * STEPS_PER_UNIT);
}

const percent = (step: number) => `${step * 5}%`;

/**
 * The work rate on one construction, with what the chosen rate draws per day
 * and when it would finish beside it.
 *
 * <para><b>A construction is a progressive spend.</b> Nothing is charged when
 * the rate is set: RP-1 draws the funds as the work advances and slows it when
 * the career cannot meet the draw. So the figures under the stepper are a rate
 * and a date, never an affordability verdict.</para>
 *
 * <para>The stepper chooses and the button commits, because the rate is an
 * order that crosses the link like any other: stepping through six values
 * should not send six.</para>
 */
export function RateControl({
  row,
  label,
  table,
  handle,
}: Readonly<{
  row: Rp1ConstructionEntry;
  label: string;
  table: Rp1ConstructionRateTable | undefined;
  handle: Handle;
}>) {
  const current = stepOf(row.workRate);
  const [chosen, setChosen] = useState<number | null>(null);
  if (row.id == null || current === null) {
    return null;
  }
  const step = chosen ?? current;
  const priced = table?.steps?.find((s) => stepOf(s.workRate) === step);

  return (
    <Cluster align="start" gap="related-dense" justify="start" wrap>
      <Stepper
        format={percent}
        label={`Work rate for ${label}`}
        onChange={setChosen}
        options={STEPS}
        value={step}
      >
        <Text size="xs" level="muted">
          <StepReadout step={step} priced={priced} />
        </Text>
      </Stepper>
      <CommandButton
        args={{ id: row.id, workRate: step / STEPS_PER_UNIT }}
        aria-label={
          step === current
            ? `${label} is already at ${percent(step)}`
            : `Set ${label} to ${percent(step)}`
        }
        commandLabel={`Set ${label} to ${percent(step)}`}
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
 * What one rate costs and buys. Above the full rate RP-1 charges a rush
 * multiplier on every day's draw, and that is named, because a rush's price is
 * the multiplier and not only the bigger number.
 */
function StepReadout({
  step,
  priced,
}: Readonly<{ step: number; priced: Rp1ConstructionRateStep | undefined }>) {
  if (step === 0) {
    return <>stopped: draws nothing and never finishes</>;
  }
  if (priced === undefined || priced.costPerDay == null) {
    return <>{NULL_DISPLAY} RP-1 has not priced this rate yet</>;
  }
  const multiplier = magnitudeOf(priced.costMultiplier);
  return (
    <>
      draws <Unit decimals={0} value={priced.costPerDay} />, done{" "}
      <MissionDate value={priced.finishesAt} />
      {multiplier !== null && multiplier > 1 && (
        <>, rush cost ×{multiplier.toFixed(2)}</>
      )}
    </>
  );
}

/**
 * Stop building, as RP-1's own "X" does, with what has already been spent beside
 * it: RP-1 refunds none of it, and says so in its own confirmation.
 */
export function CancelControl({
  row,
  label,
  handle,
}: Readonly<{ row: Rp1ConstructionEntry; label: string; handle: Handle }>) {
  if (row.id == null) {
    return null;
  }
  return (
    <Cluster align="center" gap="related-dense" justify="start" wrap>
      <Text size="xs" level="muted">
        <Unit value={row.spentRushCost} /> spent, not refunded
      </Text>
      <CommandButton
        args={{ id: row.id }}
        aria-label={`Cancel ${label}`}
        commandLabel={`Cancel ${label}`}
        confirmAriaLabel={`Stop building ${label}; nothing already spent is refunded`}
        confirmLabel="Stop building"
        confirmTone="nogo"
        handle={handle}
        label="Cancel"
        size="sm"
      />
    </Cluster>
  );
}
