import type { KerbcastCameraHandle } from "@ksp-gonogo/kerbcast";
import {
  type DelayClockLike,
  getUplinkHandle,
  logger,
} from "@ksp-gonogo/sitrep-sdk";
import {
  attachEncodedWorkerFrameDelay,
  type BuiltDelayedStream,
  type CaptureClockSample,
  createFrameDelayStream,
  createWorkerFrameDelayStream,
  DEFAULT_PACING_MAX_LEAD_SECONDS,
  type DelayedStreamBuildContext,
  type EncodedFrameDelayHandle,
  type FrameStampFeed,
  interpolateCaptureUt,
  isFrameDelaySupported,
  SharedDelayedStreams,
  type SnapshottableDelayClock,
} from "@ksp-gonogo/sitrep-sdk/media";
import { useEffect, useMemo, useRef, useState } from "react";
import { frameDelayStatsLogger } from "../frameDelayStats.js";
import type { KerbcastDataSource } from "../KerbcastDataSource.js";

/** A neutral capture sample for the moment before the ~1Hz clock arrives,
 *  `ut: null` makes the worker/encoded backends treat frames as un-stampable
 *  (interpolation yields `null`), never stamping against a bogus UT. */
/** How long a camera's delay pipeline outlives its last feed, in milliseconds. */
export const PIPELINE_RELEASE_GRACE_MS = 500;

const NEUTRAL_CAPTURE_SAMPLE: CaptureClockSample = {
  ut: null,
  warpRate: 1,
  atMs: 0,
};

/**
 * The per-lease contribution the shared cache reads: the live capture-clock
 * source. A pipeline is shared across every consumer of one camera and
 * outlives whichever consumer happened to build it, so the build must read
 * the capture UT through `ctx.contribution()` (the first still-live lease's),
 * never a closure over the builder's own refs, which freeze when that
 * consumer unmounts. See `SharedDelayedStreams`' contribution-seam doc.
 */
interface CaptureContribution {
  /** `null` when the clock cannot be read for this frame, the same absence
   *  `NEUTRAL_CAPTURE_SAMPLE` carries for the worker/encoded backends. */
  captureUt(): number | null;
  getCaptureSample(): CaptureClockSample;
}

/**
 * One delayed pipeline per camera, shared app-wide. Keyed by the camera's
 * encoded delay target where there is one, and otherwise by the shown
 * `MediaStream` object identity: every consumer of one kerbcast camera gets the
 * same camera handle and the same `cam.mediaStream` reference (the data source
 * refcounts the camera), so two widgets on one camera share a single pipeline
 * and the same delayed output. A `MediaStreamTrack` admits only one `MediaStreamTrackProcessor`
 * (and an `RTCRtpReceiver` only one `RTCRtpScriptTransform`); delaying once at
 * the source is what makes a second viewer possible at all, and it halves the
 * decode cost. See `SharedDelayedStreams`.
 */
const sharedDelayedStreams = new SharedDelayedStreams<
  DelayedPlayoutResult,
  CaptureContribution
>();

/**
 * Live `MediaStream` for one kerbcast camera. Returns `null` while
 * the WebRTC track hasn't arrived yet (during connection setup, or
 * after a disconnect). Components bind the stream to a `<video>`'s
 * `srcObject` directly.
 *
 * Works on both screens. The main screen connects to the sidecar directly; a
 * station uses the brokered data source (`KerbcastDataSource.attachBroker`), the
 * offer→answer relays through the host, but media flows station↔sidecar
 * directly, so the `MediaStream` itself never crosses PeerJS.
 *
 * This is the thin data-source glue only, a strict LAN passthrough. Delayed
 * playout is layered on top by composing it with {@link useDelayedPlayout}
 * (see `useDelayedKerbcastStream`), which keeps the SDK / buffer / clock
 * concerns cleanly separated.
 */
