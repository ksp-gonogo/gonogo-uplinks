import { useModSettings } from "@ksp-gonogo/sitrep-sdk";
import { current } from "../shared/current.js";

/**
 * One boolean of RP-1's own settings. `false` only when RP-1 said it is off: a
 * setting it could not read leaves `undefined`, the same as never having heard,
 * and the readouts that depend on it keep drawing.
 */
function useRp1Switch(
  key: "retirementEnabled" | "missionTrainingEnabled",
): boolean | undefined {
  const model = current(useModSettings("rp1"));
  const row = model?.settings.find((s) => s.id === key);
  if (row?.value === "False") {
    return false;
  }
  return row?.value === "True" ? true : undefined;
}

/** Whether RP-1 retires crew on this save. */
export function useRetirementEnabled(): boolean | undefined {
  return useRp1Switch("retirementEnabled");
}

/** Whether RP-1 requires mission-specific training on this save. */
export function useMissionTrainingEnabled(): boolean | undefined {
  return useRp1Switch("missionTrainingEnabled");
}
