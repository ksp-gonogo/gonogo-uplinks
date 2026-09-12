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
 * It is drawn OVER the picture as TWO absolutely positioned siblings, and
 * neither takes a share of the layout, because the host is a video widget whose
 * content is the picture. The CLUSTER, in the bottom-right corner, is the
 * control: the wheels and the commit, sized to its own content. The PREVIEW is
 * not in it. It is a free-standing tile at the bottom CENTRE of the picture,
 * because it is a readout of what the control is about to do rather than part
 * of the control, and because inside the cluster it was the thing that got cut:
 * the cluster is `overflow: hidden` (it has to be, it is `max-width`-clamped to
 * the picture) and the preview was drawn last, so the quad's deliberate spill
 * outside the feed frame was sliced at the cluster's right edge on every
 * picture wide enough to draw it at all.
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
 * on the shot. Both of those live controls stand down for as long as this
 * surface is up: the host passes `disableManualControls`, because a live pan
 * pad above the delay threshold aims at where the craft is NOW while the
 * picture shows where it was a light-time ago, and two controls for one camera
 * with nothing on screen saying which is which is worse than either alone.
 * Two earlier shapes both failed that: a 220x132 preview box
 * stacked above the tapes (~305x290 CSS px of intrinsic size, larger than the
 * whole widget at its own default tile), then a preview drawn at the picture's
 * own size with the tapes in a full-width strip along the bottom edge, which put
 * a quad across the whole shot and gave the strip 45.6% of the picture.
 *
 * Bounds + the seed setpoint come in as props (the host `CameraFeed` reads them
 * off the live `CameraState`), so this component stays headless-testable with
 * no kerbcast client.
 *
 * A bound analog input reaches the draft through {@link
 * CameraSetpointSurfaceHandle}, not through a value: there is no "set this
 * angle" action to bind, because the operator is composing a target rather than
 * reading one back. A held stick turns a wheel at a rate and releasing stops it,
 * and nothing leaves the widget until the commit. See `setpointRate.ts`.
 */

import { useCommand } from "@ksp-gonogo/sitrep-sdk";
import { Box, usePanelDelay } from "@ksp-gonogo/ui-kit";
import {
  type CSSProperties,
  forwardRef,
  useEffect,
  useImperativeHandle,
  useRef,
  useState,
} from "react";
import {
  type CameraSetpoint,
  type CameraSetpointBounds,
  CameraSetpointInput,
  SETPOINT_INPUT_WIDTH_PX,
} from "./CameraSetpointInput.js";
import { FramingPreview } from "./FramingPreview.js";
import {
  advanceSetpoint,
  anyHeld,
  type AxisRates,
  REST_RATES,
  SETPOINT_TICK_MS,
  type SetpointAxis,
  settleRate,
} from "./setpointRate.js";

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

/** The SDK's own pan pad, read off its `PanControl`: a square inset from the
 *  bottom-right corner of the picture. The cluster takes that corner, and the
 *  pad stands down while it does (`disableManualControls` on the host), so the
 *  inset is what the two share rather than a clearance between them. */
const SDK_PAN_PAD_INSET_PX = 10;

/** Clear air between the centred preview tile and the cluster beside it, CSS px
 *  (`--space-4`). Two pieces of chrome on one picture with no gap read as one
 *  piece of chrome with a seam in it. */
const PREVIEW_CLEARANCE_PX = 4;

/** What the `Box` below adds around its content on each axis: `pad="xs"`
 *  (`--space-2`) plus the 1px `bordered` rule, both sides. */
const CLUSTER_CHROME_PX = 2 * (2 + 1);

/** The cluster's own box, now that it holds the control and nothing else. It is
 *  a CONSTANT per picture, where it used to grow by a tile, which is what makes
 *  the question below a clearance rather than a share. */
const CLUSTER_WIDTH_PX = SETPOINT_INPUT_WIDTH_PX + CLUSTER_CHROME_PX;

