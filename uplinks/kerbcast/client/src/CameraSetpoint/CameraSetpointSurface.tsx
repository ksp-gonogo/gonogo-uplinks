/**
 * CameraSetpointSurface: the delayed-camera control surface. Below the staged
 * delay threshold (`mode === "live"`) it renders nothing and the SDK's built-in
 * live pan/zoom controls stay in charge. At or above the threshold it takes
 * over: the operator dials an absolute yaw/pitch/fov target on the
 * `CameraSetpointInput`, reviews it against the current framing on the
 * `FramingPreview`, and commits ONE delayed command per axis-group through the
 * Sitrep command Courier (`kerbcast.setPan` + `kerbcast.setFieldOfView`, both
 * already `Delayed`). Under `no-path` the surface still shows but the commit is
 * gated, consistent with any uplink command under signal loss.
 *
 * It is drawn OVER the picture as ONE cluster tucked into the bottom-right
 * corner: the tapes, the commit and a small framing preview, sized to its own
 * content rather than to the picture. It is absolutely positioned and takes no
 * share of the layout, because the host is a video widget whose content is the
 * picture.
 *
 * The in-flight readout is NOT in the cluster. Both handles go to
 * `usePanelDelay`, so the host panel's own delay rail draws them in the band it
 * already reserves above the picture. An inline `CommandDelay` here would draw
 * the same dispatch a second time, in the one place on the widget where every
 * pixel is a pixel of the shot.
 *
 * The corner is the SDK's corner. kerbcast's own pan pad sits bottom-right and
 * its zoom pair on the left edge, so a staged control that supersedes the live
 * one lands on top of the affordance it is replacing instead of somewhere else
 * on the shot. Two earlier shapes both failed that: a 220x132 preview box
 * stacked above the tapes (~305x290 CSS px of intrinsic size, larger than the
 * whole widget at its own default tile), then a preview drawn at the picture's
 * own size with the tapes in a full-width strip along the bottom edge, which put
 * a quad across the whole shot and gave the strip 45.6% of the picture.
 *
 * Bounds + the seed setpoint come in as props (the host `CameraFeed` reads them
 * off the live `CameraState`), so this component stays headless-testable with
 * no kerbcast client.
 */

import { useCommand } from "@ksp-gonogo/sitrep-sdk";
import { Box, usePanelDelay } from "@ksp-gonogo/ui-kit";
import { type CSSProperties, useEffect, useRef, useState } from "react";
import {
  type CameraSetpoint,
  type CameraSetpointBounds,
  CameraSetpointInput,
  SETPOINT_INPUT_WIDTH_PX,
} from "./CameraSetpointInput.js";
import { FramingPreview } from "./FramingPreview.js";

/** Sitrep command ids (string literals, not exported from the SDK in TS). */
const SET_PAN = "kerbcast.setPan";
const SET_FOV = "kerbcast.setFieldOfView";

/** Local morph duration, kept in step with FramingPreview's `--duration-slow`. */
const MORPH_MS = 450;

/** Width of the framing preview tile, CSS px. Its height follows the picture's
 *  aspect, so the tile reads as a scale model of the shot it previews. */
const PREVIEW_WIDTH_PX = 64;

/** Shortest a preview tile may get before it stops saying anything. */
const PREVIEW_MIN_HEIGHT_PX = 28;

/** How far the cluster keeps off each edge of the picture: `--space-8`, in the
 *  CSS px the arithmetic below needs it in. */
const CLUSTER_INSET_PX = 8;

/** Gap between the tapes and the preview tile, CSS px (`--space-4`). */
const PREVIEW_GAP_PX = 4;

/**
 * The preview tile's own size, or `null` when the picture cannot spare one.
 *
 * The tile is the one OPTIONAL part of the cluster, so whether it fits is a
 * question about what the rest already costs, and it is asked that way: the
 * tapes plus the commit are `SETPOINT_INPUT_WIDTH_PX` wide whatever the picture
 * is, and a picture that cannot hold those plus a tile plus the insets drops the
 * tile and keeps the numbers, which are the control. The same test doubles as
 * the guard against a zero-sized frame, which is what an unmeasured feed and
 * every jsdom test report.
 *
 * The height follows the picture's aspect rather than a fixed rectangle: the
 * preview says where a framing lands inside the current view, and a 16:9 model
 * of a square view puts the target in the wrong place along one axis. A very
 * wide, short picture is the exception, where a true scale model would be under
 * ten pixels tall and legibility wins over fidelity.
 */
function previewSize(
  frame: { width: number; height: number } | undefined,
): { width: number; height: number } | null {
  if (!frame || frame.width <= 0 || frame.height <= 0) return null;
  const room =
    SETPOINT_INPUT_WIDTH_PX +
    PREVIEW_GAP_PX +
    PREVIEW_WIDTH_PX +
    2 * CLUSTER_INSET_PX;
  if (frame.width < room) return null;
  const height = Math.round(
    Math.min(
      PREVIEW_WIDTH_PX,
      Math.max(
        PREVIEW_MIN_HEIGHT_PX,
        (PREVIEW_WIDTH_PX * frame.height) / frame.width,
      ),
    ),
  );
  // A tile that fills the picture it is a model OF is not a model of it.
  if (frame.height < height + 4 * CLUSTER_INSET_PX) return null;
  return { width: PREVIEW_WIDTH_PX, height };
}

