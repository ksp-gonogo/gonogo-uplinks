import { useKerbcastDisplaySizes } from "@ksp-gonogo/kerbcast-react";
import { type RefObject, useEffect, useId, useRef, useState } from "react";
import { frameBox, frameRequest } from "./frameShape.js";

/**
 * Every request waits this long for the size to stop changing, so a resize
 * being dragged asks once, at its end.
 */
const REPORT_DEBOUNCE_MS = 200;

/**
 * Tell the sidecar what resolution to render this camera at, from the layout
 * alone: the box `stage` is given by the tile, fitted to 16:9 (`frameBox`) and
 * sized from that frame's width (`frameRequest`). `stage` is measured by its own
 * observer here, and nothing the stream produces (its frame size, the
 * `<video>`'s size, the camera's render size) is read, so a change of
 * resolution can never cause another. Requests are debounced, and one equal to
 * the last one sent is not sent again. Must sit inside a `KerbcastProvider`.
 * Clears its report on unmount and when the camera changes.
 */
export function useReportFrameSize(
  flightId: number | null,
  stage: RefObject<HTMLElement | null>,
): void {
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
    const observer = new ResizeObserver((entries) => {
      const rect = entries[entries.length - 1]?.contentRect;
      if (!rect) return;
      const frame = frameBox({
        w: Math.floor(rect.width),
        h: Math.floor(rect.height),
      });
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
    });
    observer.observe(el);
    return () => {
      observer.disconnect();
      if (timer !== null) clearTimeout(timer);
      lastSent.current = null;
      displaySizes.clear(flightId, instanceId);
    };
  }, [displaySizes, flightId, el, instanceId]);
}