/**
 * The preview tile's own size, or `null` when the picture has no room to draw
 * it WHOLE and clear of the cluster.
 *
 * The question changed with the tile's home. Inside the cluster it was a share
 * one: the tile grew the cluster, so what it cost was how much of the shot the
 * cluster covered, and the rule was an area cap. Bottom-centre of the picture
 * the tile costs the cluster nothing and the shot almost nothing (64px of a
 * 348px picture), and the only thing it can run into is the cluster itself,
 * which is right-anchored and reaches back past the centre line. So the rule is
 * CLEARANCE: half a tile plus a gap, measured from the centre of the picture,
 * has to stop short of the cluster's left edge.
 *
 * That is a stricter test than the area cap it replaces, and deliberately: an
 * area cap admits a tile that overlaps the control, and half a diagram behind a
 * wheel is the cut-off the move was made to end. A picture that fails it draws
 * no tile and keeps the numbers, which are the control.
 *
 * The first test doubles as the guard against a zero-sized frame, which is what
 * an unmeasured feed and every jsdom test report.
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
  const height = Math.round(
    Math.min(
      PREVIEW_WIDTH_PX,
      Math.max(
        PREVIEW_MIN_HEIGHT_PX,
        (PREVIEW_WIDTH_PX * frame.height) / frame.width,
      ),
    ),
  );
  // A tile that fills the picture it is a model OF is not a model of it. The
  // tile is bottom-anchored on the same inset the cluster is, so its top edge is
  // what has to stay inside the picture.
  if (height + SDK_PAN_PAD_INSET_PX + CLUSTER_INSET_PX > frame.height) {
    return null;
  }
  const clusterLeftEdge =
    frame.width - SDK_PAN_PAD_INSET_PX - CLUSTER_WIDTH_PX;
  const tileRightEdge = frame.width / 2 + PREVIEW_WIDTH_PX / 2;
  if (tileRightEdge + PREVIEW_CLEARANCE_PX > clusterLeftEdge) return null;
  return { width: PREVIEW_WIDTH_PX, height };
}

/**
 * What a bound input drives when the staged surface, rather than the camera, is
 * the thing being aimed.
 *
 * An imperative handle for the same reason `CameraFeed` already holds one onto
 * the SDK's feed: the draft is this component's own state, the serial actions
 * are declared on the host widget, and lifting the draft up to the host to join
 * them would put the operator's in-progress target in the tree that re-renders
 * at stream rate and end the "props only, no data hooks" testability this
 * component is written for.
 */
export interface CameraSetpointSurfaceHandle {
  /**
   * Hold an axis of the DRAFT at `rate` (-1..1 of
   * {@link SETPOINT_DEG_PER_SECOND}), or release it with a rate inside the rest
   * band. Nothing is sent to the camera: the wheel turns and the operator
   * commits when they are ready.
   */
  setAxisRate(axis: SetpointAxis, rate: number): void;
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
   * wheels alone and draws no tile.
   */
  frame?: { width: number; height: number };
}

export const CameraSetpointSurface = forwardRef<
  CameraSetpointSurfaceHandle,
  CameraSetpointSurfaceProps
>(function CameraSetpointSurface(
  { cameraId, bounds, initial, mode, frame },
  ref,
): JSX.Element | null {
  // Seeded from the current aim ONCE, and never re-seeded from it. The draft is
  // a target the operator is composing, which under delay is legitimately not
  // where the camera is; a wheel that snapped back to the readback would fight
  // the input that was turning it.
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

  // ---- Held-input integration ----
  // What is held, in state, because the ticker below is an effect and rest has
  // to be able to stop it.
  const [rates, setRates] = useState<AxisRates>(REST_RATES);
  // Bounds read at tick time rather than closed over. The host rebuilds this
  // object every render (it is derived inline from the live `CameraState`), so
  // an effect depending on it would tear the timer down and stand it back up at
  // stream rate, and the draft would move in fits or not at all.
  const boundsRef = useRef(bounds);
  boundsRef.current = bounds;

  useImperativeHandle(
    ref,
    () => ({
      setAxisRate(axis, rate) {
        const settled = settleRate(rate);
        setRates((current) =>
          current[axis] === settled ? current : { ...current, [axis]: settled },
        );
      },
    }),
    [],
  );

  /**
   * While anything is held, move the draft; the wheels are controlled, so they
   * turn with it.
   *
   * A fixed per-tick step rather than a measured elapsed time, matching the
   * kit's own rate-mode wheel. A tab that is backgrounded with an input still
   * held then UNDER-moves rather than returning and slamming the draft to a
   * bound, and for a setpoint about to be committed, moving too little is
   * something the operator can see and correct while moving too far is a wrong
   * command.
   *
   * Torn down on release (rest empties the dependency), on unmount, and on a
   * change of mode, which unmounts this whole surface from the host. A timer
   * that outlived any of the three would keep turning a wheel nobody is holding.
   */
  useEffect(() => {
    if (!anyHeld(rates)) return;
    const timer = setInterval(() => {
      setSetpoint((current) =>
        advanceSetpoint(
          current,
          rates,
          boundsRef.current,
          SETPOINT_TICK_MS / 1000,
        ),
      );
    }, SETPOINT_TICK_MS);
    return () => clearInterval(timer);
  }, [rates]);

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
    <>
      <Box
        pad="xs"
        radius="sm"
        bordered
        style={CLUSTER_STYLE}
        aria-label="Delayed camera control"
      >
        <CameraSetpointInput
          value={setpoint}
          bounds={bounds}
          gated={mode === "no-path"}
          gatedReason="No signal path"
          onChange={setSetpoint}
          onCommit={handleCommit}
        />
      </Box>
      {preview && (
        <div style={PREVIEW_STYLE}>
          <FramingPreview
            setpoint={setpoint}
            bounds={bounds}
            width={preview.width}
            height={preview.height}
            committing={committing}
          />
        </div>
      )}
    </>
  );
});