export function useKerbcastStream(flightId: number | null): MediaStream | null {
  const [rawStream, setRawStream] = useState<MediaStream | null>(() => {
    if (flightId === null) return null;
    const ds = getUplinkHandle<KerbcastDataSource>("kerbcast");
    return ds?.getClient().camera(flightId).mediaStream ?? null;
  });

  useEffect(() => {
    if (flightId === null) {
      setRawStream(null);
      return;
    }
    const ds = getUplinkHandle<KerbcastDataSource>("kerbcast");
    if (!ds) return;
    const cam = ds.getClient().camera(flightId);
    setRawStream(cam.mediaStream);
    const off = cam.on("stream", setRawStream);
    // Bind a slot for this camera while it's on screen; release it on unmount /
    // camera switch. The data source refcounts, so several widgets showing the
    // same camera share one slot.
    ds.subscribeCamera(flightId);
    return () => {
      off();
      ds.unsubscribeCamera(flightId);
    };
  }, [flightId]);

  return rawStream;
}

/**
 * Puts the encoded video delay on one receiver and returns its handle, or
 * `null` when it cannot be attached there.
 */
export type InstallEncodedDelay = (
  receiver: RTCRtpReceiver,
) => EncodedFrameDelayHandle | null;

/**
 * Where the encoded video delay attaches for one camera. `attach` puts the
 * delay on the camera's receiver through `install`, and the handle it returns
 * removes it. `key` identifies the attachment: every consumer of the camera
 * shares one delayed pipeline under it. Taken by {@link useDelayedPlayout} as
 * `encodedTarget`. `holdMs` gives the delay in milliseconds a frame is held for
 * now, or `NaN` when it is not known.
 */
export interface EncodedDelayTarget {
  key: object;
  attach(
    install: InstallEncodedDelay,
    holdMs: () => number,
  ): EncodedFrameDelayHandle | null;
}

/**
 * The encoded delay target for one kerbcast camera: Kerbcast installs the delay
 * on whichever receiver the camera is on, ahead of decode and the static
 * canvas, and moves it when the camera is rebound. `null` where Kerbcast cannot
 * install a script transform, in which case the delay runs on the shown stream
 * instead. Useful for delaying the camera's video before it is decoded. Used by
 * the camera feed.
 */
export function useEncodedDelayTarget(
  flightId: number | null,
): EncodedDelayTarget | null {
  const client =
    flightId === null
      ? undefined
      : getUplinkHandle<KerbcastDataSource>("kerbcast")?.getClient();
  const scriptPath = client?.encodedTransformPath === "script";
  return useMemo(() => {
    if (flightId === null || !client || !scriptPath) return null;
    const cam = client.camera(flightId);
    return { key: cam, attach: (install, holdMs) =>
        attachThroughKerbcast(cam, install, holdMs),
    };
  }, [client, flightId, scriptPath]);
}

/**
 * Hands Kerbcast a factory that makes one delay transform per receiver the
 * camera lands on, each with its own pipeline built at the moment Kerbcast asks
 * for it, the previous one disposed. A throwaway is built first and disposed
 * unassigned, so a delay that cannot be installed here is known before Kerbcast
 * is told to use it.
 */
function attachThroughKerbcast(
  cam: KerbcastCameraHandle,
  install: InstallEncodedDelay,
  holdMs: () => number,
): EncodedFrameDelayHandle | null {
  const make = (): { handle: EncodedFrameDelayHandle; transform: unknown } | null => {
    /* attachEncodedWorkerFrameDelay sets the transform it builds on the
       receiver it is given, and clears it on dispose; Kerbcast does the
       installing here, so it is given a stand-in to set it on. */
    const standIn = { transform: null as unknown };
    const handle = install(standIn as unknown as RTCRtpReceiver);
    if (!handle) return null;
    if (!standIn.transform) {
      handle.dispose();
      return null;
    }
    return { handle, transform: standIn.transform };
  };

  const probe = make();
  if (!probe) return null;
  probe.handle.dispose();
  let current: ReturnType<typeof make> = null;
  try {
    cam.setEncodedTransform(() => {
      current?.handle.dispose();
      current = make();
      if (!current) {
        throw new Error(
          "the video delay could not be installed on this camera's receiver",
        );
      }
      return current.transform as RTCRtpScriptTransform;
    }, { holdMs });
  } catch (err) {
    logger
      .tag("kerbcast:frame-delay")
      .warn("Kerbcast refused the video delay transform", { err });
    return null;
  }
  return {
    dispose() {
      cam.setEncodedTransform(null);
      current?.handle.dispose();
      current = null;
    },
    flush() {
      current?.handle.flush();
    },
    leadLimitSeconds: () =>
      current?.handle.leadLimitSeconds() ?? DEFAULT_PACING_MAX_LEAD_SECONDS,
  };
}

