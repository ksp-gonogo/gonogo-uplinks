/**
 * CameraSetpointInput: the grouped yaw/pitch/fov vector input for delayed
 * camera control. Yaw and zoom are horizontal `JogWheel` scrubbers stacked in a
 * column; pitch is a VERTICAL one standing beside them, which is what turns
 * three tapes in a line into a block roughly as tall as it is wide. The three
 * sit inside the existing `CommandGroup` commit container, so the whole vector
 * dispatches as ONE delayed command on an explicit commit (never on a child's
 * own change). Vanilla-safe: props only, no gonogo data hooks. The
 * `gated`/`gatedReason`/`commitLabel` pass straight through to `CommandGroup`,
 * whose own gating disables the commit under `no-path`, so this component does
 * not re-implement it.
 */

import { value } from "@ksp-gonogo/sitrep-sdk";
import { CommandGroup, JogWheel, writeQuantity } from "@ksp-gonogo/ui-kit";
import type { CSSProperties } from "react";

export type CameraSetpoint = { yaw: number; pitch: number; fov: number };
export type CameraSetpointBounds = {
  yawMin: number;
  yawMax: number;
  pitchMin: number;
  pitchMax: number;
  fovMin: number;
  fovMax: number;
};

export interface CameraSetpointInputProps {
  value: CameraSetpoint;
  bounds: CameraSetpointBounds;
  onChange: (next: CameraSetpoint) => void;
  onCommit: (v: CameraSetpoint) => void;
  /** `no-path` → disable + error-tone the commit (forwarded to CommandGroup). */
  gated?: boolean;
  gatedReason?: string;
  /** Per-wheel increment. Default 1 (degree). */
  step?: number;
  /** Commit button label. Default "Commit". */
  commitLabel?: string;
}

/**
 * The wheels' boxes, CSS px, against the kit's 120x40 (horizontal) and 40x120
 * (vertical) defaults.
 *
 * `SHORT` is ONE number across both orientations: it is the horizontal wheels'
 * HEIGHT and the vertical wheel's WIDTH, so the pitch tape is exactly as thick
 * as the two it stands beside. It used to be the horizontal height alone, with
 * the pitch wheel taking `LONG` for its width, which drew a 50x52 near-square
 * next to two thin bars: a control that reads as a block rather than as an axis
 * you drag up and down.
 *
 * It is also the kit's `JOG_WHEEL_MIN_TARGET_PX` exactly: the WCAG 2.2 SC 2.5.8
 * floor for a pointer target, and the floor is where this sits because the two
 * horizontal wheels are stacked and their heights come straight out of the shot.
 * The kit clamps a smaller ask up to it anyway, so asking for less would be a
 * number that silently did not apply.
 *
 * `LONG` is the horizontal wheels' width alone, and it is set by TEXT rather
 * than by taste: their caret label is the kit's `--font-size-sm` mono and it
 * carries an axis glyph, a sign, up to three digits and a degree sign, which is
 * 40px of type inside 6px of border and padding. `TALL` is the height of the
 * two stacked wheels plus the gap between them, so the pitch wheel spans
 * exactly the pair it stands beside.
 */
const WHEEL_LONG_PX = 50;
const WHEEL_SHORT_PX = 24;
const WHEEL_STACK_GAP_PX = 4;
const WHEEL_TALL_PX = 2 * WHEEL_SHORT_PX + WHEEL_STACK_GAP_PX;

/** Gap between the stacked pair and the pitch wheel beside them, CSS px. */
const AXIS_GAP_PX = 4;

/**
 * The commit control beside the wheels: `CommandGroup`'s own `--space-8` before
 * it, then the button, which measures 67x22 for "Commit" in one line of
 * `--font-size-xs` inside 12px of horizontal padding and a border. Measured off
 * the rendered control in the render harness rather than reasoned about; the
 * first guess from the type metrics was 55, which would have under-reported the
 * cluster's width by 12px to every caller asking whether a tile fits.
 */
const COMMIT_GAP_PX = 8;
const COMMIT_WIDTH_PX = 67;

/**
 * What the whole control measures across, CSS px, for a caller deciding what
 * else the same corner can hold: the stacked pair, the pitch wheel beside them,
 * and the commit beside both.
 *
 * Composed from its parts rather than written down, so it cannot go stale
 * behind a change to a wheel's size. The commit is IN it now, because it is on
 * the same line: `orientation="row"` trades its whole line of height for its
 * own width, which is the trade a control drawn on a 176px-tall picture wants.
 */
export const SETPOINT_INPUT_WIDTH_PX =
  WHEEL_LONG_PX +
  AXIS_GAP_PX +
  WHEEL_SHORT_PX +
  COMMIT_GAP_PX +
  COMMIT_WIDTH_PX;

/**
 * And what it measures top to bottom, which is now the wheels and nothing else:
 * the commit stands beside them rather than under them, and it is shorter than
 * they are.
 */
export const SETPOINT_INPUT_HEIGHT_PX = WHEEL_TALL_PX;

/**
 * A caret label, in the one typographic detail that is load-bearing here: the
 * true MINUS SIGN rather than the hyphen `writeQuantity` writes.
 *
 * A hyphen is a line-break opportunity, and the caret label is centred in a box
 * five characters wide, so `P-10°` broke after the hyphen and drew "P-" over
 * "10°" on two lines inside a wheel with room for one. U+2212 offers no break,
 * so the label stays one run and the wheel is sized against a run it can hold.
 */
