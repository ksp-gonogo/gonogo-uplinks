import { getUplinkHandle, logger } from "@ksp-gonogo/sitrep-sdk";
import { useEffect } from "react";
import type { KerbcastDataSource } from "../KerbcastDataSource.js";

/** How long after a feed mounts, or switches camera, its binding is read. */
export const BIND_PROBE_DELAY_MS = 3000;

/**
 * Logs once, a few seconds after a feed mounts or switches camera, whether the
 * camera's handle holds a stream, whether the feed's video element is playing
 * that stream and how much of it has decoded, under the `kerbcast:feed-bind`
 * tag. Useful for telling a black feed whose stream never arrived from one
 * whose stream is not on the video element. Used by {@link CameraFeed}.
 */
export function useFeedBindProbe(
  flightId: number | null,
  wrap: HTMLElement | null,
  playout: string,
): void {
  useEffect(() => {
    if (flightId === null || !wrap) return;
    const timer = setTimeout(() => {
      const stream =
        getUplinkHandle<KerbcastDataSource>("kerbcast")
          ?.getClient()
          .camera(flightId).mediaStream ?? null;
      const video = wrap.querySelector("video");
      logger.tag("kerbcast:feed-bind").info("feed bind", {
        flightId,
        playout,
        handleHasStream: stream !== null,
        hasVideoElement: video !== null,
        videoHasThatStream: video !== null && stream !== null && video.srcObject === stream,
        videoHasSrcObject: video?.srcObject != null,
        paused: video?.paused ?? null,
        readyState: video?.readyState ?? null,
        videoWidth: video?.videoWidth ?? null,
      });
    }, BIND_PROBE_DELAY_MS);
    return () => clearTimeout(timer);
  }, [flightId, wrap, playout]);
}