export interface CameraSetpointSurfaceProps {
  /** KSP `Part.flightID` of the camera under control (the effective displayed id). */
  cameraId: number;
  bounds: CameraSetpointBounds;
  /** Seed setpoint from the current `CameraState` (`panYaw`/`panPitch`/`fov`). */
  initial: CameraSetpoint;
  mode: "live" | "staged" | "no-path";
  /**
   * Rendered size of the picture this surface is drawn over, CSS px. It sets
   * the preview tile's aspect and decides whether the picture can spare one at
   * all. Absent (or zero, which is what an unmeasured feed reports) leaves the
   * tapes alone and draws no tile.
   */
  frame?: { width: number; height: number };
}

export function CameraSetpointSurface({
  cameraId,
  bounds,
  initial,
  mode,
  frame,
}: CameraSetpointSurfaceProps): JSX.Element | null {
  const [setpoint, setSetpoint] = useState<CameraSetpoint>(initial);
  const [committing, setCommitting] = useState(false);
  const morphTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Two delayed commands, one per axis-group. Held unconditionally (rules of
  // hooks) even in `live` mode where the surface renders nothing.
  const setPan = useCommand(SET_PAN);
  const setFov = useCommand(SET_FOV);

  // The host panel's rail draws both, in the band it reserves whether or not
  // anything is in flight. This is also what marks each handle's must-consume
  // token, so dropping the inline `CommandDelay` costs the invariant nothing.
  usePanelDelay(setPan);
  usePanelDelay(setFov);

  useEffect(
    () => () => {
      if (morphTimerRef.current !== null) clearTimeout(morphTimerRef.current);
    },
    [],
  );

  // Commit dispatches BOTH absolute delayed commands (one pan vector + one FOV
  // scalar) through the Sitrep Courier, then runs the local confirm morph.
  // CommandGroup already blocks the commit while gated (`no-path`), so no extra
  // guard is needed here. Degrees are plain numbers, absolute (not rates).
  const handleCommit = (next: CameraSetpoint): void => {
    setPan.send({ cameraId, yaw: next.yaw, pitch: next.pitch }).catch(() => {});
    setFov.send({ cameraId, fieldOfView: next.fov }).catch(() => {});
    setCommitting(true);
    if (morphTimerRef.current !== null) clearTimeout(morphTimerRef.current);
    morphTimerRef.current = setTimeout(() => setCommitting(false), MORPH_MS);
  };

  if (mode === "live") return null;

  const preview = previewSize(frame);

  return (
    <Box
      pad="xs"
      radius="sm"
      bordered
      style={CLUSTER_STYLE}
      aria-label="Delayed camera control"
    >
      <div style={CLUSTER_TRACK_STYLE}>
        <CameraSetpointInput
          value={setpoint}
          bounds={bounds}
          gated={mode === "no-path"}
          gatedReason="No signal path"
          onChange={setSetpoint}
          onCommit={handleCommit}
        />
        {preview && (
          // Last, so a picture too narrow for the whole cluster clips the
          // PREVIEW first and keeps the tapes: the numbers are the control, the
          // tile is the review of them.
          <FramingPreview
            setpoint={setpoint}
            bounds={bounds}
            width={preview.width}
            height={preview.height}
            committing={committing}
          />
        )}
      </div>
    </Box>
  );
}

/**
 * The cluster, tucked into the bottom-right corner of the picture.
 *
 * No `left`, so an absolutely positioned box shrinks to its own content instead
 * of spanning the shot; `max-width` then keeps it inside the picture on a tile
 * too narrow to hold it, where what gives is how much of the cluster is on
 * screen at once rather than how much of the video is left.
 *
 * It stays ONE ROW, and that is now the kit's job rather than a trick played on
 * it. `CommandGroup wrap={false}` is the real fix for what an inner
 * `width: max-content` track used to buy: that track defeated the wrap by
 * laying the row out against the width it wanted, which made the cluster a
 * sideways-scrolling strip with the FOV tape off the edge of the picture.
 * Vertical growth is still the one thing this widget must not do, and it is not
 * containable by a `max-height`, because the render harness grows the tile
 * until nothing inside it scrolls vertically.
 *
 * `overflow: hidden` rather than `auto`: a row that no longer wraps and is sized
 * to the corner has nothing to scroll TO, and a scroll container here only ever
 * offered a scrollbar drawn across the shot.
 *
 * Its own translucent backing rather than `surface="panel"`: an opaque panel
 * colour over a moving picture reads as a hole cut in the video, where the
 * darkened wash reads as chrome laid on top of it, the same language the
 * "delayed feed unavailable" scrim already uses.
 */
const CLUSTER_STYLE: CSSProperties = {
  position: "absolute",
  right: "var(--space-8)",
  bottom: "var(--space-8)",
  maxWidth: "calc(100% - 2 * var(--space-8))",
  overflow: "hidden",
  background: "rgba(0, 0, 0, 0.72)",
  pointerEvents: "auto",
};

/** The tapes and the preview tile, side by side, vertically centred. */
const CLUSTER_TRACK_STYLE: CSSProperties = {
  display: "flex",
  alignItems: "center",
  gap: "var(--space-4)",
};
