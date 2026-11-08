import { value } from "@ksp-gonogo/sitrep-sdk";
import {
  Meter,
  MeterStack,
  magnitudeOf,
  Stack,
  Text,
  writeQuantity,
} from "@ksp-gonogo/ui-kit";
import type { KerbalismEva } from "../__generated__/contract.js";
import { doseRateDecimals } from "./RadiationSection.js";

type MeterTone = "go" | "warn" | "nogo";

/** Tank levels are the stock "running out" direction: the less left, the worse. */
function levelTone(fraction: number | null): MeterTone | undefined {
  if (fraction === null) return undefined;
  if (fraction < 0.1) return "nogo";
  if (fraction < 0.25) return "warn";
  return "go";
}

/** Survival rules climb toward a fatal threshold: the more accumulated, the worse. */
function accumulatorTone(fraction: number): MeterTone {
  if (fraction >= 0.8) return "nogo";
  if (fraction >= 0.5) return "warn";
  return "go";
}

function amountLabel(amount: number | null, capacity: number | null): string | undefined {
  if (amount === null || capacity === null) return undefined;
  return `${Math.round(amount * 10) / 10} / ${Math.round(capacity * 10) / 10}`;
}

/**
 * The supplies, radiation and survival rules of the kerbal who is outside,
 * from `kerbalism.eva`. Each figure Kerbalism did not report is drawn as absent.
 */
export function SuitSection({
  eva,
  displayName,
}: {
  eva: KerbalismEva;
  displayName: (resource: string) => string;
}) {
  const resources = Object.entries(eva.resources ?? {});
  const radPerSec = magnitudeOf(eva.radiationRadPerSecond);
  const rules = (eva.rules ?? []).flatMap((rule) => {
    const problem = magnitudeOf(rule.problem);
    const threshold = magnitudeOf(rule.fatalThreshold);
    if (problem === null || threshold === null || threshold <= 0) return [];
    return [{ name: rule.name ?? "", fraction: Math.min(1, Math.max(0, problem / threshold)) }];
  });

  return (
    <Stack gap="caption" data-testid="suit-section">
      {eva.name && (
        <Text size="xs">{eva.name}</Text>
      )}
      <MeterStack>
        {resources.map(([name, resource]) => {
          const amount = magnitudeOf(resource.amount);
          const capacity = magnitudeOf(resource.capacity);
          const fraction =
            amount === null || capacity === null || capacity <= 0
              ? null
              : Math.min(1, Math.max(0, amount / capacity));
          return (
            <Meter
              key={name}
              label={displayName(name)}
              value={fraction === null ? null : value("ratio", fraction)}
              tone={levelTone(fraction)}
              valueLabel={amountLabel(amount, capacity)}
            />
          );
        })}
        {rules.map((rule) => (
          <Meter
            key={rule.name}
            label={rule.name.charAt(0).toUpperCase() + rule.name.slice(1)}
            value={value("ratio", rule.fraction)}
            tone={accumulatorTone(rule.fraction)}
            valueLabel={writeQuantity(value("%", rule.fraction * 100), { decimals: 0 })}
          />
        ))}
      </MeterStack>
      {radPerSec !== null && (
        <Text size="xs">
          Exposure {(radPerSec * 3600).toFixed(doseRateDecimals(radPerSec * 3600))} rad/h
        </Text>
      )}
    </Stack>
  );
}
