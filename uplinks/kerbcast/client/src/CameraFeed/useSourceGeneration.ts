import type { CameraState } from "@ksp-gonogo/kerbcast";
import { isCameraDestroyed } from "@ksp-gonogo/kerbcast-react";
import { logger } from "@ksp-gonogo/sitrep-sdk";
import { useEffect, useRef, useState } from "react";

const log = logger.tag("kerbcast:source-generation");

/** How far back the capture clock may step before it counts as a new timeline, in game seconds. */
const BACKWARD_JUMP_SECONDS = 1;

/**
 * A number that goes up whenever the frames of one camera start a new capture
 * timeline: the capture clock's epoch changes, its time steps backwards, the
 * camera comes back into the list after being absent or destroyed, or the
 * sidecar reports a new `attach` for it (which it does when the camera is
 * reattached in place, as after an undo that keeps the camera's id). A camera
 * that keeps its id and slot across a relaunch sends such frames down the same
 * receiver, so the delay holding the previous flight's frames needs this signal
 * to flush. The epoch the clock reports before its first capture time is the
 * clock's starting value, so the change to the real epoch with that first time
 * is not a new timeline. Each bump, and that ignored first change, is logged
 * under the `kerbcast:source-generation` tag with the epoch, capture time and
 * whether the camera was listed. Useful as the delay's reset epoch. Used by the
 * camera feed's delayed stream.
 */
export function useSourceGeneration(
  flightId: number | null,
  cameras: readonly CameraState[],
  captureUt: number | null,
  epoch: number,
): number {
  const [generation, setGeneration] = useState(0);
  const live =
    flightId !== null &&
    cameras.some((c) => c.flightId === flightId && !isCameraDestroyed(c));
  const bump = (source: string) => {
    log.info(
      `source generation bump: ${source} (epoch ${epoch}, capture ut ${captureUt}, listed ${live})`,
      {
        source,
        flightId,
        epoch,
        captureUt,
        live,
      },
    );
    setGeneration((n) => n + 1);
  };

  const lastUt = useRef<number | null>(null);
  const wasLive = useRef<boolean | null>(null);
  const attach = cameras.find((c) => c.flightId === flightId)?.attach;
  const lastAttach = useRef<number | undefined>(attach);
  const lastFlight = useRef(flightId);
  useEffect(() => {
    if (lastFlight.current === flightId) return;
    lastFlight.current = flightId;
    lastUt.current = null;
    wasLive.current = null;
    lastAttach.current = attach;
  }, [flightId, attach]);

  useEffect(() => {
    const before = lastAttach.current;
    lastAttach.current = attach;
    if (before !== undefined && attach !== undefined && attach !== before) {
      bump("attach");
    }
  }, [attach]);

  const lastEpoch = useRef(epoch);
  useEffect(() => {
    if (lastEpoch.current === epoch) return;
    const previous = lastEpoch.current;
    lastEpoch.current = epoch;
    if (lastUt.current === null) {
      log.info(
        `source generation ignored: first clock epoch (epoch ${previous} to ${epoch}, capture ut ${captureUt})`,
        {
          flightId,
          previous,
          epoch,
          captureUt,
          live,
        },
      );
      return;
    }
    bump("epoch");
  }, [epoch]);

  useEffect(() => {
    if (captureUt === null) return;
    const last = lastUt.current;
    lastUt.current = captureUt;
    if (last !== null && captureUt < last - BACKWARD_JUMP_SECONDS) {
      bump("capture-time-backwards");
    }
  }, [captureUt]);

  useEffect(() => {
    const before = wasLive.current;
    wasLive.current = live;
    if (before === false && live) bump("camera-listed");
  }, [live]);

  return generation;
}
