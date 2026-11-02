// kerbcast docking-camera augment for Rendezvous.
//
// Fills Rendezvous's `rendezvous.camera` slot with a live video backdrop behind
// the docking reticle. This is the filler that widget's augment-slot doc block
// was written for, and the only one: Rendezvous ships no built-in backdrop, so
// without this augment the HUD composes with no video layer at all.
//
// Why an augment and not a standalone CameraFeed instance: the backdrop has to
// draw in the HUD's own reticle space and share its lifecycle. The slot passes
// `RendezvousHudContext` for exactly that, and `requires: "kerbcast"`
// means an install without the kerbcast mod composes the HUD without any video
// layer at all: rather than the core client shipping a camera path it can
// never light up.
//
// Presence-gated on `kerbcast.available`; camera CHOICE comes off the Uplink's
// `kerbcast.cameras` control channel (`isDockingCamera`), while the MEDIA still
// rides kerbcast's own WebRTC path (`useDelayedKerbcastStream`, which delays it
// on the shared ViewClock). That split is the whole design: control plane on
// the Uplink, media off it.

import { type Anchor, AnchorKind } from "@ksp-gonogo/kerbcast";
import {
  AnchorMarkers,
  type AnchorOverlay,
  KerbcastProvider,
  type KerbcastSubscriptions,
  useDisplayedFrame,
} from "@ksp-gonogo/kerbcast-react";
import type { SlotProps, TopicReading } from "@ksp-gonogo/sitrep-sdk";
import {
  getUplinkHandle,
  registerAugment,
  useTelemetry,
} from "@ksp-gonogo/sitrep-sdk";
import { useEffect, useMemo, useRef, useState } from "react";
import { useDelayedKerbcastStream } from "../CameraFeed/useDelayedKerbcastStream.js";
import { useReportFrameSize } from "../CameraFeed/useReportFrameSize.js";
import type { KerbcastDataSource } from "../KerbcastDataSource.js";
import { KERBCAST } from "../uplink.js";
// Side-effect import: registers kerbcast.cameras's unit map into the SDK's
// runtime hydration registry (registerTopicUnits) and augments
// TopicPayloadMap for the type. This augment is the one production consumer
// of that decode-time wrap today, so it pulls the registration itself rather
// than relying on the package entry point's import order (see ../index.ts,
// which also imports this module for the same reason).
import "../topics.js";
import { dockCorners } from "./dockMarkers.js";
import {
  type DockMarkInputs,
  dockFrameLogEnabled,
  logDockFrame,
} from "./dockFrameLog.js";
import { selectDockingCamera } from "./selectDockingCamera.js";

/**
 * The value of a fact: something that stays true until an event changes it, and no
 * event can reach us down a link that is not delivering. `whenConfirmedNothing` is
 * what an `absent` tombstone means here, which is a different answer from `pending`
 * and must not collapse into it.
 *
 * Typed on `TopicReading`, which is what `useTelemetry` answers with. `Reading`
 * is the per-FIELD companion and only ever matched here structurally.
 */
function stillTrue<T, A>(
  reading: TopicReading<T>,
  whenConfirmedNothing: A,
): T | A | undefined {
  if (reading.state === "observed") return reading.value;
  // `held` covers the modelled reading too, and takes its OBSERVATION rather
  // than its `reckoned`: a camera roster is a fact, so the last real answer is
  // the right one and a forward model has nothing to add to it.
  if (reading.state === "held") return reading.value;
  if (reading.state === "absent") return whenConfirmedNothing;
  return undefined;
}

/** The id of the anchor on the target port. */
const PORT_ANCHOR_ID = "port";

