import { CameraKind, type CameraState } from "@ksp-gonogo/kerbcast";
import {
  type CameraFeedHandle,
  KerbcastProvider,
  type KerbcastSubscriptions,
  CameraFeed as SharedCameraFeed,
} from "@ksp-gonogo/kerbcast-react";
import type {
  ActionDefinition,
  ComponentProps,
  TopicPayload,
  Value,
} from "@ksp-gonogo/sitrep-sdk";
import {
  AugmentSlot,
  currentMode,
  getUplinkHandle,
  logger,
  type Reading,
  useActionInput,
  useLatestValue,
  useTelemetry,
  value,
} from "@ksp-gonogo/sitrep-sdk";
import {
  Badge,
  FramedDisplay,
  Panel,
  Section,
  type Severity,
  speakQuantity,
  Unit,
  useElementSize,
  usePrefersReducedMotion,
  writeQuantity,
} from "@ksp-gonogo/ui-kit";
import {
  type CSSProperties,
  type FocusEvent as ReactFocusEvent,
  type ReactNode,
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import type {
  CameraSetpoint,
  CameraSetpointBounds,
} from "../CameraSetpoint/CameraSetpointInput.js";
import {
  CameraSetpointSurface,
  type CameraSetpointSurfaceHandle,
} from "../CameraSetpoint/CameraSetpointSurface.js";
import { useKerbcastCameras } from "../hooks/useKerbcastCameras.js";
import type { KerbcastDataSource } from "../KerbcastDataSource.js";
import { feedAspect, frameBox } from "./frameShape.js";
import {
  useDelayedKerbcastStream,
  useDelayedPlaybackStatus,
} from "./useDelayedKerbcastStream.js";

export interface CameraFeedConfig extends Record<string, unknown> {
  /**
   * KSP `Part.flightID` of the camera to stream. `null` (the
   * default) auto-picks the first available: handy for "drop the
   * widget on a dashboard and it just works", and the natural state
   * before the operator has explicitly picked one. Once the operator
   * selects a camera (via the in-widget picker or a Next/Previous
   * input) the chosen flightId is persisted here.
   */
  flightId: number | null;
  /**
   * When true, the feed renders the technical readouts (resolution +
   * encoder bitrate) in the top overlay. Defaults to `false` so the
   * default chrome stays uncluttered; toggled from the camera menu.
   */
  showDebugInfo: boolean;
}

/**
 * The value a VERDICT may be drawn from: current, or modelled forward to the frame.
 * A stale reading carrying no model gives nothing, because a judgement cannot be
 * dated: the operator reads a band or a pill as the situation NOW.
 */
function judgeable<T>(reading: Reading<T>): T | undefined {
  if (reading.state === "observed") return reading.value;
  if (reading.reckoning === "available") return reading.reckoned.value;
  return undefined;
}

/**
 * Facecam kind separation: kerbal face cameras get their own crew surfaces,
 * CrewStatus's `crew-status.avatar` augment and eventually a dedicated
 * facecam-wall widget, so they should not also appear in this general
 * part-camera picker, stepper and auto-latch. `camera.kind` defaults to `Part`
 * when the sidecar omits it (older payloads), so this only ever EXCLUDES a
 * camera the SDK positively reports as a kerbal face; nothing is lost when
 * `kind` is absent.
 */
export function isPartCamera(camera: CameraState): boolean {
  return camera.kind !== CameraKind.Kerbal;
}

// ---------------------------------------------------------------------------
// Augment slots. CameraFeed is PRIMARILY an
// augment itself (it fills `targeting.camera`) and secondarily a HOST
// widget that exposes two slots. No first-party augment fills either here, the
// package move + Kerbalism/RA fillers are a later phase, so each renders
// nothing until an Uplink registers into it.
// ---------------------------------------------------------------------------

/**
 * Props for `camera-feed.overlay`: an OVERLAY slot, rendered in a
 * layer absolutely positioned OVER the video element. Data-over-video augments
 * (a telemetry HUD painted on the feed at key moments) draw here in the feed's
 * pixel space, so the slot passes the rendered video-container dimensions and
 * the flightID of the camera currently on screen. `width`/`height` are CSS px
 * (0 before the first measure); `flightId` reflects what the SDK actually shows
 * (auto-picks included) via `onDisplayedCameraChange`, not the requested id.
 *
 * NOTE: richer projection (the SDK's internal pan/zoom transform) isn't
 * readable from this wrapper; exposing it waits on the widget's move into
 * `@ksp-gonogo/kerbcast` (P3), where it can read the SDK feed handle directly.
 */
export interface CameraOverlayContext {
  /** flightID of the displayed camera (auto-picks included); null before one resolves. */
  flightId: number | null;
  /** Rendered width of the video container, CSS px (0 before first measure). */
  width: number;
  /** Rendered height of the video container, CSS px. */
  height: number;
}

// Co-located declaration-merge of this widget's slot ids onto their props types.
// Kept next to the widget (not a central registry file) so parallel slot
// work on other widgets never collides on this seam. Targets the sitrep-sdk
// facade, not @ksp-gonogo/core directly: CameraFeed OWNS these slots (it's the
// one file that both renders <AugmentSlot> for them AND is sealed onto the
// facade), so this program's own SlotRegistry merge is the facade's, exactly
// how Scanning declares its own "scanning.*" slots (see the facade-slotfix
// report): the sdk's central mod/sitrep-sdk/src/api/slots.ts deliberately
// does NOT centrally mirror an Uplink's own slots (would need the sdk leaf to
// import from an Uplink client package: the exact cycle that file exists to
// avoid).
declare module "@ksp-gonogo/sitrep-sdk" {
  interface SlotRegistry {
    "camera-feed.overlay": CameraOverlayContext;
  }
}

/** Component actions exposed to the serial-input platform. */
export const cameraFeedActions = [
  {
    id: "nextCamera",
    label: "Next camera",
    accepts: ["button"],
    description:
      "Switch to the next available camera, persisting the choice to the widget config (wraps round at the end of the list).",
  },
  {
    id: "prevCamera",
    label: "Previous camera",
    accepts: ["button"],
    description: "Switch to the previous available camera (wraps round).",
  },
  {
    id: "zoomIn",
    label: "Zoom in",
    accepts: ["button"],
    description:
      "Held: zooms in, field of view falling. Live, this drives the camera; above the staged delay threshold it turns the staged zoom wheel at 30 degrees per second and sends nothing until the commit.",
  },
  {
    id: "zoomOut",
    label: "Zoom out",
    accepts: ["button"],
    description:
      "Held: zooms out, field of view rising. Live, this drives the camera; above the staged delay threshold it turns the staged zoom wheel at 30 degrees per second and sends nothing until the commit.",
  },
  {
    id: "panYaw",
    label: "Pan yaw axis",
    accepts: ["analog"],
    description:
      "Analog yaw rate, -1..1. Positive = right. Live, this is the camera's pan rate at up to its max pan speed; above the staged delay threshold it turns the staged yaw wheel at up to 30 degrees per second, clamped to the camera's yaw envelope, and sends nothing until the commit.",
  },
  {
    id: "panPitch",
    label: "Pan pitch axis",
    accepts: ["analog"],
    description:
      "Analog pitch rate, -1..1. Positive = up. Live, this is the camera's pan rate at up to its max pan speed; above the staged delay threshold it turns the staged pitch wheel at up to 30 degrees per second, clamped to the camera's pitch envelope, and sends nothing until the commit. A camera with no pitch envelope does not move either way.",
  },
] as const satisfies readonly ActionDefinition[];

export type CameraFeedActions = typeof cameraFeedActions;

export function CameraFeed({
  config,
  onConfigChange,
}: Readonly<ComponentProps<CameraFeedConfig>>) {
  const ds = getUplinkHandle<KerbcastDataSource>("kerbcast");
  const client = ds?.getClient();

  // Ensure the sidecar connection is open before we render.
  useEffect(() => {
    ds?.ensureConnected();
  }, [ds]);

  // Diagnostic: which client instance does the provider hold right now? Pairs
  // with the connected-client `kerbcast:clock` logs: if this `instanceId`
  // differs from the one logging advancing `captureUt`, a reconnect/TURN
  // rebuild orphaned the clock onto an instance the provider no longer reads.
  useEffect(() => {
    if (!client) return;
    const instanceId = (client as unknown as { __kcInstanceId?: number })
      .__kcInstanceId;
    logger
      .tag("kerbcast:clock")
      .debug("CameraFeed provider client", { instanceId });
  }, [client]);

  // Build the subscriptions adapter once per data source so acquire/release
  // calls are stable across re-renders.
  const subscriptions: KerbcastSubscriptions | undefined = useMemo(
    () =>
      ds
        ? {
            acquire: ds.subscribeCamera.bind(ds),
            release: ds.unsubscribeCamera.bind(ds),
          }
        : undefined,
    [ds],
  );

  const requested = config?.flightId ?? null;
  const showDebugInfo = config?.showDebugInfo ?? false;

  // Internal ref driving the shared component's handle (pan/zoom serial
  // actions). Nothing outside this component holds a ref to CameraFeed.
  const feedRef = useRef<CameraFeedHandle>(null);

  // ---- Overlay-slot geometry ----
  // The `camera-feed.overlay` slot passes the rendered video-container size so
  // an overlay augment can lay out in the feed's pixel space. Measured off the
  // positioned wrapper via a callback ref + ResizeObserver, so it re-attaches
  // cleanly across the `!client` early-return (the wrapper only mounts once the
  // stream is ready). ResizeObserver is stubbed in tests (installDomStubs).
  const [feedSize, setFeedSize] = useState({ width: 0, height: 0 });
  const overlayObserverRef = useRef<ResizeObserver | null>(null);
  const attachOverlayWrap = useCallback((el: HTMLDivElement | null) => {
    overlayObserverRef.current?.disconnect();
    overlayObserverRef.current = null;
    if (!el || typeof ResizeObserver === "undefined") return;
    const measure = () =>
      setFeedSize({ width: el.clientWidth, height: el.clientHeight });
    measure();
    const ro = new ResizeObserver(measure);
    ro.observe(el);
    overlayObserverRef.current = ro;
  }, []);
  useEffect(() => () => overlayObserverRef.current?.disconnect(), []);

  // Internal ref onto the staged setpoint cluster, the delayed twin of
  // `feedRef`: above the staged threshold a bound input aims the DRAFT rather
  // than the camera, and the draft is that component's own state.
  const setpointRef = useRef<CameraSetpointSurfaceHandle>(null);

  // ---- CommNet degrade (500ms debounce) ----
  // In auto mode (config.flightId === null) the shared component picks the
  // displayed camera itself, and that pick can differ from config.flightId.
  // Rather than re-derive the same auto-latch resolution here, let the shared
  // component report what it actually shows via onDisplayedCameraChange so
  // degrade always targets the feed on screen (auto-picks included).
  const [effectiveFlightId, setEffectiveFlightId] = useState<number | null>(
    requested,
  );

  // Native topic reads: the canonical field paths, not a two-arg shim.
  const vesselComms = judgeable(useTelemetry("vessel.comms"));
  const signalStrength = vesselComms?.signalStrength;
  // `comms.link` (NOT `vessel.comms.connected`): a dedicated, freeze-EXEMPT
  // MetaTopic. `vessel.comms` is a Delayed struct subject to the reveal-gate
  // freeze, so its own `.connected` field would stick at last-known through
  // a blackout instead of firing "NO SIGNAL". `comms.link` escapes that
  // freeze, so it's the edge that actually reflects a live disconnect.
  const commConnected = judgeable(useTelemetry("comms.link"))?.connected;
  // One-way light-time delay for THIS downlink (the footage left the craft
  // this long ago): NOT round-trip. Round-trip doubling only applies to
  // interactive command/response paths (e.g. the kOS terminal), which this
  // feed is not. `comms.delay` is a command-centre "facts about the link"
  // topic (like `comms.path`), not delayed craft telemetry: `useLatestValue`
  // (not `useTelemetry`) reads it straight off the stream, bypassing the
  // certainty-gated frame, so the delay figure itself doesn't appear a whole
  // one-way-delay late (see `useLatestValue`'s own doc).
  const signalDelay =
    useLatestValue<TopicPayload<"comms.delay">>("comms.delay")?.oneWaySeconds;
  const degradeTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Delayed camera control (#35): live vs. staged vs. no-path off the same
  // one-way delay the badge reads. Derived here rather than at the render site
  // because the serial-input handlers below route on it, and a widget reading
  // the mode in two places is a widget that can disagree with itself about
  // which control an operator is holding.
  const controlMode = currentMode({ oneWaySeconds: signalDelay ?? null });

  // ---- Serial-input actions ----
  // stepCamera, setZoomRate and setPanAxis are guarded internally by the
  // shared component (showZoom / showPan / supportsPitch checks), so the
  // handlers here can call them unconditionally.
  //
  // Pan and zoom route on the delay mode, because above the staged threshold
  // the camera is not what an operator is aiming: the setpoint cluster has
  // taken over, and what a held input moves is the DRAFT it commits from. Both
  // ends of the route are the same gesture, a rate held until it is released;
  // only what integrates it differs. Camera selection is not delayed and does
  // not route.
  //
  // `setpointRef` is null in live mode (the surface is unmounted) and the
  // staged branch simply no-ops, which is also what a mode change under a held
  // input does: the rate that crossed the threshold was already consumed by the
  // other side, so nothing moves again until the operator moves the input.
  const staged = controlMode !== "live";
  useActionInput<CameraFeedActions>({
    nextCamera: (payload) => {
      if (payload.kind === "button" && payload.value !== true) return;
      feedRef.current?.stepCamera(1);
    },
    prevCamera: (payload) => {
      if (payload.kind === "button" && payload.value !== true) return;
      feedRef.current?.stepCamera(-1);
    },
    zoomIn: (payload) => {
      if (payload.kind !== "button") return;
      // A press zooms IN, which is FoV going DOWN, so the draft's fov rate is
      // the negative of the live zoom rate rather than the same number.
      const held = payload.value === true;
      if (staged) setpointRef.current?.setAxisRate("fov", held ? -1 : 0);
      else feedRef.current?.setZoomRate(held ? 1 : 0);
    },
    zoomOut: (payload) => {
      if (payload.kind !== "button") return;
      const held = payload.value === true;
      if (staged) setpointRef.current?.setAxisRate("fov", held ? 1 : 0);
      else feedRef.current?.setZoomRate(held ? -1 : 0);
    },
    panYaw: (payload) => {
      if (payload.kind !== "analog") return;
      const rate = payload.value as number;
      if (staged) setpointRef.current?.setAxisRate("yaw", rate);
      else feedRef.current?.setPanAxis("yaw", rate);
    },
    panPitch: (payload) => {
      if (payload.kind !== "analog") return;
      const rate = payload.value as number;
      // No pitch guard on the staged branch: a camera that cannot pitch reports
      // `panPitchMin === panPitchMax`, and clamping the draft into a
      // zero-width envelope makes every step a no-op on its own. One rule, and
      // the bounds are the ones the camera itself published.
      if (staged) setpointRef.current?.setAxisRate("pitch", rate);
      else feedRef.current?.setPanAxis("pitch", rate);
    },
  });

  useEffect(() => {
    if (effectiveFlightId === null || !client) return;
    // If both values are undefined, CommNet data isn't available -- skip.
    if (signalStrength === undefined && commConnected === undefined) return;

    // Both signals fold into ONE always-defined level so a blackout's
    // degrade=1.0 always has a matching reset. Branch them separately and the
    // reset goes missing: `commConnected === false` sets degrade to 1.0, but if
    // only the `signalStrength` branch resets it, then signal returning
    // WITHOUT a strength reading (signalStrength undefined) hits neither branch
    // and the H.264 decoder stays wedged at full degrade forever. Folding
    // "connected" into the same `else` makes signal-return unconditionally
    // resolve to a level (0 with no strength reading, the derived value
    // otherwise), so setDegrade is always called with something that undoes
    // the blackout.
    // `.magnitude`: strength is a declared ratio and arrives wrapped, so the
    // old `typeof === "number"` test failed for every reading and every weak
    // link resolved to a level of 0, i.e. no degrade at all.
    const strength = signalStrength?.magnitude;
    const level =
      commConnected === false
        ? 1.0 // blackout
        : typeof strength === "number"
          ? Math.max(0, Math.min(1, 1 - strength))
          : 0; // connected, no strength reading -- always resets

    if (degradeTimerRef.current !== null) clearTimeout(degradeTimerRef.current);
    degradeTimerRef.current = setTimeout(() => {
      void client.camera(effectiveFlightId as number).setDegrade(level);
    }, 500);

    return () => {
      if (degradeTimerRef.current !== null)
        clearTimeout(degradeTimerRef.current);
    };
  }, [effectiveFlightId, signalStrength, commConnected, client]);

  // Cross-browser kerbcast video-delay design (2026-07-16), decision 5:
  // "can't delay -> no video". `useDelayedKerbcastStream` (passed to the SDK
  // below as `useStream`) can only return `MediaStream | null`, it has no
  // channel back to THIS component to say "delay was expected here but no
  // backend could build a pipeline". `useDelayedPlaybackStatus` is that
  // side channel (see that hook's module doc): when it reports
  // `"unavailable"`, render an explicit "delayed feed unavailable" state
  // INSTEAD of the SDK's own feed: never the live stream underneath it.
  // Called unconditionally, alongside every other hook above, BEFORE the
  // `!client` early return below (rules of hooks).
  const playoutStatus = useDelayedPlaybackStatus(effectiveFlightId);
  const unavailableReason =
    playoutStatus.kind === "unavailable" ? playoutStatus.reason : null;

  // ---- Delayed camera control gate (#35) ----
  // The live snapshot of the camera registry, so the setpoint surface can read
  // this camera's own pan/zoom envelopes and seed the dialled target from the
  // current aim rather than hardcoding bounds. Called unconditionally (rules of
  // hooks) alongside every hook above.
  const cameras = useKerbcastCameras();

  // ---- Frame shape ----
  // The box the frame is fitted INTO, measured so the frame itself can be given
  // the CAMERA's shape rather than the tile's (see `frameShape.ts`). Seeded 16:9
  // rather than empty: jsdom's ResizeObserver stub never fires, and a zero seed
  // there would give the frame no size at all, which is the one thing the SDK's
  // `Stage` cannot survive.
  const { ref: stageRef, size: stageBox } = useElementSize<HTMLDivElement>({
    w: 320,
    h: 180,
  });

  // ---- Control reveal ----
  // The delayed-aim controls are drawn over the picture and are hidden until
  // the operator reaches for them, exactly as the kerbcast SDK's own controls
  // are (its `Stage` reveals them on `:hover` / `:focus-within`, at 0.15s). We
  // cannot reach the SDK's rule from here, so the same one is kept in state and
  // fed from the same two signals, and the two clusters appear and disappear
  // together instead of one being permanently on top of the other.
  //
  // Focus is a first-class reveal rather than a nicety: the surface is only
  // ever faded, never unmounted or `visibility: hidden`, so a keyboard operator
  // tabbing into the wheels brings them back and the controls stay in the
  // accessibility tree the whole time.
  const [pointerOver, setPointerOver] = useState(false);
  const [focusWithin, setFocusWithin] = useState(false);
  const controlsRevealed = pointerOver || focusWithin;
  const reduceMotion = usePrefersReducedMotion();
  const onFeedBlur = useCallback((e: ReactFocusEvent<HTMLDivElement>) => {
    // A blur fires on every hop BETWEEN two controls in the cluster too, so the
    // reveal only ends when focus has actually left the feed.
    if (e.currentTarget.contains(e.relatedTarget as Node | null)) return;
    setFocusWithin(false);
  }, []);

  if (!client || !subscriptions) return null;

  // Slot props. Both carry the displayed camera's flightID; the
  // overlay additionally carries the measured video-container size so an
  // overlay augment can draw in the feed's pixel space.
  const overlayContext: CameraOverlayContext = {
    flightId: effectiveFlightId,
    width: feedSize.width,
    height: feedSize.height,
  };
  // Always-on status chips, intrinsic to a delayed downlink feed (not a
  // cross-mod augment): every camera feed shows both, unobtrusively.
  const delayBadge = describeSignalDelay(signalDelay);
  const qualityBadge = describeSignalQuality(commConnected, signalStrength);

  // Delayed camera control (#35). `currentMode` (derived above, where the
  // serial-input handlers also read it) maps null → "no-path" (never coerce to
  // 0), <= 1s → "live", > 1s → "staged". Below threshold the surface renders
  // nothing and the SDK's own live controls stay in charge; above it the
  // setpoint surface takes over. Bounds + the seed target come off THIS camera's
  // live `CameraState` (never hardcoded).
  const activeCamera =
    effectiveFlightId === null
      ? undefined
      : cameras.find((c) => c.flightId === effectiveFlightId);
  const setpointBounds: CameraSetpointBounds | undefined = activeCamera
    ? {
        yawMin: activeCamera.panYawMin,
        yawMax: activeCamera.panYawMax,
        pitchMin: activeCamera.panPitchMin,
        pitchMax: activeCamera.panPitchMax,
        fovMin: activeCamera.fovMin,
        fovMax: activeCamera.fovMax,
      }
    : undefined;
  const setpointInitial: CameraSetpoint | undefined = activeCamera
    ? {
        yaw: activeCamera.panYaw,
        pitch: activeCamera.panPitch,
        fov: activeCamera.fov,
      }
    : undefined;
  // `supportsPan || supportsZoom`: a fixed camera has no aim to give it, and
  // the kerbcast contract says as much ("clients should not present pan
  // controls until supportsPan == true"). Without this the bounds collapse to a
  // set of zeroes, which is a perfectly well-formed `CameraSetpointBounds`, so
  // every fixed camera drew three dead 0-degree tapes over its own picture.
  const steerable =
    activeCamera !== undefined &&
    (activeCamera.supportsPan || activeCamera.supportsZoom);
  // The frame takes the CAMERA's shape, fitted into whatever the tile left it.
  const frame = frameBox(stageBox, feedAspect(activeCamera));
  const showSetpointSurface =
    controlMode !== "live" &&
    effectiveFlightId !== null &&
    steerable &&
    setpointBounds !== undefined &&
    setpointInitial !== undefined;

  // Inject gonogo's delayed-playout stream source through the SDK's `useStream`
  // seam. `useDelayedKerbcastStream` is a stable module-scope
  // hook, satisfying the seam's rules-of-hooks contract. Its signature matches
  // the SDK's `CameraStreamHook` type, so the prop is passed plainly.
  //
  // A panel with one filling section, and a framed picture filling that: the
  // shape Targeting's docking HUD uses for the same job. Inside the frame
  // everything is a layer OVER the video (the augment overlay, the status chips,
  // the delayed-aim controls), because a camera feed IS its picture and any row
  // of chrome laid beside it comes straight out of the shot. Every one of those
  // layers is absolutely positioned, so the widget never asks its tile to grow
  // to fit controls that were not meant to have a height of their own.
  //
  // The widget went without a `Panel` for a while, on the grounds that a media
  // widget was a special case. It is not, and the exemption cost it the things
  // only a panel has: the delay-rail band its own aim commands travel in, the
  // status dots, `panelBadges`, and both universal augment segments.
  //
  // NO `panelTitle`, and that is a naming decision rather than a saving that
  // happens to be free. What the SDK draws in the picture's top-left is already
  // the instrument's name: the CAMERA PICKER, a `<button aria-haspopup="menu">`
  // labelled with the camera's own name ("Starboard Cam"), and the only way to
  // reach the camera list this widget advertises. There is no prop to suppress
  // it, so a panel title beside it is a second name for the same thing. It was
  // first tried as a `floatingHeader`, where "CAMERA" and "STARBOARD CAM"
  // overlapped character on character, and then as an ordinary header in a row
  // above the picture, which is where this measurement came from: the header
  // row, the body inset and the gap under it cost 32px of width and 47px of
  // height, 33% of a 9x8 tile, all of it taken off a picture that is the whole
  // point of the widget. Untitled, `Panel` takes the headerless path and the
  // header collapses to NOTHING rather than to an empty row (measured in
  // chromium against the vendored kit: the filling section goes from 318x191 to
  // 350x238 at 9x8), which is what makes this worth doing at all.
  //
  // What that costs, said plainly: the picker's name is REVEALED rather than
  // standing. The SDK fades its whole top overlay in on hover, on focus-within,
  // or once a click has pinned the chrome, so at rest the tile is the picture
  // plus this widget's own always-on badges and no words at all. Reached for,
  // it names the camera; with no camera at all it names the widget, the picker
  // falling back to the words "Camera Feed" beside the SDK's empty message. A
  // standing name would have to be drawn in the picture's top-left, which is
  // the corner the picker takes, and that overlap is what sent the panel title
  // into a row of its own in the first place.
  //
  // The panel is still a panel, and the band is why: the rail moves from the
  // sticky header unit into the container's own top padding, same height, same
  // permanence. A contributed badge or a bound `camera-feed.actions` augment
  // gives the header row back (unnamed, carrying only what was contributed),
  // and the picture pays the 47px again for as long as it is there.
  return (
    <KerbcastProvider client={client} subscriptions={subscriptions}>
      <Panel
        sections={
          <Section full fill>
            <div ref={stageRef} style={FEED_STAGE_STYLE}>
              <FramedDisplay
                style={{ ...FEED_FRAME_STYLE, ...frame }}
                onPointerEnter={() => setPointerOver(true)}
                onPointerMove={() => setPointerOver(true)}
                onPointerDown={() => setPointerOver(true)}
                onPointerLeave={() => setPointerOver(false)}
                onFocus={() => setFocusWithin(true)}
                onBlur={onFeedBlur}
              >
                <div ref={attachOverlayWrap} style={FEED_WRAP_STYLE}>
                  <SharedCameraFeed
                    ref={feedRef}
                    useStream={useDelayedKerbcastStream}
                    flightId={requested}
                    cameraFilter={isPartCamera}
                    onSelectCamera={(nextFlightId) =>
                      onConfigChange?.({
                        flightId: nextFlightId,
                        showDebugInfo: config?.showDebugInfo ?? false,
                      })
                    }
                    onDisplayedCameraChange={setEffectiveFlightId}
                    showDebugInfo={showDebugInfo}
                    enableFullscreen
                    enablePictureInPicture
                    // The SDK's own pan pad and zoom pair stand down for as
                    // long as the staged cluster is up. Above the delay
                    // threshold they aim at where the craft is NOW while the
                    // picture shows where it was a light-time ago, so leaving
                    // them live offered the operator a second, undelayed way to
                    // aim the same camera and no way to tell which one they
                    // were holding. Gated on `showSetpointSurface` rather than
                    // on the mode alone, so the one case where the cluster does
                    // not appear (a camera with no aim to give) keeps whatever
                    // the SDK would have drawn: the flag must never take a
                    // control away without putting the staged one in its place.
                    //
                    // It costs the bound serial inputs nothing. Above the
                    // threshold every pan/zoom action already routes to
                    // `setpointRef`, never to `feedRef`, so the handle's
                    // pan/zoom methods going no-op is a stand-down of a path
                    // nothing was taking.
                    disableManualControls={showSetpointSurface}
                  />
                  <div style={FEED_OVERLAY_STYLE}>
                    <AugmentSlot
                      name="camera-feed.overlay"
                      props={overlayContext}
                    />
                  </div>
                  <div style={FEED_BADGES_STYLE}>
                    {delayBadge && (
                      <Badge aria-label={delayBadge.ariaLabel}>
                        {delayBadge.label}
                      </Badge>
                    )}
                    {qualityBadge && (
                      <Badge
                        severity={qualityBadge.tone}
                        aria-label={qualityBadge.ariaLabel}
                      >
                        {qualityBadge.label}
                      </Badge>
                    )}
                  </div>
                  {showSetpointSurface && (
                    <div
                      // A stable targeting hook for the layer that carries the
                      // reveal, the same contract as ui-kit's `data-panel-body`:
                      // what a test needs here is the OPACITY, which lives on the
                      // layer rather than on any control inside it, and counting
                      // ancestors up from a slider would break the moment the
                      // composition changed.
                      data-camera-aim=""
                      style={{
                        ...FEED_SETPOINT_STYLE,
                        opacity: controlsRevealed ? 1 : 0,
                        transition: reduceMotion ? undefined : "opacity 150ms ease",
                      }}
                    >
                      <CameraSetpointSurface
                        ref={setpointRef}
                        cameraId={effectiveFlightId as number}
                        bounds={setpointBounds as CameraSetpointBounds}
                        initial={setpointInitial as CameraSetpoint}
                        mode={controlMode}
                        frame={feedSize}
                      />
                    </div>
                  )}
                  {unavailableReason && (
                    <div
                      role="status"
                      aria-live="polite"
                      style={FEED_UNAVAILABLE_STYLE}
                    >
                      <Badge
                        severity="critical"
                        aria-label="Delayed feed unavailable"
                      >
                        DELAYED FEED UNAVAILABLE
                      </Badge>
                      <span style={FEED_UNAVAILABLE_REASON_STYLE}>
                        {unavailableReason}
                      </span>
                    </div>
                  )}
                </div>
              </FramedDisplay>
            </div>
          </Section>
        }
      />
    </KerbcastProvider>
  );
}

interface StatusBadgeInfo {
  label: ReactNode;
  ariaLabel: string;
}

interface QualityBadgeInfo extends StatusBadgeInfo {
  tone: Severity;
}

// Signal-delay badge: ONE-WAY light-time only. This is a downlink, the
// footage on screen left the craft `signalDelay` seconds ago, so unlike an
// interactive command/response path (e.g. the kOS terminal) there is no
// round-trip to double. Hidden at 0/null/undefined (LAN, no measurable
// path, or no delay authority mounted: comms-delay-nullable-when-no-path
// fix), matching the "unobtrusive" brief: nothing to show, show nothing.
function describeSignalDelay(
  signalDelay: Value<"s"> | null | undefined,
): StatusBadgeInfo | null {
  const seconds = signalDelay?.magnitude;
  if (seconds === undefined || !Number.isFinite(seconds) || seconds <= 0) {
    return null;
  }
  // A string because it is a `Badge` label and an `aria-label`, and both are
  // attributes. A delay is a READOUT, not a countdown, so keep one decimal
  // where it matters (sub-minute, the common case) rather than letting the
  // time ladder truncate to whole units: 3.8s must not read as "3s". Above a
  // minute the decimal is noise, so the ladder takes over.
  const label = writeQuantity(
    signalDelay,
    seconds < 60 ? { scale: "never", decimals: 1 } : {},
  );
  return { label, ariaLabel: `Signal delay: ${label} one-way` };
}

// Signal-quality badge: craft-side CommNet strength, 0..1 -> percentage.
// `connected === false` always wins (a lost link has no meaningful strength
// percentage, even if a stale value is still cached). Hidden only when
// neither key has ever arrived, the same "no CommNet data" guard the
// degrade effect above uses, so the badge appears as soon as there's
// anything to say.
function describeSignalQuality(
  connected: boolean | undefined,
  signalStrength: Value<"ratio"> | undefined,
): QualityBadgeInfo | null {
  if (connected === undefined && signalStrength === undefined) return null;
  // NO SIGNAL when the link is down OR the strength has decayed to
  // effectively zero: a 0% link carries nothing, so it reads as no signal
  // rather than a "0%" quality badge. The tiny epsilon is a float-noise guard,
  // not a "weak link" threshold: a real 1% link still shows its percentage.
  const strength = signalStrength?.magnitude;
  const zeroSignal =
    strength !== undefined && Number.isFinite(strength) && strength <= 1e-6;
  if (connected === false || zeroSignal) {
    return {
      label: "NO SIGNAL",
      tone: "critical",
      ariaLabel: "Signal quality: no signal",
    };
  }
  if (strength === undefined || !Number.isFinite(strength)) {
    return null;
  }
  // The value already carries `ratio` as its unit, so <Unit> does the *100 and
  // writes the symbol. Doing both by hand here is how a badge ends up as the
  // one readout in the app writing "72%" where every other percentage writes
  // "72 %".
  const clamped = value("ratio", Math.max(0, Math.min(1, strength)));
  const pct = Math.round(clamped.magnitude * 100);
  const tone: Severity =
    pct >= 66 ? "nominal" : pct >= 33 ? "warning" : "critical";
  return {
    label: <Unit value={clamped} />,
    tone,
    // An attribute cannot hold a node, so the spoken form is the escape:
    // "72 percent" rather than the "72 %" a sighted reader sees.
    ariaLabel: `Signal quality: ${speakQuantity(clamped)}`,
  };
}

/**
 * The box the frame is fitted into: the whole of the panel body, with the frame
 * centred in whatever it does not use.
 */
const FEED_STAGE_STYLE: CSSProperties = {
  flex: 1,
  minWidth: 0,
  minHeight: 0,
  display: "flex",
  alignItems: "center",
  justifyContent: "center",
};

/**
 * The frame itself, sized by `frameBox` rather than by the layout.
 *
 * The size has to be stated somewhere, because there is no content to leave it
 * to. The kerbcast SDK's `Stage` positions its `<video>` absolutely and says in
 * its own comment that it "collapses to zero height" without a definite one, so
 * a frame that sizes to its children sizes to nothing, and the render harness
 * then stretches a 2px scene into a barcode of vertical bars rather than showing
 * an empty box.
 */
const FEED_FRAME_STYLE: CSSProperties = {
  flex: "0 0 auto",
  minWidth: 0,
  minHeight: 0,
};

// Positioned wrapper that lets the augment slots layer over the SDK feed. The
// feed's own root (`Stage`) fills this box, so absolutely-positioned children
// cover the video exactly.
const FEED_WRAP_STYLE: CSSProperties = {
  position: "relative",
  flex: 1,
  minWidth: 0,
  minHeight: 0,
  display: "flex",
};

// Full-area overlay layer; pointer-events off so it never steals clicks from
// the feed's controls beneath. Augments opt back in on their own elements.
const FEED_OVERLAY_STYLE: CSSProperties = {
  position: "absolute",
  inset: 0,
  pointerEvents: "none",
};

// Status chip strip, top-of-feed. Positioned to the right of the SDK's own
// (hover-gated) title so chips stay clear of it. Container is click-through;
// individual badges re-enable pointer events as needed. These do NOT fade with
// the controls: they are a reading, and a reading an operator has to wave a
// mouse at to get is not a reading. Above the SDK's own top gradient (which
// takes z-index 2) so the darkening under its title never dims them.
const FEED_BADGES_STYLE: CSSProperties = {
  position: "absolute",
  top: 0,
  right: 0,
  zIndex: 3,
  display: "flex",
  gap: "var(--space-4)",
  padding: "var(--space-4)",
  pointerEvents: "none",
};

/**
 * The layer the delayed-aim controls (#35) are drawn on, covering the picture.
 *
 * z-index 4 is the load-bearing number, and it is measured against the SDK
 * rather than chosen: kerbcast's own zoom and pan controls sit in the same
 * stacking context as this (its `Stage` is `position: relative` with no
 * z-index of its own, so nothing inside it is isolated from us), and its action
 * bar takes 3. Above the delay threshold this surface is the control that
 * counts, so it has to be the one on top; its portalled menus stay clear of the
 * argument at 1000.
 *
 * Click-through as a layer, with the bar inside re-enabling pointer events on
 * itself, so the picture around the bar keeps the SDK's own hover behaviour
 * rather than being sealed under a full-frame click trap.
 */
const FEED_SETPOINT_STYLE: CSSProperties = {
  position: "absolute",
  inset: 0,
  zIndex: 4,
  pointerEvents: "none",
};

// Cross-browser kerbcast video-delay design (2026-07-16), decision 5:
// "can't delay -> no video", a full-cover scrim replacing the SDK's own
// feed whenever `useDelayedPlaybackStatus` reports `"unavailable"`. Opaque
// (unlike FEED_OVERLAY_STYLE) and above every other layer: the whole point
// is that the operator must never see live, undelayed pixels here, the
// dark background + centred reason IS the "no signal" visual language this
// package already uses for a disconnected feed, reused for the "can't
// delay" case rather than invented fresh.
const FEED_UNAVAILABLE_STYLE: CSSProperties = {
  position: "absolute",
  inset: 0,
  // Above every layer it is replacing, ours and the SDK's alike: the delayed
  // controls at 4, the chips at 3, the SDK's own action bar at 3 and its top
  // gradient at 2. A scrim the SDK's controls draw through would be a scrim
  // that let the operator work an undelayed camera. Literal, in the feed's own
  // stacking context: this is not app-global chrome and does not belong on the
  // --z-* ladder.
  zIndex: 5,
  display: "flex",
  flexDirection: "column",
  alignItems: "center",
  justifyContent: "center",
  gap: "var(--space-8)",
  padding: "var(--space-16)",
  textAlign: "center",
  background: "rgba(0, 0, 0, 0.92)",
  pointerEvents: "auto",
};

const FEED_UNAVAILABLE_REASON_STYLE: CSSProperties = {
  color: "var(--color-text-primary)",
  // Root-relative on purpose: this scrim replaces the video entirely and its
  // reason text should scale with the browser font size rather than with the
  // widget type scale. Converting it to a px token is an accessibility
  // regression, not a cleanup.
  fontSize: "0.8rem",
  maxWidth: "80%",
};
