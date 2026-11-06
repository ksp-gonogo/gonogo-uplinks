import type { DelayClockLike } from "@ksp-gonogo/sitrep-sdk";
import { logger } from "@ksp-gonogo/sitrep-sdk";
import {
  type FrameStampFeed,
  interpolateCaptureUt,
} from "@ksp-gonogo/sitrep-sdk/media";
import { useEffect, useRef, useState } from "react";

const log = logger.tag("kerbcast:frame-delay");

/** How far back, in game seconds, the game's present may step before the camera's clock is no longer trusted. */
export const PRESENT_STEP_BACK_SECONDS = 1;

/** How far ahead of the game's present, in wall seconds, a frame may be dated before the camera's clock is no longer trusted. */
export const AHEAD_LIMIT_SECONDS = 10;

/** How long frames must stay dated beyond {@link AHEAD_LIMIT_SECONDS} before the camera's clock is no longer trusted. */
export const AHEAD_HOLD_MS = 3000;

/** How often, in wall milliseconds, the dating of frames is compared with the game's present. */
const AHEAD_CHECK_MS = 500;

/**
 * What the delay log line says about a camera and its capture clock: the
 * camera's flight id, how long ago its
 * last clock sample and per-frame stamp arrived (null before the first), its
 * epoch, how many stamps arrived since the previous line, and whether the clock
 * is distrusted. Returned by {@link useCaptureClockHealth}'s `facts`.
 */
export interface CaptureClockFacts {
  flightId: number | null;
  sampleAgeSeconds: number | null;
  clockEpoch: number;
  stampsReceived: number;
  stampAgeSeconds: number | null;
  clockStale: boolean;
}

export interface CaptureClockHealthInput {
  flightId: number | null;
  view: DelayClockLike | undefined;
  captureUt: number | null;
  epoch: number;
  warpRate: number;
  frameStamps: FrameStampFeed | undefined;
}

/**
 * Whether one camera's capture clock can still date its frames against the
 * screen's view clock. It stops being trusted when the game's present steps
 * back by more than {@link PRESENT_STEP_BACK_SECONDS} (a revert or quickload
 * the camera's clock has not followed yet), or when frames have been dated more
 * than {@link AHEAD_LIMIT_SECONDS} ahead of the game's present for
 * {@link AHEAD_HOLD_MS}. It is trusted again once the source frames are dated
 * from (the per-frame stamps when the sidecar sends them, else the clock
 * samples) delivers a time after that which is not ahead of the present.
 * `resets` goes up on each change either way, for the caller to flush its delay
 * buffer with, and each change is logged under `kerbcast:frame-delay`. `facts`
 * is read once per delay log line and counts stamps since the previous read.
 * Used by the camera feed's delayed stream.
 */
export function useCaptureClockHealth(input: CaptureClockHealthInput): {
  stale: boolean;
  resets: number;
  facts: () => CaptureClockFacts;
} {
  const { flightId, view, captureUt, epoch, warpRate, frameStamps } = input;
  const [stale, setStale] = useState(false);
  const [resets, setResets] = useState(0);

  const latest = useRef({ captureUt, epoch, warpRate, frameStamps, flightId });
  latest.current = { captureUt, epoch, warpRate, frameStamps, flightId };
  const sampleAtMs = useRef<number | null>(null);
  const stamp = useRef<{ ut: number; atMs: number } | null>(null);
  const stampCount = useRef(0);
  const staleSince = useRef<number | null>(null);

  const presentUt = (): number | null => {
    if (!view) return null;
    const estimate = (view as { utNowEstimate?: () => number }).utNowEstimate;
    return typeof estimate === "function" ? estimate.call(view) : null;
  };

  /* Wall seconds `ut` lies ahead of the game's present, or null when the present is not known. */
  const aheadSeconds = (ut: number): number | null => {
    const present = presentUt();
    if (present === null) return null;
    return (ut - present) / Math.max(latest.current.warpRate || 1, 1);
  };

  /* The UT the next frame would be dated with, from the source the delay dates frames by. */
  const datingUt = (now: number): number | null => {
    const { frameStamps: stamps, captureUt: ut, warpRate: warp } = latest.current;
    if (stamps && stamp.current) return stamp.current.ut;
    if (ut === null || sampleAtMs.current === null) return null;
    return interpolateCaptureUt({ ut, warpRate: warp, atMs: sampleAtMs.current }, now);
  };

  const enter = (reason: string, facts: Record<string, unknown>) => {
    if (staleSince.current !== null) return;
    staleSince.current = performance.now();
    log.info(`capture clock stale: ${reason}`, { flightId: latest.current.flightId, ...facts });
    setStale(true);
    setResets((n) => n + 1);
  };

  /* A time from the dating source that arrived at `atMs`: trusted again if it came after the clock was distrusted and is not ahead. */
  const offer = (ut: number, atMs: number, source: string) => {
    const since = staleSince.current;
    if (since === null || atMs < since) return;
    const ahead = aheadSeconds(ut);
    if (ahead !== null && ahead > AHEAD_LIMIT_SECONDS) return;
    staleSince.current = null;
    log.info(`capture clock trusted again after ${Math.round(atMs - since)} ms, from a ${source}`, {
      flightId: latest.current.flightId,
      ut,
    });
    setStale(false);
    setResets((n) => n + 1);
  };

  useEffect(() => {
    if (captureUt === null) return;
    const now = performance.now();
    sampleAtMs.current = now;
    if (!latest.current.frameStamps || stamp.current === null) offer(captureUt, now, "clock sample");
  }, [captureUt, epoch]);

  useEffect(() => {
    stamp.current = null;
    if (!frameStamps) return;
    return frameStamps.subscribe((s) => {
      const now = performance.now();
      stamp.current = { ut: s.ut, atMs: now };
      stampCount.current++;
      offer(s.ut, now, "frame stamp");
    });
  }, [frameStamps]);

  useEffect(() => {
    if (!view) return;
    let lastPresent: number | null = null;
    let lastCheck = 0;
    let aheadFrom: number | null = null;
    return view.onFrame(() => {
      const present = presentUt();
      if (present === null) return;
      if (lastPresent !== null && present < lastPresent - PRESENT_STEP_BACK_SECONDS) {
        enter("the game clock stepped back", { from: lastPresent, to: present });
      }
      lastPresent = present;
      const now = performance.now();
      if (now - lastCheck < AHEAD_CHECK_MS) return;
      lastCheck = now;
      const ut = datingUt(now);
      const ahead = ut === null ? null : aheadSeconds(ut);
      if (ahead === null || ahead <= AHEAD_LIMIT_SECONDS) {
        aheadFrom = null;
        return;
      }
      aheadFrom ??= now;
      if (now - aheadFrom >= AHEAD_HOLD_MS) {
        enter("frames are dated ahead of the game", { present, datedAt: ut, aheadSeconds: Math.round(ahead) });
      }
    });
  }, [view]);

  const facts = (): CaptureClockFacts => {
    const now = performance.now();
    const age = (atMs: number | null) => (atMs === null ? null : Math.round((now - atMs) / 100) / 10);
    const received = stampCount.current;
    stampCount.current = 0;
    return {
      flightId: latest.current.flightId,
      sampleAgeSeconds: age(sampleAtMs.current),
      clockEpoch: latest.current.epoch,
      stampsReceived: received,
      stampAgeSeconds: age(stamp.current?.atMs ?? null),
      clockStale: staleSince.current !== null,
    };
  };

  return { stale, resets, facts };
}