/**
 * Opt-in delayed playout for a raw kerbcast `MediaStream`. Omit this argument
 * entirely for LAN passthrough; see `DelayedPlayoutResult`'s `"raw"` kind, the
 * one retained live-video path.
 *
 * A real per-frame delay:
 * every video frame read off the track is individually stamped with the
 * live interpolated capture UT and gated on the shared clock; see
 * `../frameDelay.ts` (main-thread backend, Chrome) and `../worker/`
 * (worker-hosted backend, Safari today / Firefox once its worker-side
 * Breakout Box lands: see the video-worker report for the per-engine
 * verification this dual-backend split rests on).
 */
export interface KerbcastStreamDelayOptions {
  /** The delay clock: pass the same instance telemetry reads
   *  (the app's `ViewClock`, or an equivalent). Kept as a structural type
   *  here so this file never imports the concrete `ViewClock` class, which
   *  stays app-internal: `DelayClockLike` comes from the SDK root, the rest of
   *  the pipeline from `@ksp-gonogo/sitrep-sdk/media`. */
  view: DelayClockLike;
  /** Capture-UT to stamp each captured video frame with, called once per
   *  frame the pipeline reads off the track, not once per stream
   *  reference.
   *
   *  Returns `null` when the capture clock cannot be read for this frame:
   *  a gap in the ~1Hz sidecar samples, or a contributing consumer that has
   *  unmounted. Frames are then held against the last UT the clock actually
   *  produced rather than stamped with a fabricated one. A frame stamped
   *  UT 0 is older than any edge the `view` can hold, so the buffer releases
   *  it at once and the picture runs live beside correctly-delayed
   *  telemetry: the one outcome the delay model must never produce. */
  captureUt(): number | null;
  /** The raw (un-interpolated) capture-clock sample backing `captureUt`.
   *  Only needed by the worker backend, which interpolates locally at
   *  frame-read time inside the worker rather than calling a main-thread
   *  closure per frame (Clock seam, "captureUt: same treatment"). Omit if
   *  the caller never expects the worker backend to be reachable (e.g. a
   *  test that only exercises the main-thread path), the worker backend
   *  simply won't be attempted without it. */
  getCaptureSample?(): CaptureClockSample;
  /** The camera's per-frame capture stamps. When set, every backend dates each
   *  frame from the stamp matching its RTP timestamp, and the capture clock
   *  (`captureUt`, `getCaptureSample`) is not used: it runs ahead of a game
   *  that is slower than wall time and snaps back at each sample. A frame
   *  whose stamp was lost is dated from its neighbours, and a new capture epoch
   *  empties the buffer. */
  frameStamps?: FrameStampFeed;
  /** Bumped (any change) to flush the buffer on a timeline reset, pass the
   *  session's epoch/reset counter. Omit if the caller doesn't model resets. */
  resetEpoch?: number;
  /** Frame-count cap forwarded to the pipeline: see `frameDelay.ts`'s
   *  module docstring for the default and rationale. */
  maxBufferedFrames?: number;
  /**
   * Where the encoded delay attaches when the shown stream is drawn from
   * another track, as kerbcast's noise canvas is (see
   * {@link useEncodedDelayTarget}). Where the encoded transform is supported,
   * the delay is put there and the shown stream is surfaced as it is, already
   * delayed.
   */
  encodedTarget?: EncodedDelayTarget | null;
}

