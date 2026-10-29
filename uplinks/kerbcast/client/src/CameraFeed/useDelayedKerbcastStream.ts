import { useKerbcastClock } from "@ksp-gonogo/kerbcast-react";
import type { DelayClockLike } from "@ksp-gonogo/sitrep-sdk";
import { getUplinkHandle, useViewClockOptional } from "@ksp-gonogo/sitrep-sdk";
import {
  type CaptureClockSample,
  interpolateCaptureUt,
} from "@ksp-gonogo/sitrep-sdk/media";
import type { KerbcastDataSource } from "../KerbcastDataSource.js";
import { useKerbcastCameras } from "../hooks/useKerbcastCameras.js";
import { useSourceGeneration } from "./useSourceGeneration.js";
import { useCallback, useEffect, useRef, useSyncExternalStore } from "react";
import {
  type DelayedPlayoutResult,
  useDelayedPlayout,
  useEncodedDelayTarget,
  useKerbcastStream,
} from "../hooks/useKerbcastStream.js";

// Re-exported for backward compat: `interpolateCaptureUt`/`CaptureClockSample`
// are the generic capture-clock helpers, published as `@ksp-gonogo/sitrep-sdk/media`
// so any camera Uplink's worker-hosted backend shares the exact same interpolation.
export type { CaptureClockSample } from "@ksp-gonogo/sitrep-sdk/media";
export { interpolateCaptureUt } from "@ksp-gonogo/sitrep-sdk/media";

// ---------------------------------------------------------------------------
// Delayed-playout STATUS side channel (cross-browser kerbcast video-delay
// design, 2026-07-16). `useDelayedKerbcastStream` is called BY the kerbcam
// SDK's `useStream` seam, which constrains its return type to
// `MediaStream | null` (`CameraStreamHook`: see `kerbcast-react`'s
// `CameraFeed.d.ts`). That leaves no channel for `CameraFeed.tsx` (which
// does NOT call this hook itself, the SDK does, internally) to learn
// "delay was expected here but the pipeline couldn't be built", which it
// needs to render the explicit "delayed feed unavailable" state (decision
// 5: never the live stream).
//
// Fix: this hook writes its OWN `DelayedPlayoutResult` into a tiny external
// store keyed by `flightId`, and `useDelayedPlaybackStatus` (below) reads it
// via `useSyncExternalStore`: the same "refcounted external resource,
// subscribe/notify" shape `KerbcastDataSource` and `PerfBudget` already use
// elsewhere in this codebase, just sized for a single in-memory value
// instead of a class. `CameraFeed.tsx` calls `useDelayedPlaybackStatus`
// directly (its own hook call, independent of the SDK's `useStream`
// invocation): no second pipeline is built; this is read-only.
//
// Status keying: by `flightId`, so two consumers of the SAME camera (e.g. a
// CameraFeed and the docking-HUD backdrop) share one status entry. That is
// now CORRECT rather than a lossy compromise: as of the per-camera sharing in
// `useDelayedPlayout` (2026-07-17) those two consumers ARE one delayed
// pipeline: `sharedDelayedStreams` keys the pipeline by the camera, so one
// `MediaStreamTrackProcessor` / `RTCRtpScriptTransform` per camera feeds every
// consumer, and they necessarily see the same delayed
// output and thus the same status. Delay is a property of the camera, not the
// viewer.
// ---------------------------------------------------------------------------

interface StatusEntry {
  status: DelayedPlayoutResult;
  listeners: Set<() => void>;
}
const statusByFlightId = new Map<number, StatusEntry>();

function publishStatus(flightId: number, status: DelayedPlayoutResult): void {
  let entry = statusByFlightId.get(flightId);
  if (!entry) {
    entry = { status, listeners: new Set() };
    statusByFlightId.set(flightId, entry);
  } else {
    entry.status = status;
  }
  for (const cb of entry.listeners) cb();
}

function subscribeStatus(flightId: number, cb: () => void): () => void {
  let entry = statusByFlightId.get(flightId);
  if (!entry) {
    entry = { status: { kind: "connecting" }, listeners: new Set() };
    statusByFlightId.set(flightId, entry);
  }
  entry.listeners.add(cb);
  return () => {
    entry?.listeners.delete(cb);
  };
}

function getStatusSnapshot(flightId: number): DelayedPlayoutResult {
  return statusByFlightId.get(flightId)?.status ?? { kind: "connecting" };
}

const NO_FLIGHT_STATUS: DelayedPlayoutResult = { kind: "raw", stream: null };

/**
 * Reactive read of the delayed-playout status published by
 * `useDelayedKerbcastStream` for `flightId`: the side channel documented
 * above. `CameraFeed.tsx` uses this to decide whether to render the
 * explicit "delayed feed unavailable" state instead of the SDK's normal
 * feed. `null` `flightId` always reads `{kind: "raw", stream: null}` (no
 * camera resolved yet: nothing to be unavailable about).
 */
export function useDelayedPlaybackStatus(
  flightId: number | null,
): DelayedPlayoutResult {
  return useSyncExternalStore(
    (cb) => (flightId === null ? () => {} : subscribeStatus(flightId, cb)),
    () => (flightId === null ? NO_FLIGHT_STATUS : getStatusSnapshot(flightId)),
  );
}

