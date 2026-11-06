import type { InboundVideoStats, KerbcastClient } from "@ksp-gonogo/kerbcast";
import { getUplinkHandle, logger } from "@ksp-gonogo/sitrep-sdk";
import { useEffect } from "react";
import type { KerbcastDataSource } from "../KerbcastDataSource.js";

/** How often a feed's receive counters are read, in milliseconds. */
export const STALL_SAMPLE_MS = 1000;

/** How long a wanted feed may receive no frames before a stall is logged, in milliseconds. */
export const STALL_AFTER_MS = 3000;

/* One stats read per client is shared by every feed sampling within this long, so several tiles cost one getStats. */
const SHARED_STATS_MS = 500;

const shared = new WeakMap<
  KerbcastClient,
  { at: number; stats: Promise<Map<number, InboundVideoStats>> }
>();

function inboundStats(client: KerbcastClient): Promise<Map<number, InboundVideoStats>> {
  const now = performance.now();
  const last = shared.get(client);
  if (last && now - last.at < SHARED_STATS_MS) return last.stats;
  const stats = client.inboundVideoStats().catch(() => new Map<number, InboundVideoStats>());
  shared.set(client, { at: now, stats });
  return stats;
}

/** Counts the frames a video element presents, through `requestVideoFrameCallback` where the browser has it. */
function presentedCounter(): {
  watch(video: HTMLVideoElement | null): void;
  count(): number | null;
  stop(): void;
} {
  let video: HTMLVideoElement | null = null;
  let handle: number | null = null;
  let frames = 0;
  let supported = false;
  const cancel = () => {
    if (video && handle !== null) video.cancelVideoFrameCallback?.(handle);
    handle = null;
  };
  const arm = () => {
    if (!video) return;
    const v = video;
    handle = v.requestVideoFrameCallback(() => {
      frames++;
      if (video === v) arm();
    });
  };
  return {
    watch(next) {
      if (next === video) return;
      cancel();
      video = next;
      supported = !!next && typeof next.requestVideoFrameCallback === "function";
      if (supported) arm();
    },
    count: () => (supported ? frames : null),
    stop: cancel,
  };
}

/**
 * Logs, under the `kerbcast:feed-stall` tag, when a feed that is still on
 * screen receives no video frames for {@link STALL_AFTER_MS}, and again when
 * frames return. Each line carries the camera's receive counters from the
 * peer's statistics (packets and frames received, frames decoded), the frames
 * the feed's video element has presented, and the element's state (whether it
 * has a stream, its ready state, whether it is paused), so a stall upstream of
 * the browser can be told from one in the receiver, the decoder or the element.
 * Received frames are read from `framesReceived`, or `packetsReceived` where
 * the browser does not report frames. Used by the camera feed.
 */
export function useFeedStallWatch(
  flightId: number | null,
  wrap: HTMLElement | null,
  playout: string,
): void {
  useEffect(() => {
    if (flightId === null || !wrap) return;
    const log = logger.tag("kerbcast:feed-stall");
    const presented = presentedCounter();
    let lastReceived: number | null = null;
    let quietSince: number | null = null;
    let stalledAt: number | null = null;
    let stopped = false;

    const sample = async () => {
      const client = getUplinkHandle<KerbcastDataSource>("kerbcast")?.getClient();
      if (!client) return;
      const video = wrap.querySelector("video");
      presented.watch(video);
      const stats = (await inboundStats(client)).get(flightId);
      if (stopped) return;
      const now = performance.now();
      const received = stats ? (stats.framesReceived ?? stats.packetsReceived) : null;
      const facts = () => ({
        flightId,
        playout,
        packetsReceived: stats?.packetsReceived ?? null,
        framesReceived: stats?.framesReceived ?? null,
        framesDecoded: stats?.framesDecoded ?? null,
        framesPresented: presented.count(),
        hasSrcObject: video?.srcObject != null,
        readyState: video?.readyState ?? null,
        paused: video?.paused ?? null,
      });
      const moved = received !== null && lastReceived !== null && received > lastReceived;
      const firstRead = lastReceived === null;
      lastReceived = received;
      if (moved || firstRead) {
        if (stalledAt !== null && moved) {
          log.info(`feed resumed after ${Math.round((now - stalledAt) / 1000)} s`, facts());
          stalledAt = null;
        }
        quietSince = moved ? null : now;
        return;
      }
      quietSince ??= now;
      if (stalledAt === null && now - quietSince >= STALL_AFTER_MS) {
        stalledAt = now;
        log.warn(`feed stalled: no frames received for ${Math.round((now - quietSince) / 1000)} s`, facts());
      }
    };

    const timer = setInterval(() => {
      void sample();
    }, STALL_SAMPLE_MS);
    return () => {
      stopped = true;
      clearInterval(timer);
      presented.stop();
    };
  }, [flightId, wrap, playout]);
}
