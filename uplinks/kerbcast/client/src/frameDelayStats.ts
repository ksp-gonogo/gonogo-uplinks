import { logger } from "@ksp-gonogo/sitrep-sdk";
import type { FrameDelayStats } from "@ksp-gonogo/sitrep-sdk/media";

/**
 * The `onStats` callback to hand a frame-delay backend: each report logs, under
 * the `kerbcast:frame-delay` tag, how many frames a second the delay read from
 * the camera and presented to the screen since the last report, how many frames
 * it holds now (`buffered`, from the totals) and how long they are held
 * (`heldSeconds`, from `heldSeconds()`, null while the capture clock has no
 * time). Useful for telling a feed that stalls because frames stop arriving
 * from one whose frames the delay is holding or discarding. The first report
 * measures from when the logger was made.
 */
export function frameDelayStatsLogger(
  heldSeconds: () => number | null,
): (stats: FrameDelayStats) => void {
  const log = logger.tag("kerbcast:frame-delay");
  let last: FrameDelayStats | null = null;
  let lastAt = performance.now();
  return (stats) => {
    const now = performance.now();
    const seconds = Math.max((now - lastAt) / 1000, 1e-3);
    const before = last;
    last = stats;
    lastAt = now;
    const since = (pick: (s: FrameDelayStats) => number) =>
      pick(stats) - (before ? pick(before) : 0);
    const dropped =
      stats.pacerSkipped +
      stats.evicted +
      stats.flushDropped +
      stats.awaitingKeyframeDropped;
    log.info("frame rates", {
      readPerSec: round(since((s) => s.read) / seconds),
      presentedPerSec: round(since((s) => s.presented) / seconds),
      buffered: Math.max(0, stats.read - stats.presented - dropped),
      heldSeconds: heldSeconds(),
      pacerSkipped: since((s) => s.pacerSkipped),
      pacerCatchUps: since((s) => s.pacerCatchUps),
      evicted: since((s) => s.evicted),
      flushDropped: since((s) => s.flushDropped),
      awaitingKeyframeDropped: since((s) => s.awaitingKeyframeDropped),
    });
  };
}

function round(n: number): number {
  return Math.round(n * 10) / 10;
}
