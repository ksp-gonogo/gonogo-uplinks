import type {
  ClockFormulaSnapshot,
  ViewClockLike,
} from "@ksp-gonogo/sitrep-sdk";
import type { SnapshottableDelayClock } from "@ksp-gonogo/sitrep-sdk/media";
import { createContext, useContext, useMemo, useRef } from "react";

const COLD: ClockFormulaSnapshot = {
  epoch: 0,
  maxSampleUt: Number.NEGATIVE_INFINITY,
  delaySeconds: 0,
  warpRate: 1,
  slackSeconds: 0,
};

/**
 * The clock a ground camera's picture is released against, or `undefined` for
 * every other feed. Provided by the camera feed widget around the shared feed,
 * and read by {@link useDelayedKerbcastStream}, which the shared feed calls
 * with a camera id alone.
 */
export const GroundFeedClockContext = createContext<SnapshottableDelayClock | undefined>(
  undefined,
);

/** Reads the clock {@link GroundFeedClockContext} provides, if any. */
export function useGroundFeedClock(): SnapshottableDelayClock | undefined {
  return useContext(GroundFeedClockContext);
}

/**
 * A clock for one ground camera: the game's present, less the one-way delay
 * from the command centre the screen views from to the camera's own. Useful for
 * releasing a ground camera's picture at the delay of its own site, where the
 * shared view clock holds every feed to the active craft's delay. Used by the
 * camera feed widget.
 *
 * It carries a `snapshot()` as well as the main-thread reading, so the delay
 * worker can follow it: the worker keeps one clock per camera, and a clock with
 * no snapshot sends the feed to the main-thread path, which a browser that
 * cannot delay there never shows.
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
): SnapshottableDelayClock | undefined {
  const delay = useRef<number | null | undefined>(oneWaySeconds);
  delay.current = oneWaySeconds;
  return useMemo<(SnapshottableDelayClock & Pick<ViewClockLike, "utNowEstimate">) | undefined>(() => {
    if (!isGroundCamera || !view) return undefined;
    const base = view as Partial<SnapshottableDelayClock> & ViewClockLike;
    return {
      /* The capture clock health check reads the game's present from the clock
         its feed releases against; without this a ground feed could not see a
         revert and would hold its frames against the old timeline. */
      utNowEstimate: () => view.utNowEstimate(),
      snapshot: (): ClockFormulaSnapshot => {
        const shared = base.snapshot?.() ?? COLD;
        const d = delay.current;
        if (d === undefined) return shared;
        if (d === null) return { ...shared, maxSampleUt: Number.NEGATIVE_INFINITY };
        /* The craft's own samples must not clamp a ground picture: in a craft
           blackout they stop, and the picture would freeze with them. With no
           craft sample yet the clamp is the present estimate, so the picture
           is held until the game's clock is known. */
        return {
          ...shared,
          delaySeconds: d,
          maxSampleUt:
            shared.maxSampleUt === Number.NEGATIVE_INFINITY
              ? view.utNowEstimate()
              : shared.maxSampleUt,
          slackSeconds: Number.POSITIVE_INFINITY,
        };
      },
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