/**
 * `useDelayedPlayout`'s result: a discriminated union rather than
 * `MediaStream | null` (cross-browser kerbcast video-delay design,
 * 2026-07-16) so a caller can distinguish "still connecting" from
 * "genuinely can't be delayed here", which a bare nullable stream cannot:
 *
 * - `"raw"`: no `delay` options were supplied at all (the one retained
 *   live-video path: "there is genuinely nothing to delay", not a delay
 *   failure). `stream` may itself be `null` while the camera connects.
 * - `"connecting"`: delay was requested, but there's nothing to show yet:
 *   the raw stream hasn't arrived, or a pipeline build is in flight.
 * - `"delayed"`: a real per-frame delay pipeline is up; `stream` is its
 *   output.
 * - `"unavailable"`: delay was requested and expected, but no backend
 *   could build a pipeline here. Per decision 5 of the design doc, this is
 *   never papered over with the live stream, the caller must render an
 *   explicit "can't delay" state instead (see `CameraFeed.tsx`).
 */
export type DelayedPlayoutResult =
  | { kind: "raw"; stream: MediaStream | null }
  | { kind: "connecting" }
  | { kind: "delayed"; stream: MediaStream }
  | { kind: "unavailable"; reason: string };

const RAW_NULL: DelayedPlayoutResult = { kind: "raw", stream: null };
const CONNECTING: DelayedPlayoutResult = { kind: "connecting" };

/** Results whose delay runs on a receiver, so whatever stream is drawn from that receiver's track is the delayed output. */
const delayedAtReceiver = new WeakSet<DelayedPlayoutResult>();

/** Whether backend 0 can run here: the platform has `RTCRtpScriptTransform` and the clock can be copied into the worker. */
function encodedDelaySupported(view: DelayClockLike): boolean {
  return (
    typeof RTCRtpScriptTransform !== "undefined" &&
    typeof (view as { snapshot?: unknown }).snapshot === "function"
  );
}

/**
 * Route a raw `MediaStream` through the real per-frame delay pipeline,
 * sharing the app's telemetry delay clock. Without `delay`
 * (the default) this is a strict passthrough, it returns `{kind: "raw",
 * stream: raw}` unchanged, so the LAN case spins up no pipeline at all.
 *
 * With `delay`, three backends are tried in order:
 *
 *  0. **Encoded transform on the receiver** (`attachEncodedWorkerFrameDelay`),
 *     tried first when `delay.encodedTarget` is given and
 *     `RTCRtpScriptTransform` exists. Empirically confirmed cross-browser
 *     correct on Chromium, Firefox and WebKit, and the only backend that can
 *     reach Firefox at all. Delays in place (no new track): on success the
 *     result's `stream` is `raw` itself, unchanged, the delay happens
 *     transparently upstream of decode.
 *  1. **Main-thread Breakout Box** (`isFrameDelaySupported()` /
 *     `createFrameDelayStream`): Chrome, tried when (0) can't attach (no
 *     target, as when Kerbcast has no script transform path, or the browser
 *     lacks `RTCRtpScriptTransform`).
 *  2. **Worker-hosted Breakout Box** (`createWorkerFrameDelayStream`):
 *     tried only when (0) and (1) are both unavailable. Safari and WebKit
 *     support this, which is what puts it behind (1) rather than ahead.
 *
 * If no backend can build a pipeline, resolves `{kind: "unavailable",
 * reason}`: **never** the raw stream. Falling back to `raw` would hand the
 * operator undelayed video while the telemetry beside it is delayed, and a
 * one-time console warning is not something they will see. "Can't delay" is a
 * first-class, visible state the caller renders explicitly.
 */
