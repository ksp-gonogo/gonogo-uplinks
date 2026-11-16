import {
  type CommandResult,
  magnitudeOf,
  type UseCommandResult,
  useUtNow,
  useValueCommand,
  value,
} from "@ksp-gonogo/sitrep-sdk";
import {
  Button,
  Cluster,
  type CommandButtonHandle,
  MissionDate,
  NULL_DISPLAY,
  Slider,
  Stack,
  Text,
  Unit,
} from "@ksp-gonogo/ui-kit";
import { useEffect, useState } from "react";
import type {
  Rp1ConstructionEntry,
  Rp1ConstructionRateArgs,
  Rp1ConstructionRateStep,
  Rp1ConstructionRateTable,
} from "../__generated__/contract.js";

/** Must match `Rp1ConstructionCommands.SetRateCommand`. */
export const RP1_CONSTRUCTION_SET_RATE_COMMAND = "rp1.construction.setRate";

/** Must match `Rp1ConstructionCommands.CancelCommand`. */
export const RP1_CONSTRUCTION_CANCEL_COMMAND = "rp1.construction.cancel";

/** RP-1's slider: twenty steps to the full rate, thirty to its fastest rush. */
const STEPS_PER_UNIT = 20;
const MAX_RATE = 1.5;

type Handle = CommandButtonHandle;
type RateHandle = UseCommandResult<Rp1ConstructionRateArgs, CommandResult>;

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
 * What a construction draws per day at the rate it is running, off its rate
 * table, or null when RP-1 has not priced that rate. A stopped construction
 * draws nothing, which is a price and not an absence.
 */
export function drawPerDay(
  row: Rp1ConstructionEntry,
  table: Rp1ConstructionRateTable | undefined,
): number | null {
  const step = stepOf(row.workRate);
  if (step === null) {
    return null;
  }
  if (step === 0) {
    return 0;
  }
  return magnitudeOf(
    table?.steps?.find((s) => stepOf(s.workRate) === step)?.costPerDay,
  );
}

/**
 * The work rate on one construction as a slider, with what the rate under the
 * thumb draws per day and when it would finish beside it. The thumb marks the
 * rate commanded, a blue triangle the rate the construction is expected to run
 * at now and a yellow square the rate last reported while the reading is held.
 *
 * <para><b>A construction is a progressive spend.</b> Nothing is charged when
 * the rate is set: RP-1 draws the funds as the work advances and slows it when
 * the career cannot meet the draw. So the figures under the slider are a rate
 * and a date, never an affordability verdict.</para>
 *
 * <para>The rate is sent when the operator lets go of the thumb, so dragging
 * through six values sends one command. The figures follow the thumb meanwhile.</para>
 */
export function RateControl({
  row,
  label,
  table,
  handle,
  held = false,
}: Readonly<{
  row: Rp1ConstructionEntry;
  label: string;
  table: Rp1ConstructionRateTable | undefined;
  handle: RateHandle;
  /** The constructions reading is the last one heard rather than a current one. */
  held?: boolean;
}>) {
  const received = magnitudeOf(row.workRate);
  const nowUt = useUtNow() ?? 0;
  // This screen's newest rate, so the thumb follows a press before the centre's queue lists it.
  const [own, setOwn] = useState<number | null>(null);
  const rate = useValueCommand(RP1_CONSTRUCTION_SET_RATE_COMMAND, {
    received,
    own: own === null ? null : { value: own, at: value("ut", nowUt) },
    matches: (entry) => entry.label.startsWith(`Set ${label} to `),
  });
  const [previewed, setPreviewed] = useState<number | null>(null);
  const commanded = rate.commanded;
  // biome-ignore lint/correctness/useExhaustiveDependencies: the thumb returns to the commanded rate whenever that moves
  useEffect(() => setPreviewed(null), [commanded]);
  if (row.id == null || received === null || commanded === null) {
    return null;
  }
  const id = row.id;
  const step = previewed ?? Math.round(commanded * STEPS_PER_UNIT);
  const priced = table?.steps?.find((s) => stepOf(s.workRate) === step);

  return (
    <Stack gap="caption">
      <Slider
        aria-label={`Work rate for ${label}`}
        command={handle.toArgs((next: number) => {
          const to = Math.round(next * STEPS_PER_UNIT);
          return { id, workRate: to / STEPS_PER_UNIT };
        }, {
            label: `Set ${label} to ${percent(step)}`,
            before: (args) => setOwn(args?.workRate ?? null),
          },
        )}
        expected={rate.expected}
        expectedCaption="expected at the space centre now"
        figure={(v) => percent(Math.round(v * STEPS_PER_UNIT))}
        lastSeen={held ? received : null}
        lastSeenCaption="last reported"
        max={MAX_RATE}
        min={0}
        onChange={(e) =>
          setPreviewed(Math.round(Number(e.target.value) * STEPS_PER_UNIT))
        }
        step={1 / STEPS_PER_UNIT}
        value={commanded}
      />
      <Text size="xs" level="muted">
        <StepReadout step={step} priced={priced} />
      </Text>
    </Stack>
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
 * Stop building, as RP-1's own "X" does. RP-1 refunds no funds on a cancel and
 * drops the work, so the figure beside it is everything drawn so far: the share
 * of the price paid (`spentCost`) plus any rush premium on it (`spentRushCost`).
 */
export function CancelControl({
  row,
  label,
  handle,
}: Readonly<{ row: Rp1ConstructionEntry; label: string; handle: Handle }>) {
  if (row.id == null) {
    return null;
  }
  const spentRush = magnitudeOf(row.spentRushCost);
  const spent = magnitudeOf(row.spentCost);
  const premium =
    spentRush === null || spent === null ? null : spentRush - spent;
  return (
    <Cluster align="center" gap="related-dense" justify="start" wrap>
      <Text size="xs" level="muted">
        <Unit value={row.spentRushCost} /> drawn so far, none refunded
        {premium !== null && premium > 0 && (
          <>
            {" ("}
            <Unit value={value("funds", premium)} /> of it rush premium)
          </>
        )}
      </Text>
      <Button
        command={handle.with({ id: row.id }, { label: `Cancel ${label}` })}
        variant="ghost"
        aria-label={`Cancel ${label}`}
        confirmAriaLabel={`Stop building ${label}; nothing already spent is refunded`}
        confirmLabel="Stop building"
        confirmTone="nogo"
        size="sm"
      >
        Cancel
      </Button>
    </Cluster>
  );
}
