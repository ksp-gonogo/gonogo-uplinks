import { useKerbcastDisplaySizes } from "@ksp-gonogo/kerbcast-react";
import { type RefObject, useEffect, useId, useRef, useState } from "react";
import { frameBox, frameRequest } from "./frameShape.js";

/**
 * Every request waits this long for the size to stop changing, so a resize
 * being dragged asks once, at its end.
 */
const REPORT_DEBOUNCE_MS = 200;

function fullscreenElementWithin(stage: HTMLElement): Element | null {
  const d = document as Document & { webkitFullscreenElement?: Element | null };
  const full = d.fullscreenElement ?? d.webkitFullscreenElement ?? null;
  return full && stage.contains(full) ? full : null;
}

/**
 * Tell the sidecar what resolution to render this camera at, from the layout
 * alone: the box `stage` is given by the tile, fitted to 16:9 (`frameBox`) and
 * sized from that frame's width (`frameRequest`). `stage` is measured by its own
 * observer here, and nothing the stream produces (its frame size, the
 * `<video>`'s size, the camera's render size) is read, so a change of
 * resolution can never cause another. Requests are debounced, and one equal to
 * the last one sent is not sent again. Must sit inside a `KerbcastProvider`.
 * Entering or leaving fullscreen on a descendant of `stage` asks once for the
 * fullscreen element's size and once for the tile's. Clears its report on unmount and when the camera changes.
 */
export function useReportFrameSize(
  flightId: number | null,
  stage: RefObject<HTMLElement | null>,
): void {
  // gonogo:reads none
  const displaySizes = useKerbcastDisplaySizes();
  const instanceId = useId();
  const [el, setEl] = useState<HTMLElement | null>(null);
  useEffect(() => {
    if (stage.current !== el) setEl(stage.current);
  });

  const lastSent = useRef<string | null>(null);

  useEffect(() => {
    if (flightId === null || !el || typeof ResizeObserver === "undefined") {
      return;
    }
    let timer: ReturnType<typeof setTimeout> | null = null;
    const schedule = (box: { w: number; h: number }) => {
      const frame = frameBox(box);
      const request = frameRequest(frame.width);
      if (timer !== null) clearTimeout(timer);
      timer = null;
      if (!request) return;
      const key = `${request.width}x${request.height}`;
      if (lastSent.current === key) return;
      timer = setTimeout(() => {
        lastSent.current = key;
        displaySizes.report(flightId, instanceId, request.width, request.height);
      }, REPORT_DEBOUNCE_MS);
    };
    const fullscreenBox = () => {
      const full = fullscreenElementWithin(el);
      if (!full) return null;
      const rect = full.getBoundingClientRect();
      return rect.width > 0 && rect.height > 0
        ? { w: Math.floor(rect.width), h: Math.floor(rect.height) }
        : { w: window.innerWidth, h: window.innerHeight };
    };
    let tileBox = { w: 0, h: 0 };
    const observer = new ResizeObserver((entries) => {
      const rect = entries[entries.length - 1]?.contentRect;
      if (!rect) return;
      tileBox = { w: Math.floor(rect.width), h: Math.floor(rect.height) };
      schedule(fullscreenBox() ?? tileBox);
    });
    observer.observe(el);
    // The tile does not resize when the feed goes fullscreen, so the observer
    // above never sees it; entering and leaving are read here instead.
    const onFullscreenChange = () => {
      schedule(fullscreenBox() ?? tileBox);
    };
    document.addEventListener("fullscreenchange", onFullscreenChange);
    document.addEventListener("webkitfullscreenchange", onFullscreenChange);
    return () => {
      observer.disconnect();
      document.removeEventListener("fullscreenchange", onFullscreenChange);
      document.removeEventListener("webkitfullscreenchange", onFullscreenChange);
      if (timer !== null) clearTimeout(timer);
      lastSent.current = null;
      displaySizes.clear(flightId, instanceId);
    };
  }, [displaySizes, flightId, el, instanceId]);
}