export function useDelayedPlayout(
  raw: MediaStream | null,
  delay?: KerbcastStreamDelayOptions,
): DelayedPlayoutResult {
  const [result, setResult] = useState<DelayedPlayoutResult>(() =>
    delay ? CONNECTING : { kind: "raw", stream: raw },
  );
  const leaseRef = useRef<ReturnType<
    typeof sharedDelayedStreams.acquire
  > | null>(null);
  const view = delay?.view;
  const maxBufferedFrames = delay?.maxBufferedFrames;
  // Always-current handles so the effect below doesn't need `delay` itself
  // (a fresh object identity most renders) in its dependency array, and so the
  // contribution the shared cache reads always reflects THIS consumer's live
  // capture clock.
  const captureUtRef = useRef(delay?.captureUt);
  captureUtRef.current = delay?.captureUt;
  const getCaptureSampleRef = useRef(delay?.getCaptureSample);
  getCaptureSampleRef.current = delay?.getCaptureSample;
  const rawRef = useRef(raw);
  rawRef.current = raw;

  /*
   * A canvas track has no receiver, so delaying the stream it shows would hold
   * decoded frames from the canvas, and a capture source starves while its
   * frames are held. Delaying the WebRTC track the canvas draws from holds
   * encoded frames instead. The pipeline is then keyed by that source: the
   * canvas stream stays the same object when the track behind it changes.
   */
  const target = delay?.encodedTarget ?? null;
  const atTarget =
    target !== null && view !== undefined && encodedDelaySupported(view);
  const key = atTarget ? target.key : raw;
  const targetRef = useRef(target);
  targetRef.current = atTarget ? target : null;
  const frameStamps = delay?.frameStamps;

  // Attach to (or, as the first consumer, start) the SHARED per-camera
  // pipeline whenever the raw stream reference or the clock instance changes.
  // A `raw` change (camera switch, reconnect) releases the old camera's lease
  // and acquires the new one: no cross-camera frame bleed, and the last
  // consumer of the old track tears its pipeline down. Delay is a property of
  // the camera: N consumers of one track share ONE processor and one delayed
  // output (see `sharedDelayedStreams`).
  const resetEpoch = delay?.resetEpoch;
  const resetEpochRef = useRef(resetEpoch);
  resetEpochRef.current = resetEpoch;
  const seenEpochRef = useRef(resetEpoch);
  /* Declared before the effect below so its cleanup runs first on unmount,
     telling that effect's cleanup the consumer is leaving and not switching. */
  const unmountingRef = useRef(false);
  useEffect(() => {
    unmountingRef.current = false;
    return () => {
      unmountingRef.current = true;
    };
  }, []);
  useEffect(() => {
    if (!view) {
      setResult(raw === null ? RAW_NULL : { kind: "raw", stream: raw });
      return;
    }
    const shown = rawRef.current;
    if (!key || !shown) {
      setResult(CONNECTING);
      return;
    }
    if (!captureUtRef.current && !frameStamps) {
      // Delay was structurally requested (a `view` was passed) but the
      // caller has no capture clock yet, mirrors `useDelayedKerbcastStream`'s
      // own "no capture clock yet -> passthrough" case (old kerbcast
      // plugin/sidecar, or before the first ~1Hz sample): there is nothing
      // to stamp frames with, so this is the retained-live-path case, not
      // an "unavailable" failure.
      setResult({ kind: "raw", stream: shown });
      return;
    }

    seenEpochRef.current = resetEpochRef.current;
    const attachAt = targetRef.current?.attach;
    const lease = sharedDelayedStreams.acquire(key, (ctx) =>
      buildOrReportUnavailable(
        shown,
        view,
        maxBufferedFrames,
        frameStamps,
        ctx,
        attachAt,
      ),
    );
    leaseRef.current = lease;
    // Contribute THIS consumer's live capture clock. The build reads whichever
    // contributing lease is first-still-live, so the pipeline keeps stamping
    // correctly even after the consumer that built it unmounts.
    lease.setContribution({
      captureUt: () => captureUtRef.current?.() ?? null,
      getCaptureSample: () =>
        getCaptureSampleRef.current?.() ?? NEUTRAL_CAPTURE_SAMPLE,
    });
    const sync = () => setResult(lease.get() ?? CONNECTING);
    const unsubscribe = lease.subscribe(sync);
    sync();

    return () => {
      unsubscribe();
      leaseRef.current = null;
      if (!unmountingRef.current) {
        lease.release();
        return;
      }
      /* The consumer is going, not switching: the pipeline is torn down a
         moment late, so a feed mounted anew for the same camera (a tile moved
         on the dashboard) joins it instead of rebuilding it. Until then the
         lease contributes no capture clock, since its consumer is gone. */
      lease.setContribution({
        captureUt: () => null,
        getCaptureSample: () => NEUTRAL_CAPTURE_SAMPLE,
      });
      setTimeout(() => lease.release(), PIPELINE_RELEASE_GRACE_MS);
    };
  }, [key, raw === null, view, maxBufferedFrames, frameStamps]);

  // Timeline-reset: flush the shared buffer (drop stale pre-reset frames)
  // WITHOUT tearing down the pipeline: the track keeps flowing. Shared, so a
  // reset flushes for every consumer of this camera, which is correct: they
  // ride one buffer off one clock epoch. Only a change from an epoch this
  // consumer has already seen is a reset: a consumer mounting, or the delay
  // being switched on, reads the current epoch without having crossed one, and
  // a flush then would drop the frames of a stream another consumer is
  // watching, leaving its decoder without references until the next keyframe.
  // The same holds for a lease acquired in the render that carries a new
  // epoch (a camera listed again after a relaunch): it starts at that epoch,
  // so there is nothing stale to drop.
  useEffect(() => {
    const seen = seenEpochRef.current;
    seenEpochRef.current = resetEpoch;
    if (seen === undefined || seen === resetEpoch) return;
    leaseRef.current?.flush();
  }, [resetEpoch]);

  return useMemo(() => {
    if (!atTarget || !delayedAtReceiver.has(result)) return result;
    return raw ? { kind: "delayed", stream: raw } : CONNECTING;
  }, [atTarget, result, raw]);
}