export function DockingCameraAugment({
  cameraFlightId,
  reportPicture,
  targetPort,
  ax,
  ay,
  aligned,
  docked,
}: SlotProps<"rendezvous.camera">) {
  // A camera roster is a fact: cameras are fitted by an event, not by a frame.
  const cameras = stillTrue(useTelemetry("kerbcast.cameras"), undefined);
  const flightId = selectDockingCamera(cameras, cameraFlightId);
  const vfovDeg =
    cameras?.find((c) => c.cameraId === flightId)?.fieldOfView?.magnitude ??
    null;
  const ds = getUplinkHandle<KerbcastDataSource>("kerbcast");
  const client = ds?.getClient();

  // Kick the MEDIA connection once the CONTROL plane names a camera to show.
  // Necessary because the two planes are separate: the built-in HudCamera this
  // augment replaced read its list via `useKerbcastCameras`, which calls
  // `ensureConnected()` as a side effect, so the connect came for free. Reading
  // the list off the Uplink topic instead means nothing else would open the
  // WebRTC session: `useKerbcastStream`'s `subscribeCamera` only binds a slot
  // when the source is ALREADY connected, and never initiates. Without this a
  // brokered station stalls exactly the way `useKerbcastCameras`' own comment
  // describes: a camera is named, but no session is ever opened for it.
  // No-op once connected (e.g. the main screen, or a CameraFeed already up).
  useEffect(() => {
    if (flightId === null) return;
    ds?.ensureConnected();
  }, [flightId, ds]);

  // The DELAYED backdrop needs the mission-time capture clock (`useKerbcastClock`,
  // read by `useDelayedKerbcastStream`), which lives on a `KerbcastProvider`,
  // exactly the provider `CameraFeed` mounts for its own feed. Mounting our own,
  // fed the SAME `ds.getClient()` client, is what lets this backdrop and a
  // `CameraFeed` on the same camera share ONE delayed pipeline: the shared cache
  // in `useDelayedPlayout` keys on the camera, and both providers resolve the
  // identical camera handle and stream object off the one data source. Kept in the
  // inner `DockingCameraVideo` so the OUTER component (which subscribes to the
  // control channel above) never depends on the provider, a no-kerbcast HUD
  // still composes.
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

  if (flightId === null || !client || !subscriptions) return null;
  return (
    <KerbcastProvider client={client} subscriptions={subscriptions}>
      <DockingCameraVideo
        flightId={flightId}
        vfovDeg={vfovDeg}
        reportPicture={reportPicture}
        targetPort={targetPort}
        ax={ax}
        ay={ay}
        aligned={aligned}
        docked={docked}
      />
    </KerbcastProvider>
  );
}

