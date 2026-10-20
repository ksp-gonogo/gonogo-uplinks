import { logger } from "@ksp-gonogo/sitrep-sdk";
import type { FrameDelayStats } from "@ksp-gonogo/sitrep-sdk/media";

/**
 * The browser storage key that turns on frame-delay logging. Set it to `"1"` in
 * the console (`localStorage.setItem("gonogo.kerbcast.frameDelayStats", "1")`)
 * and reload; the worker then reports its running frame totals under the
 * `kerbcast:frame-delay` log tag. Off unless set, because a reporting worker
 * wakes on a timer for every delayed camera.
 */
export const FRAME_DELAY_STATS_KEY = "gonogo.kerbcast.frameDelayStats";

function flagIsOn(): boolean {
  try {
    return localStorage.getItem(FRAME_DELAY_STATS_KEY) === "1";
  } catch {
    return false;
  }
}

/**
 * The `onStats` callback to hand a worker-hosted frame-delay backend, or
 * undefined while the {@link FRAME_DELAY_STATS_KEY} flag is off, which leaves
 * the worker with nothing to report to and so silent. Read once per pipeline
 * build, so the flag takes effect for the next camera that is delayed.
 */
export function frameDelayStatsLogger():
  | ((stats: FrameDelayStats) => void)
  | undefined {
  if (!flagIsOn()) return undefined;
  const log = logger.tag("kerbcast:frame-delay");
  return (stats) => {
    log.info("frame totals", { ...stats });
  };
}
