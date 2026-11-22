import { type Value, value } from "@ksp-gonogo/sitrep-sdk";

/**
 * A funds figure with its unit. An Uplink's own command replies reach the
 * client without units, so the amounts arrive as bare numbers and are given
 * theirs here; a reply that already carries them passes through. Null and
 * undefined stay absent, never zero.
 */
export function asFunds(amount: Value<"funds"> | number): Value<"funds">;
export function asFunds(
  amount: Value<"funds"> | number | null | undefined,
): Value<"funds"> | null;
export function asFunds(
  amount: Value<"funds"> | number | null | undefined,
): Value<"funds"> | null {
  if (amount === null || amount === undefined) {
    return null;
  }
  return typeof amount === "number" ? value("funds", amount) : amount;
}