const formatDegrees = (v: number): string =>
  writeQuantity(value("°", v), { decimals: 0 }).replace("-", "−");

/**
 * One axis, named twice over: a glyph a sighted operator reads at 12px inside a
 * 48px box, and the full word for everyone else.
 *
 * The glyph goes in the caret LABEL because that is the only thing this control
 * can draw inside itself, and inside is the only place a label is free: a label
 * column beside three wheels this small is another 9px of picture per row, for
 * the same number of characters. The full word is on `ariaLabel`, which is the
 * accessible NAME and is never abbreviated, and again as a `title` on the
 * wrapper so a pointer can ask what "P" means. The wrapper exists only for that
 * title: `JogWheel` renders no `...rest`, so there is nowhere else to put it.
 *
 * The STANDING wheel carries no caret label, and that is arithmetic rather than
 * a preference. Its box is `WHEEL_SHORT_PX` across, which leaves 18px of content
 * inside the kit's border and compact inset, and `P−10°` measures 40px in the
 * kit's `--font-size-sm` mono. Both numbers are measured off the rendered
 * control. The kit's root is `overflow: hidden`, so a label that does not fit is
 * not a label that shrinks, it is one sliced through the middle: the widest
 * string this box can hold is under two characters, and a signed angle is three
 * at its shortest. So the standing wheel draws its tape and its caret, and the
 * value it is showing goes in the `title` beside the axis name, on top of the
 * `aria-valuetext` the kit already writes for every wheel.
 */
function AxisWheel({
  glyph,
  name,
  labelled = true,
  ...wheel
}: {
  glyph: string;
  name: string;
  /** Draw the value in the caret. Off for a wheel too narrow to hold it. */
  labelled?: boolean;
  orientation: "horizontal" | "vertical";
  width: number;
  height: number;
  value: number;
  min: number;
  max: number;
  step: number;
  onChange: (next: number) => void;
}): JSX.Element {
  const reading = formatDegrees(wheel.value);
  return (
    <span
      title={labelled ? name : `${name} ${reading}`}
      style={AXIS_WHEEL_STYLE}
    >
      <JogWheel
        {...wheel}
        ariaLabel={name}
        format={(v) => (labelled ? `${glyph}${formatDegrees(v)}` : "")}
      />
    </span>
  );
}

export function CameraSetpointInput({
  value,
  bounds,
  onChange,
  onCommit,
  gated,
  gatedReason,
  step = 1,
  commitLabel,
}: CameraSetpointInputProps): JSX.Element {
  return (
    <CommandGroup
      value={value}
      onChange={onChange}
      onCommit={onCommit}
      gated={gated}
      gatedReason={gatedReason}
      commitLabel={commitLabel}
      /* Beside the wheels, not under them. Under, the commit cost a whole line:
         a 52px block of wheels drew an 88px cluster, half the height of the
         176px picture the widget's own default tile produces. Beside, it costs
         its width instead, on the axis the corner has more of. The older
         reading (that beside "turns a square cluster back into a strip") was
         measured against a block two LONG wheels wide; the pitch wheel is now a
         SHORT one, so the wheels are 78px across rather than 104px. */
      orientation="row"
      /* One block, always. The children here are a single laid-out div, so a
         wrap would only ever break the pitch wheel off under the pair and make
         the cluster taller than the picture can spare. */
      wrap={false}
    >
      <div style={AXES_STYLE}>
        <div style={AXIS_STACK_STYLE}>
          <AxisWheel
            glyph="Y"
            name="Yaw"
            orientation="horizontal"
            width={WHEEL_LONG_PX}
            height={WHEEL_SHORT_PX}
            value={value.yaw}
            min={bounds.yawMin}
            max={bounds.yawMax}
            step={step}
            onChange={(yaw) => onChange({ ...value, yaw })}
          />
          <AxisWheel
            glyph="Z"
            name="Zoom (field of view)"
            orientation="horizontal"
            width={WHEEL_LONG_PX}
            height={WHEEL_SHORT_PX}
            value={value.fov}
            min={bounds.fovMin}
            max={bounds.fovMax}
            step={step}
            onChange={(fov) => onChange({ ...value, fov })}
          />
        </div>
        {/* Vertical, and as THIN as the two it stands beside are short, so it
            looks like what it does: a pitch axis an operator drags up and down.
            The kit's `orientation` already turns the drag, the tape and the
            caret; the box is what makes that legible before anyone touches it. */}
        <AxisWheel
          glyph="P"
          name="Pitch"
          labelled={false}
          orientation="vertical"
          width={WHEEL_SHORT_PX}
          height={WHEEL_TALL_PX}
          value={value.pitch}
          min={bounds.pitchMin}
          max={bounds.pitchMax}
          step={step}
          onChange={(pitch) => onChange({ ...value, pitch })}
        />
      </div>
    </CommandGroup>
  );
}

/** The stacked pair and the pitch wheel, side by side. */
const AXES_STYLE: CSSProperties = {
  display: "flex",
  alignItems: "flex-start",
  gap: `${AXIS_GAP_PX}px`,
};

/** Yaw over zoom: the two axes that read left-to-right. */
const AXIS_STACK_STYLE: CSSProperties = {
  display: "flex",
  flexDirection: "column",
  gap: `${WHEEL_STACK_GAP_PX}px`,
};

/** Carries the `title` and nothing else, so it must not take a box of its own. */
const AXIS_WHEEL_STYLE: CSSProperties = { display: "inline-flex" };
