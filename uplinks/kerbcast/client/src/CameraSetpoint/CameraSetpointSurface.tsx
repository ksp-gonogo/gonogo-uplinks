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
 * It is drawn OVER the picture, in two pieces: the reticle sits on the live
 * feed at the feed's own scale, and the tapes sit in a bar along the bottom
 * edge. Both are absolutely positioned and neither takes a share of the layout,
 * because the host is a video widget whose content is the picture. The earlier
 * shape put the reticle in a fixed 220x132 box stacked above the tapes, which
 * made the surface ~305x290 CSS px of intrinsic size; at the widget's own
 * default tile (232x157) that is larger than the whole widget, and it covered
 * the shot it was aiming.
 *
 * Bounds + the seed setpoint come in as props (the host `CameraFeed` reads them
 * off the live `CameraState`), so this component stays headless-testable with
 * no kerbcast client.
 */

import { useCommand } from "@ksp-gonogo/sitrep-sdk";
import { Box, CommandDelay, Stack } from "@ksp-gonogo/ui-kit";
import { type CSSProperties, useEffect, useRef, useState } from "react";
import {
  type CameraSetpoint,
  type CameraSetpointBounds,
  CameraSetpointInput,
} from "./CameraSetpointInput.js";
import { FramingPreview } from "./FramingPreview.js";

/** Sitrep command ids (string literals, not exported from the SDK in TS). */
const SET_PAN = "kerbcast.setPan";
const SET_FOV = "kerbcast.setFieldOfView";

/** Local morph duration, kept in step with FramingPreview's `--duration-slow`. */
const MORPH_MS = 450;

/**
 * Smallest measured frame the reticle is drawn in, CSS px on the short side.
 * Below it the target quad is a few pixels across and reads as dirt on the
 * lens; the tapes still carry the numbers. Also the guard that keeps the
 * geometry away from a zero-sized frame, which is what an unmeasured feed and
 * every jsdom test report.
 */
const MIN_RETICLE_PX = 48;

export interface CameraSetpointSurfaceProps {
  /** KSP `Part.flightID` of the camera under control (the effective displayed id). */
  cameraId: number;
  bounds: CameraSetpointBounds;
  /** Seed setpoint from the current `CameraState` (`panYaw`/`panPitch`/`fov`). */
  initial: CameraSetpoint;
  mode: "live" | "staged" | "no-path";
  /**
   * Rendered size of the picture this surface is drawn over, CSS px, so the
   * reticle can be drawn in the feed's own pixel space rather than in a box of
   * its own. Absent (or zero, which is what an unmeasured feed reports) draws
   * no reticle and leaves the tapes alone.
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

  const reticle =
    frame !== undefined &&
    Math.min(frame.width, frame.height) >= MIN_RETICLE_PX
      ? frame
      : null;

  return (
    <>
      {reticle && (
        <div style={RETICLE_STYLE}>
          <FramingPreview
            setpoint={setpoint}
            bounds={bounds}
            width={reticle.width}
            height={reticle.height}
            committing={committing}
            clip
          />
        </div>
      )}
      <Box
        pad="xs"
        radius="sm"
        bordered
        style={BAR_STYLE}
        aria-label="Delayed camera control"
      >
        <div style={BAR_TRACK_STYLE}>
          <Stack gap="xs">
            <CameraSetpointInput
              value={setpoint}
              bounds={bounds}
              gated={mode === "no-path"}
              gatedReason="No signal path"
              onChange={setSetpoint}
              onCommit={handleCommit}
            />
            <CommandDelay handles={[setPan, setFov]} />
          </Stack>
        </div>
      </Box>
    </>
  );
}

/**
 * The reticle layer: the whole picture, click-through, so the aim is drawn on
 * the shot it describes rather than on a diagram of it.
 */
const RETICLE_STYLE: CSSProperties = {
  position: "absolute",
  inset: 0,
  pointerEvents: "none",
};

/**
 * The tapes, in a strip along the bottom edge of the picture.
 *
 * It scrolls SIDEWAYS on a narrow tile, and that direction is the whole point.
 * A JogWheel is a fixed 120x40 kit primitive and `CommandGroup` wraps them, so
 * a strip narrower than the three of them turns into three stacked rows, ~170px
 * of a tile whose whole height is 157. Vertical growth is the one thing this
 * widget must not do: it is what buried the picture, and it is not even
 * containable by a `max-height`, because the render harness grows the tile
 * until nothing inside it scrolls vertically. Held to one row the strip is
 * ~92px whatever the tile, the picture keeps the rest, and what gives on a
 * narrow tile is how much of the strip is on screen at once.
 *
 * Its own translucent backing rather than `surface="panel"`: an opaque panel
 * colour over a moving picture reads as a hole cut in the video, where the
 * darkened wash reads as chrome laid on top of it, the same language the
 * "delayed feed unavailable" scrim already uses.
 */
const BAR_STYLE: CSSProperties = {
  position: "absolute",
  left: "var(--space-8)",
  right: "var(--space-8)",
  bottom: "var(--space-8)",
  overflowX: "auto",
  overflowY: "hidden",
  // The picture is behind the bar, so a scrollbar drawn across it is chrome
  // over content. Wheel, trackpad, drag and keyboard all still reach it.
  scrollbarWidth: "none",
  background: "rgba(0, 0, 0, 0.72)",
  pointerEvents: "auto",
};

/**
 * What makes the strip one row: an inner box sized to its content, so
 * `CommandGroup`'s wrapping flex row is laid out against the width it wants
 * rather than the width the tile has. Without it the wrap decision is made
 * against the bar, and no amount of styling outside `@ksp-gonogo/ui-kit` can
 * argue with it.
 */
const BAR_TRACK_STYLE: CSSProperties = {
  width: "max-content",
  minWidth: "100%",
};