/**
 * `buildDelayedPipeline`, with a build that throws or rejects reported as the
 * camera being "unavailable" instead of escaping.
 *
 * The shared cache answers a build that fails by dropping the entry and
 * publishing nothing, so a lease on it reads `undefined` for good, which
 * `useDelayedPlayout` shows as "connecting". A camera whose pipeline cannot be
 * built then looks as if it were still on its way, for ever. The SDK's lease
 * has no way to say a build failed, so the failure is turned into a result here,
 * where it is known.
 */
function buildOrReportUnavailable(
  raw: MediaStream,
  view: DelayClockLike,
  maxBufferedFrames: number | undefined,
  frameStamps: FrameStampFeed | undefined,
  ctx: DelayedStreamBuildContext<CaptureContribution>,
  attachAt: EncodedDelayTarget["attach"] | undefined,
):
  | BuiltDelayedStream<DelayedPlayoutResult>
  | Promise<BuiltDelayedStream<DelayedPlayoutResult>> {
  const unavailable = (err: unknown): BuiltDelayedStream<DelayedPlayoutResult> => {
    logger
      .tag("kerbcast:frame-delay")
      .warn("frame pipeline could not be built", { err });
    return {
      result: {
        kind: "unavailable",
        reason: `the frame-delay pipeline failed to build: ${
          err instanceof Error ? err.message : String(err)
        }`,
      },
    };
  };
  try {
    const built = buildDelayedPipeline(
      raw,
      view,
      maxBufferedFrames,
      frameStamps,
      ctx,
      attachAt,
    );
    return built instanceof Promise ? built.catch(unavailable) : built;
  } catch (err) {
    return unavailable(err);
  }
}

