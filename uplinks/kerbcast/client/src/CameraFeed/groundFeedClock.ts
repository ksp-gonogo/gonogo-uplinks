import type { DelayClockLike, ViewClockLike } from "@ksp-gonogo/sitrep-sdk";
import { createContext, useContext, useMemo, useRef } from "react";

/**
 * The clock a ground camera's picture is released against, or `undefined` for
 * every other feed. Provided by the camera feed widget around the shared feed,
 * and read by {@link useDelayedKerbcastStream}, which the shared feed calls
 * with a camera id alone.
 */
export const GroundFeedClockContext = createContext<DelayClockLike | undefined>(
  undefined,
);

/** Reads the clock {@link GroundFeedClockContext} provides, if any. */
export function useGroundFeedClock(): DelayClockLike | undefined {
  return useContext(GroundFeedClockContext);
}

/**
 * A clock for one ground camera: the game's present, less the one-way delay
 * from the command centre the screen views from to the camera's own. Useful for
 * releasing a ground camera's picture at the delay of its own site, where the
 * shared view clock holds every feed to the active craft's delay. Used by the
 * camera feed widget.
 *
 * `undefined` when the feed is not a ground camera or no view clock is mounted.
 * A `null` delay (no route to the camera's centre) holds every frame, so the
 * picture is never shown live over a link that does not exist. An `undefined`
 * delay (the roster has not arrived) leaves the shared clock in charge.
 */
export function useGroundCameraClock(
  view: ViewClockLike | undefined,
  oneWaySeconds: number | null | undefined,
  isGroundCamera: boolean,
): DelayClockLike | undefined {
  const delay = useRef<number | null | undefined>(oneWaySeconds);
  delay.current = oneWaySeconds;
  return useMemo<DelayClockLike | undefined>(() => {
    if (!isGroundCamera || !view) return undefined;
    return {
      confirmedEdgeUt: () => {
        const d = delay.current;
        if (d === undefined) return view.confirmedEdgeUt();
        if (d === null) return Number.NEGATIVE_INFINITY;
        return view.utNowEstimate() - d;
      },
      onFrame: (cb) => view.onFrame(cb),
    };
  }, [view, isGroundCamera]);
}
