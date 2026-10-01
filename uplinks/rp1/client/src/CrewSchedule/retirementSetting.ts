import { useModSettings } from "@ksp-gonogo/sitrep-sdk";
import { current } from "../shared/current.js";

/**
 * Whether RP-1 retires crew on this save, from RP-1's own settings. `false`
 * only when RP-1 said retirement is off: a setting it could not read leaves
 * `undefined`, the same as never having heard, and the readouts that depend on
 * it keep drawing.
 */
export function useRetirementEnabled(): boolean | undefined {
  const model = current(useModSettings("rp1"));
  const row = model?.settings.find((s) => s.id === "retirementEnabled");
  if (row?.value === "False") {
    return false;
  }
  return row?.value === "True" ? true : undefined;
}
