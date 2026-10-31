import { observedValue, useTelemetry } from "@ksp-gonogo/sitrep-sdk";
import { CameraKind, type CameraState } from "@ksp-gonogo/kerbcast";

const ELECTRIC_CHARGE = "ElectricCharge";

/**
 * Whether the part camera `camera` has no power: it is a camera on the active
 * vessel and that vessel's Electric Charge reads empty. False for a command
 * camera or a kerbal face camera, for a camera on another vessel, and while the
 * vessel's resources or name are not currently reported, because a missing
 * reading is not an empty battery. Used by {@link CameraFeed} to cover the
 * picture of a camera that cannot be running.
 */
export function useCraftPowerLost(camera: CameraState | undefined): boolean {
  const identity = observedValue(useTelemetry("vessel.identity"));
  const resources = observedValue(useTelemetry("vessel.resources"));
  if (!camera || camera.kind === CameraKind.Command || camera.kind === CameraKind.Kerbal) {
    return false;
  }
  if (!identity || identity.name !== camera.vesselName) return false;
  const charge = resources?.resources?.[ELECTRIC_CHARGE];
  if (!charge) return false;
  return charge.current.magnitude <= 0;
}