/**
 * Build one delayed pipeline for a camera track, the `build` function the
 * shared cache runs at most once per camera. Tries the three backends in the
 * documented order and returns a `BuiltDelayedStream` whose `result` is the
 * `DelayedPlayoutResult` every consumer of this camera then sees, plus the
 * `dispose`/`flush` handles the cache calls on last-release / timeline-reset.
 *
 * Reads the capture clock through `ctx.contribution()` (the first still-live
 * lease's), not a closure over any one consumer's refs, the pipeline outlives
 * whichever consumer built it, and a frozen capture UT would stamp frames
 * against a dead clock. `view` (the one `ViewClock`) is the same instance for
 * every consumer, so capturing it here is safe.
 *
 * Not `async`: the sync backends (encoded, main-thread Breakout Box, and the
 * "unavailable" outcomes) return a `BuiltDelayedStream` synchronously so the
 * shared cache settles in the same tick, with no spurious extra "connecting"
 * frame. Only the worker backend returns a Promise (it genuinely awaits
 * `createWorkerFrameDelayStream`).
 */
function buildDelayedPipeline(
  raw: MediaStream,
  view: DelayClockLike,
  maxBufferedFrames: number | undefined,
  frameStamps: FrameStampFeed | undefined,
  ctx: DelayedStreamBuildContext<CaptureContribution>,
  attachAt: EncodedDelayTarget["attach"] | undefined,
):
  | BuiltDelayedStream<DelayedPlayoutResult>
  | Promise<BuiltDelayedStream<DelayedPlayoutResult>> {
  const onPipelineError = (err: unknown) => {
    logger.tag("kerbcast:frame-delay").warn("frame pipeline error", { err });
  };
  // Stamp against the last UT the capture clock actually produced, never a
  // fabricated one. `NEUTRAL_CAPTURE_SAMPLE` already carries that absence for
  // the worker and encoded backends; this is the same absence for the
  // main-thread backend, which is the only one that stamps through
  // `captureUt`. Holding the last real UT is late at worst. Substituting 0
  // is early always: `DelayedPlayoutBuffer` releases every frame whose stamp
  // is at or before `confirmedEdgeUt()`, and UT 0 is before every edge, so a
  // clock gap silently ran the picture LIVE while telemetry stayed delayed.
  // Before the clock has EVER produced a UT there is nothing to hold against
  // and the frame is undatable, so it is held indefinitely rather than shown.
  let lastCaptureUt: number | null = null;
  const captureUt = () => {
    const ut = ctx.contribution()?.captureUt();
    if (ut != null) lastCaptureUt = ut;
    return lastCaptureUt ?? Number.POSITIVE_INFINITY;
  };
  const getCaptureSample = () =>
    ctx.contribution()?.getCaptureSample() ?? NEUTRAL_CAPTURE_SAMPLE;

  // Backend 0: encoded transform on the caller's target. See
  // `useDelayedPlayout`'s module doc. One transform per receiver: sharing at
  // the source is what keeps that invariant.
  let liveHandle: EncodedFrameDelayHandle | null = null;
  const install: InstallEncodedDelay = (receiver) => {
    const handle = attachEncodedWorkerFrameDelay(receiver, {
      view: view as unknown as SnapshottableDelayClock,
      getCaptureSample,
      frameStamps,
      onError: onPipelineError,
      onStats: frameDelayStatsLogger(heldSeconds),
    });
    if (!handle) return null;
    liveHandle = handle;
    return {
      ...handle,
      dispose() {
        if (liveHandle === handle) liveHandle = null;
        handle.dispose();
      },
    };
  };
  const heldSeconds = (): number | null => {
    const ut = interpolateCaptureUt(getCaptureSample(), performance.now());
    return ut === null ? null : ut - view.confirmedEdgeUt();
  };
  /* The longest a frame can sit in the transform now: the delay (the gap
     between the capture time being rendered and the latest time that may be
     shown, over the warp rate) plus the pacer's lead limit, read from the
     pipeline that holds the receiver (the default until one is installed).
     Too high only slows Kerbcast's retries, too low leaves a feed on static.
     NaN while the capture clock has no time, which Kerbcast reads as an
     unknown hold. */
  const holdMs = () => {
    const sample = getCaptureSample();
    const ut = interpolateCaptureUt(sample, performance.now());
    if (ut === null) return Number.NaN;
    const held = ut - view.confirmedEdgeUt();
    const delayMs = Math.max(0, (held / (sample.warpRate || 1)) * 1000);
    const leadLimitSeconds =
      liveHandle?.leadLimitSeconds() ?? DEFAULT_PACING_MAX_LEAD_SECONDS;
    return delayMs + leadLimitSeconds * 1000;
  };
  if (attachAt && encodedDelaySupported(view)) {
    const encodedHandle = attachAt(install, holdMs);
    if (encodedHandle) {
      // No new track: the delay happens in place on the receiver's existing
      // track, upstream of decode, so `raw` is surfaced unchanged.
      const result: DelayedPlayoutResult = { kind: "delayed", stream: raw };
      delayedAtReceiver.add(result);
      return {
        result,
        dispose: encodedHandle.dispose,
        flush: encodedHandle.flush,
      };
    }
    // Falls through to backend 1/2 below: never a hard failure on its own
    // (a target whose transform cannot be built is exactly the "try the next
    // backend" case, same as backends 1/2's own null-return handling).
  }

  // Backend 1: Chrome's main-thread Breakout Box, tried when backend 0
  // couldn't attach.
  if (isFrameDelaySupported()) {
    let onErrorReason: string | null = null;
    const pipeline = createFrameDelayStream(raw, {
      view,
      captureUt,
      frameStamps,
      maxBufferedFrames,
      onStats: frameDelayStatsLogger(heldSeconds),
      onError: (err) => {
        onErrorReason = String(err);
        onPipelineError(err);
      },
    });
    if (pipeline) {
      return {
        result: { kind: "delayed", stream: pipeline.stream },
        dispose: pipeline.dispose,
        flush: pipeline.flush,
      };
    }
    return {
      result: {
        kind: "unavailable",
        reason:
          onErrorReason ??
          "per-frame delay pipeline could not be built on this camera",
      },
    };
  }

  // Backend 2: worker-hosted Breakout Box, Safari today; Firefox once it
  // lands (feature-detected, see the module doc above).
  const snapshotCapableView = view as DelayClockLike & {
    snapshot?(): unknown;
  };
  if (typeof snapshotCapableView.snapshot !== "function") {
    return {
      result: {
        kind: "unavailable",
        reason:
          "this browser has no main-thread per-frame delay support, and the supplied clock does not support the worker backend (no snapshot())",
      },
    };
  }

  // The worker backend genuinely awaits: return its Promise so the cache
  // settles async ONLY for this path (every path above settled synchronously).
  return (async (): Promise<BuiltDelayedStream<DelayedPlayoutResult>> => {
    let workerErrorReason: string | null = null;
    const workerPipeline = await createWorkerFrameDelayStream(raw, {
      // Narrowed by the runtime `typeof snapshot === "function"` check just
      // above: `DelayClockLike` is deliberately narrower than
      // `SnapshottableDelayClock` (kerbcast never hard-depends on `snapshot()`
      // existing; only the worker backend needs it).
      view: view as unknown as SnapshottableDelayClock,
      getCaptureSample,
      frameStamps,
      maxBufferedFrames,
      onStats: frameDelayStatsLogger(heldSeconds),
      onError: (err) => {
        workerErrorReason = String(err);
        onPipelineError(err);
      },
    });
    if (workerPipeline) {
      return {
        result: { kind: "delayed", stream: workerPipeline.stream },
        dispose: workerPipeline.dispose,
        flush: workerPipeline.flush,
      };
    }
    return {
      result: {
        kind: "unavailable",
        reason:
          workerErrorReason ??
          "no per-frame video delay backend is available in this browser",
      },
    };
  })();
}