/**
 * The cluster, in the picture's bottom-right corner: the SDK's own pan pad's
 * corner, which the pad has vacated.
 *
 * The pad is `52x52` at `bottom: 10px; right: 10px`, read off the SDK's own
 * `PanControl`, and the same two insets are used here so the staged cluster
 * lands exactly where the live control was. The two sat SIDE BY SIDE for a
 * while, on the reasoning that the live pad was the yardstick for what the
 * delayed cluster cost in picture. That reasoning offered the operator a live
 * pan pad and a live zoom pair that, above the delay threshold, aim at where
 * the craft is now while the picture shows where it was a light-time ago. The
 * host passes `disableManualControls` now, so there is no second control to
 * stand beside and no yardstick to read: this IS the aim control, and it takes
 * the corner the aim control has always been in.
 *
 * No `left`, so an absolutely positioned box shrinks to its own content instead
 * of spanning the shot; `max-width` then keeps it inside the picture on a tile
 * too narrow to hold it, where what gives is how much of the cluster is on
 * screen at once rather than how much of the video is left.
 *
 * It stays ONE BLOCK, and that is the kit's job rather than a trick played on
 * it. `CommandGroup wrap={false}` is the real fix for what an inner
 * `width: max-content` track used to buy: that track defeated the wrap by
 * laying the row out against the width it wanted, which made the cluster a
 * sideways-scrolling strip with the FOV tape off the edge of the picture.
 * Uncontrolled growth on either axis is the one thing this widget must not do,
 * and it is not containable by a `max-height`, because the render harness grows
 * the tile until nothing inside it scrolls vertically.
 *
 * `overflow: hidden` rather than `auto`: a block that no longer wraps and is
 * sized to the corner has nothing to scroll TO, and a scroll container here only
 * ever offered a scrollbar drawn across the shot. It is also why the framing
 * preview is no longer in here. Nothing the CONTROL draws wants to leave this
 * box, so the clip is right for it; the preview's quad wants to leave its own
 * tile by design, so the same clip was wrong for that, and the tile drawn last
 * in the row was the one it landed on.
 *
 * Its own translucent backing rather than `surface="panel"`: an opaque panel
 * colour over a moving picture reads as a hole cut in the video, where the
 * darkened wash reads as chrome laid on top of it, the same language the
 * "delayed feed unavailable" scrim already uses.
 */
const CLUSTER_STYLE: CSSProperties = {
  position: "absolute",
  right: `${SDK_PAN_PAD_INSET_PX}px`,
  bottom: `${SDK_PAN_PAD_INSET_PX}px`,
  maxWidth: `calc(100% - ${SDK_PAN_PAD_INSET_PX + CLUSTER_INSET_PX}px)`,
  overflow: "hidden",
  background: "rgba(0, 0, 0, 0.72)",
  pointerEvents: "auto",
};

/**
 * The framing preview: bottom CENTRE of the picture, standing on its own.
 *
 * The same bottom inset the cluster uses, so the two sit on one line along the
 * foot of the shot rather than at two heights. Centred with `left: 50%` and a
 * half-width translate rather than `inset-inline: 0` plus `margin: auto`,
 * because an absolutely positioned box with both edges pinned spans the picture
 * and this one has to shrink to the tile.
 *
 * NOTHING CLIPS IT, which is the whole point of the move. The tile's own SVG is
 * `overflow: visible` and says why: a pan-and-zoom target legitimately lands
 * partly outside the current view, and a quad drawn crossing the feed frame is
 * the honest reading of that. Inside the cluster that spill met the cluster's
 * `overflow: hidden` and was sliced at whatever edge it reached first. Out here
 * it draws over the picture, which is where a target outside the current view
 * actually is. The spill is bounded by the geometry rather than by a box:
 * `computeTargetFraming` clamps the zoom ratio to 2 and the fisheye to 1.5, so
 * the widest quad a 64px tile can draw is about 150px across, centred on the
 * tile.
 *
 * Click-through, unlike the cluster. The preview is a readout and has no
 * gesture of its own, and it is laid over the middle of the shot where the SDK's
 * own hover behaviour lives; a transparent tile that swallowed a pointer there
 * would be a dead patch in the picture for no gain.
 */
const PREVIEW_STYLE: CSSProperties = {
  position: "absolute",
  left: "50%",
  transform: "translateX(-50%)",
  bottom: `${SDK_PAN_PAD_INSET_PX}px`,
  pointerEvents: "none",
};