function DockingCameraVideo({
  flightId,
  vfovDeg,
  reportPicture,
  targetPort,
  ax,
  ay,
  aligned,
  docked,
}: {
  flightId: number;
  vfovDeg: number | null;
  reportPicture: SlotProps<"rendezvous.camera">["reportPicture"];
  targetPort: SlotProps<"rendezvous.camera">["targetPort"];
  ax: number | undefined;
  ay: number | undefined;
  aligned: boolean;
  docked: boolean;
}) {
  // The DELAYED stream, not the raw live one. The HUD's reticle is UT-gated by
  // the ViewClock; the backdrop must be gated on the SAME clock or it marks
  // where the target WAS over an image of where it IS, worst precisely when
  // closing on a docking port (decision 5: never the live stream). `null` (no
  // delayed output available) draws no backdrop rather than falling back to
  // live.
  const stream = useDelayedKerbcastStream(flightId);
  // Held in state so the effects and the markers follow the element as it mounts.
  const [videoEl, setVideoEl] = useState<HTMLVideoElement | null>(null);
  // The backdrop's own box, mounted whether or not there is a picture yet: the
  // size report observes the element once, when the camera is chosen, and a
  // video that only appears with the stream would never be seen by it.
  const boxRef = useRef<HTMLDivElement>(null);
  useReportFrameSize(flightId, boxRef);

  const client = getUplinkHandle<KerbcastDataSource>("kerbcast")?.getClient();
  const vesselPersistentId = targetPort?.vesselPersistentId;
  const portPersistentId = targetPort?.portPersistentId;
  // The target port is marked by the game, in every displayed frame, so the triangles sit where the picture shows it.
  useEffect(() => {
    if (
      !client ||
      vesselPersistentId === undefined ||
      portPersistentId === undefined
    )
      return;
    const anchors: Anchor[] = [
      {
        id: PORT_ANCHOR_ID,
        kind: AnchorKind.Part,
        vessel: vesselPersistentId,
        part: portPersistentId,
        occlusion: true,
      },
    ];
    client.setAnchors(flightId, anchors).catch(() => {});
    return () => {
      void client.setAnchors(flightId, null).catch(() => {});
    };
  }, [client, flightId, vesselPersistentId, portPersistentId]);

  // Development aid, off unless its switch is set: every displayed frame's anchor positions and rtp timestamp, with what the widget handed the marks at that moment.
  const markInputs = useRef<DockMarkInputs | null>(null);
  markInputs.current = { ax, ay, aligned, docked };
  useEffect(() => {
    if (!dockFrameLogEnabled() || !client || !videoEl) return;
    return client.watchDisplayedFrames(flightId, videoEl, (f) =>
      logDockFrame(f, markInputs.current),
    );
  }, [client, flightId, videoEl]);

  const anchorOverlay: AnchorOverlay = useMemo(
    () => ({
      shape: "triangles",
      corners: (anchor) => dockCorners({ anchor, ax, ay, aligned, docked }),
    }),
    [ax, ay, aligned, docked],
  );

  useEffect(() => {
    const v = videoEl;
    if (!v) return;
    v.srcObject = stream;
    if (stream) {
      // play() can reject when srcObject is reassigned mid-flight, benign.
      void v.play().catch(() => {});
    }
  }, [stream, videoEl]);

  // The HUD is told the video's own size and the camera's field, and when the picture goes: it draws no reticle of its own over a picture.
  useEffect(() => {
    const v = videoEl;
    if (!v || !stream || vfovDeg === null) return;
    const report = () => {
      if (v.videoWidth > 0 && v.videoHeight > 0) {
        reportPicture({
          frameWidth: v.videoWidth,
          frameHeight: v.videoHeight,
          vfovDeg,
        });
      }
    };
    report();
    v.addEventListener("loadedmetadata", report);
    v.addEventListener("resize", report);
    return () => {
      v.removeEventListener("loadedmetadata", report);
      v.removeEventListener("resize", report);
      reportPicture(null);
    };
  }, [stream, videoEl, vfovDeg, reportPicture]);

  // Absolutely positioned over the HudPanel (AugmentSlot renders a bare
  // fragment, so this box is a direct HudPanel child, exactly where the
  // built-in HudCamera's HudVideo sat), under the Viewport's tinted reticle
  // layer. Structural inline style: no bespoke CSS, so nothing in ui-kit.
  return (
    <div
      ref={boxRef}
      style={{ position: "absolute", inset: 0, pointerEvents: "none" }}
    >
      {stream && (
        <video
          ref={setVideoEl}
          autoPlay
          muted
          playsInline
          style={{
            position: "absolute",
            inset: 0,
            width: "100%",
            height: "100%",
            objectFit: "cover",
            opacity: 0.55,
          }}
        />
      )}
      {stream && vesselPersistentId !== undefined && (
        <PortMarkers
          flightId={flightId}
          video={videoEl}
          overlay={anchorOverlay}
        />
      )}
    </div>
  );
}

/** The markers on the displayed frame, kept in a component of their own so only they re-render at the frame rate. */
function PortMarkers({
  flightId,
  video,
  overlay,
}: {
  flightId: number;
  video: HTMLVideoElement | null;
  overlay: AnchorOverlay;
}) {
  const frame = useDisplayedFrame(true, flightId, video);
  return <AnchorMarkers frame={frame} video={video} overlay={overlay} />;
}

registerAugment({
  id: "kerbcast-docking-camera",
  augments: "rendezvous.camera",
  requires: "kerbcast",
  channels: ["kerbcast.cameras"],
  component: DockingCameraAugment,
  owner: KERBCAST,
});

export { selectDockingCamera };
