import type { CameraState } from "@ksp-gonogo/kerbcast";
import { CameraKind } from "@ksp-gonogo/kerbcast";
import type { TopicPayload, Value } from "@ksp-gonogo/sitrep-sdk";
import { value } from "@ksp-gonogo/sitrep-sdk";

/** The link a feed's signal level, badge and control mode are read from. */
export interface CameraLink {
  connected: boolean | undefined;
  signalStrength: Value<"ratio"> | undefined;
  /** One-way delay the operator's command takes to reach the camera; null when there is no path. */
  oneWay: Value<"s"> | null | undefined;
}

/**
 * The link a camera is reached over: the active craft's own link for a part
 * camera, and the link from the command centre the screen views from to the
 * camera's command centre for a command camera. Useful for keeping a camera on
 * the ground at full signal through a craft blackout. Used by the camera feed
 * widget for its signal badge, the picture degrade, the control mode and the
 * delay its picture is held for.
 *
 * A command camera at the viewing centre, or at a site the roster does not list
 * (a launch pad stands beside home), reads full signal and no delay. A listed
 * centre other than the viewing one reads the delay of its routed path from the
 * viewing centre, and no link when `commandCentre.separation` holds no pair for
 * it. Until the roster has arrived and a viewing centre is known (the observed
 * vantage, else the roster's home) nothing is claimed, so a camera is never
 * shown dark on a roster that has not arrived.
 */
export function resolveCameraLink(
  camera: Pick<CameraState, "kind" | "commandCentre"> | undefined,
  craft: CameraLink,
  roster: TopicPayload<"commandCentre.roster"> | undefined,
  separation: TopicPayload<"commandCentre.separation"> | undefined,
  observedVantage: string | undefined,
): CameraLink {
  if (camera?.kind !== CameraKind.Command) return craft;

  const viewing =
    observedVantage ?? roster?.find((entry) => entry.isHome)?.id;
  if (!viewing) return UNKNOWN;

  const centre = camera.commandCentre?.stationId;
  const listed =
    centre !== undefined && roster?.some((entry) => entry.id === centre);
  if (!listed || centre === viewing) return FULL;

  const pair = separation?.pairs.find(
    (p) => p.from === viewing && p.to === centre,
  );
  if (!pair) {
    return { connected: false, signalStrength: value("ratio", 0), oneWay: null };
  }
  return {
    connected: true,
    signalStrength: value("ratio", 1),
    oneWay: pair.oneWaySeconds,
  };
}

const UNKNOWN: CameraLink = {
  connected: undefined,
  signalStrength: undefined,
  oneWay: undefined,
};

const FULL: CameraLink = {
  connected: true,
  signalStrength: value("ratio", 1),
  oneWay: value("s", 0),
};
