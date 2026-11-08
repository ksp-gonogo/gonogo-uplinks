import {
  type DelayClockLike,
  type TopicClockLink,
  useTelemetry,
  useTopicClock,
} from "@ksp-gonogo/sitrep-sdk";
import { CameraKind } from "@ksp-gonogo/kerbcast";
import { useKerbcastCameras } from "../hooks/useKerbcastCameras.js";
import { useMemo } from "react";
import type { KerbcastCameraEntry } from "../__generated__/contract.js";
import { CAMERA_TOPIC_PREFIX } from "../topics.js";

/** The Topic one camera's own state is delivered on, at the delay of the place the camera stands. */
export function cameraTopic(flightId: number): string {
  return `${CAMERA_TOPIC_PREFIX}${flightId}`;
}

/**
 * Where a camera stands relative to the craft being flown, which decides what
 * its picture is delayed by.
 *
 * - `none`: no camera is displayed
 * - `pending`: the craft being flown's camera list has not been heard yet, so
 *   nothing says which craft the camera is on
 * - `active`: the camera is on the craft being flown, and rides the shared view
 *   clock
 * - `ground`: the camera is a command camera at a ground station, which the
 *   camera feed releases against its own station's clock
 * - `elsewhere`: the camera is on another craft or at a ground station, and
 *   rides its own Topic's clock. `link` is that Topic's, so a camera whose site
 *   has no link of its own reads `"silent"` while the craft being flown is
 *   still live
 */
export type CameraSite =
  | { kind: "none" }
  | { kind: "pending" }
  | { kind: "active" }
  | { kind: "ground" }
  | {
      kind: "elsewhere";
      clock: DelayClockLike | undefined;
      link: TopicClockLink;
      delaySeconds: number | undefined;
    };

/**
 * The camera list of the craft being flown, or `undefined` before it has been
 * heard. A roster is a fact fitted by an event, so a held reading still names
 * the cameras, and a confirmed absence is the empty list.
 */
function activeCameras(
  reading: ReturnType<typeof useTelemetry<"kerbcast.cameras">>,
): KerbcastCameraEntry[] | undefined {
  if (reading.state === "observed" || reading.state === "held") {
    return reading.value;
  }
  if (reading.state === "absent") return [];
  return undefined;
}

/**
 * The camera ids the craft being flown's own list names, empty until that list
 * has been heard. Holds one identity for as long as the ids are the same.
 */
export function useActiveCameraIds(): ReadonlySet<number> {
  const list = activeCameras(useTelemetry("kerbcast.cameras"));
  const key = (list ?? [])
    .map((c) => c.cameraId)
    .filter((id): id is number => typeof id === "number")
    .join(",");
  return useMemo(
    () => new Set(key === "" ? [] : key.split(",").map(Number)),
    [key],
  );
}

/**
 * Which clock the camera `flightId` is released against, and whether its
 * site's link is arriving. A camera that is not on the craft being flown is
 * read from its own per-camera Topic, which is subscribed only while the
 * camera is displayed.
 *
 * A camera whose craft cannot be told is `pending`, never assumed to be the
 * craft being flown's.
 */
export function useCameraSite(flightId: number | null): CameraSite {
  const list = activeCameras(useTelemetry("kerbcast.cameras"));
  const isCommand = useKerbcastCameras().some(
    (c) => c.flightId === flightId && c.kind === CameraKind.Command,
  );
  const onActive =
    flightId === null || list === undefined
      ? undefined
      : list.some((c) => c.cameraId === flightId);
  // Subscribed for any displayed camera rather than only once it is known to
  // stand elsewhere: the mod publishes nothing under it for a camera on the
  // craft being flown, and its first sample is then not held up behind the
  // craft being flown's list.
  const lens = useTopicClock(flightId === null ? "" : cameraTopic(flightId));

  if (flightId === null) return { kind: "none" };
  if (isCommand) return { kind: "ground" };
  if (onActive === undefined) return { kind: "pending" };
  if (onActive) return { kind: "active" };
  return {
    kind: "elsewhere",
    clock: lens.clock,
    link: lens.link,
    delaySeconds: lens.delaySeconds,
  };
}

/** Whether the camera's picture must be held: it stands elsewhere and nothing is arriving from there. */
export function isDark(site: CameraSite): boolean {
  return site.kind === "elsewhere" && site.link !== "live";
}
