import type { CameraState } from "@ksp-gonogo/kerbcast";
import { isCameraDestroyed } from "@ksp-gonogo/kerbcast-react";
import { useEffect, useRef, useState } from "react";

/** How far back the capture clock may step before it counts as a new timeline, in game seconds. */
const BACKWARD_JUMP_SECONDS = 1;

/**
 * A number that goes up whenever the frames of one camera start a new capture
 * timeline: the capture clock's epoch changes, its time steps backwards, or the
 * camera comes back into the list after being absent or destroyed. A camera
 * that keeps its id and slot across a relaunch sends such frames down the same
 * receiver, so the delay holding the previous flight's frames needs this signal
 * to flush. Useful as the delay's reset epoch. Used by the camera feed's
 * delayed stream.
 */
export function useSourceGeneration(
  flightId: number | null,
  cameras: readonly CameraState[],
  captureUt: number | null,
  epoch: number,
): number {
  const [generation, setGeneration] = useState(0);
  const bump = () => setGeneration((n) => n + 1);

  const lastUt = useRef<number | null>(null);
  const wasLive = useRef<boolean | null>(null);
  const lastFlight = useRef(flightId);
  useEffect(() => {
    if (lastFlight.current === flightId) return;
    lastFlight.current = flightId;
    lastUt.current = null;
    wasLive.current = null;
  }, [flightId]);

  const lastEpoch = useRef(epoch);
  useEffect(() => {
    if (lastEpoch.current === epoch) return;
    lastEpoch.current = epoch;
    bump();
  }, [epoch]);

  useEffect(() => {
    if (captureUt === null) return;
    const last = lastUt.current;
    lastUt.current = captureUt;
    if (last !== null && captureUt < last - BACKWARD_JUMP_SECONDS) bump();
  }, [captureUt]);

  const live =
    flightId !== null &&
    cameras.some((c) => c.flightId === flightId && !isCameraDestroyed(c));
  useEffect(() => {
    const before = wasLive.current;
    wasLive.current = live;
    if (before === false && live) bump();
  }, [live]);

  return generation;
}
