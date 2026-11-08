import { useEffect, useSyncExternalStore } from "react";
import type { CameraSite } from "./cameraSite.js";

/** Wall-clock milliseconds a camera standing elsewhere may stay unheard before it leaves the picker. */
export const UNHEARD_AFTER_MS = 5000;

/*
 * Two sets, both about cameras on another craft or at a ground station.
 *
 * `streamed`: cameras that have delivered a decoded video frame to this screen.
 * An announced camera, or a state sample from its site, does not count: only a
 * frame that arrived.
 *
 * `unheard`: cameras that were displayed, never streamed, and whose site is not
 * arriving. Such a camera has nothing to show and nothing to lose a link to, so
 * it leaves the picker instead of staying on as a message. One that did stream
 * and then lost its link is not here: it keeps its place and says its link is
 * lost.
 */
let streamed: ReadonlySet<number> = new Set();
let unheard: ReadonlySet<number> = new Set();
const listeners = new Set<() => void>();

function notify(): void {
  for (const listener of [...listeners]) listener();
}

/** Records that a decoded frame of camera `flightId` reached this screen. */
export function noteFrameReceived(flightId: number): void {
  if (streamed.has(flightId)) return;
  streamed = new Set([...streamed, flightId]);
  notify();
}

function mark(flightId: number): void {
  if (unheard.has(flightId)) return;
  unheard = new Set([...unheard, flightId]);
  notify();
}

function clear(flightId: number): void {
  if (!unheard.has(flightId)) return;
  const next = new Set(unheard);
  next.delete(flightId);
  unheard = next;
  notify();
}

/** Empties both sets, for tests. */
export function resetUnheardCameras(): void {
  streamed = new Set();
  unheard = new Set();
  notify();
}

function subscribe(listener: () => void): () => void {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

/** The cameras that were displayed from elsewhere, never streamed, and are not arriving. */
export function useUnheardCameras(): ReadonlySet<number> {
  return useSyncExternalStore(subscribe, () => unheard);
}

/**
 * Marks the displayed camera as unheard when it stands elsewhere, has never
 * delivered a frame, and its site's link is silent, or has stayed unheard for
 * {@link UNHEARD_AFTER_MS}. The mark clears when a frame arrives or its site is
 * live.
 */
export function useTrackUnheard(
  flightId: number | null,
  site: CameraSite,
): void {
  const hasStreamed = useSyncExternalStore(
    subscribe,
    () => flightId !== null && streamed.has(flightId),
  );
  const link = site.kind === "elsewhere" ? site.link : "n/a";
  useEffect(() => {
    if (flightId === null) return;
    if (hasStreamed || link === "live") {
      clear(flightId);
      return;
    }
    if (link === "silent") {
      mark(flightId);
      return;
    }
    if (link !== "unknown") return;
    const timer = setTimeout(() => mark(flightId), UNHEARD_AFTER_MS);
    return () => clearTimeout(timer);
  }, [flightId, hasStreamed, link]);
}

/**
 * Notes the first decoded frame of `stream` as camera `flightId`'s, by playing
 * it into a detached muted video until one arrives. Stops watching as soon as
 * it has.
 */
export function useFrameWitness(
  flightId: number | null,
  stream: MediaStream | null,
): void {
  useEffect(() => {
    if (flightId === null || stream === null || streamed.has(flightId)) return;
    const video = document.createElement("video");
    video.muted = true;
    video.playsInline = true;
    let done = false;
    const seen = () => {
      if (done) return;
      done = true;
      noteFrameReceived(flightId);
    };
    video.addEventListener("loadeddata", seen);
    if (typeof video.requestVideoFrameCallback === "function") {
      video.requestVideoFrameCallback(seen);
    }
    video.srcObject = stream;
    void video.play().catch(() => {});
    return () => {
      done = true;
      video.removeEventListener("loadeddata", seen);
      video.pause();
      video.srcObject = null;
    };
  }, [flightId, stream]);
}