/**
 * gonogo's stream source for the shared `CameraFeed`, injected via its
 * `useStream` seam. It composes three already-tested
 * pieces without moving any of them into the SDK:
 *
 *   1. the SDK/data-source glue `useKerbcastStream`: the live `MediaStream`
 *      shown for the resolved flightId (auto-latch / fallback already applied
 *      by the feed, so this hook never re-derives it), with
 *      `useEncodedDelayTarget` for the receiver of the WebRTC track kerbcast's
 *      noise canvas draws it from, where the delay is attached when it can be;
 *   2. gonogo's `DelayedPlayoutBuffer` (via `useDelayedPlayout`);
 *   3. the one shared `ViewClock` telemetry reads (`useViewClockOptional`),
 *      plus the kerbcast mission-time capture clock (`useKerbcastClock`, SDK
 *      1.4.0) that tells us when each frame was captured.
 *
 * Single-authority guarantee: `view` is the same `ViewClock` instance every
 * delay-consistent telemetry surface reads, and the buffer only releases a
 * frame once that clock's `confirmedEdgeUt()` sweeps past the frame's capture
 * UT: so a media frame and a telemetry sample stamped the same UT surface on
 * the same clock crossing.
 *
 * Passthrough (byte-for-byte live, unchanged) in two cases, both by feeding
 * `useDelayedPlayout` no delay config:
 *   - no `TelemetryProvider` in the tree (`view === undefined`), the LAN case;
 *   - no capture clock yet (`captureUt == null`, old kerbcast plugin/sidecar,
 *     or before the first ~1Hz sample), so we never hold video without knowing
 *     when it was captured.
 *
 * When both are present, each arriving frame is dated and released against
 * `confirmedEdgeUt()`. A sidecar that sends per-frame stamps dates each frame
 * from the stamp matching its RTP timestamp. Otherwise the frame is stamped
 * with the live capture UT (the ~1Hz sample interpolated forward by warp rate),
 * which runs ahead of a game slower than wall time and snaps back at each
 * sample. A `resetEpoch` bump (revert / quickload / scene reload)
 * flushes the buffer so it resyncs rather than waiting on a UT that will never
 * arrive.
 *
 * Adapts `useDelayedPlayout`'s discriminated `DelayedPlayoutResult` down to
 * the `MediaStream | null` the SDK's `useStream` seam requires, `"raw"` and
 * `"delayed"` surface their stream (possibly `null` for `"raw"` while the
 * camera connects); `"connecting"` and `"unavailable"` both surface `null`
 * (the SDK just shows its own connecting/no-signal look either way). The
 * full result (including `"unavailable"`'s reason) is separately
 * published for `CameraFeed.tsx` to read via `useDelayedPlaybackStatus`
 * (see this module's top-of-file doc), so "can't delay" gets its own
 * explicit UI rather than being indistinguishable from "still connecting".
 *
 * Must be a stable module-scope reference (never redefined per render) and
 * passed consistently to `CameraFeed`, per the `useStream` rules-of-hooks
 * contract.
 */
export function useDelayedKerbcastStream(
  flightId: number | null,
): MediaStream | null {
  const raw = useKerbcastStream(flightId);
  const encodedTarget = useEncodedDelayTarget(flightId);
  // The facade's `useViewClockOptional` is typed `unknown` (opaque; see its
  // own doc: the concrete ViewClock stays app-internal). Narrow to
  // the structural `DelayClockLike` contract this module actually drives,
  // the real `ViewClock` satisfies it (see that class's own doc).
  const view = useViewClockOptional() as DelayClockLike | undefined;
  const { captureUt, epoch, warpRate } = useKerbcastClock();
  const sourceGeneration = useSourceGeneration(
    flightId,
    useKerbcastCameras(),
    captureUt,
    epoch,
  );

  // Latch each ~1Hz clock sample with the wall-clock instant we saw it, so the
  // per-frame `liveCaptureUt` can interpolate forward between samples. Kept in
  // a ref (not state): the buffer reads it lazily at frame-stamp time, and we
  // don't want a re-render per sample.
  const sampleRef = useRef<CaptureClockSample>({
    ut: captureUt,
    warpRate,
    atMs: 0,
  });
  useEffect(() => {
    sampleRef.current = { ut: captureUt, warpRate, atMs: performance.now() };
  }, [captureUt, warpRate]);

  // `interpolateCaptureUt` returns null when the latched sample has no UT,
  // which is a real answer and is passed through as one: the pipeline holds
  // the frame against the last UT it did see. Coalescing it to 0 stamped the
  // frame before every possible reveal edge, so a gap in the ~1Hz samples
  // released the picture live.
  const liveCaptureUt = useCallback(
    () => interpolateCaptureUt(sampleRef.current, performance.now()),
    [],
  );
  // The worker backend needs the RAW sample, not the interpolated value,
  // see `KerbcastStreamDelayOptions.getCaptureSample`'s doc.
  const getCaptureSample = useCallback(() => sampleRef.current, []);

  // The camera's own per-frame stamps, when the sidecar sends them. Frames are
  // then dated from the stamp matching their RTP timestamp and the ~1Hz clock
  // above is never consulted, so a game running slower than wall time cannot
  // push the stamps ahead and back.
  const frameStamps =
    flightId === null
      ? undefined
      : (getUplinkHandle<KerbcastDataSource>("kerbcast")?.frameStampFeed?.(
          flightId,
        ) ?? undefined);

  const result = useDelayedPlayout(
    raw,
    view && (frameStamps !== undefined || captureUt != null)
      ? {
          view,
          captureUt: liveCaptureUt,
          getCaptureSample,
          frameStamps,
          resetEpoch: sourceGeneration,
          encodedTarget,
        }
      : undefined,
  );

  useEffect(() => {
    if (flightId !== null) publishStatus(flightId, result);
  }, [flightId, result]);

  if (result.kind === "raw" || result.kind === "delayed") return result.stream;
  return null;
}
