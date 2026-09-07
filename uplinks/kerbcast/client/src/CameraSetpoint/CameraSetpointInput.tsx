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
 * `SHORT` is the kit's `JOG_WHEEL_MIN_TARGET_PX` exactly: the WCAG 2.2 SC 2.5.8
 * floor for a pointer target, and the floor is where this sits because the two
 * horizontal wheels are stacked and their heights come straight out of the shot.
 * The kit clamps a smaller ask up to it anyway, so asking for less would be a
 * number that silently did not apply.
 *
 * `LONG` is set by TEXT, not by taste: the caret label is the kit's
 * `--font-size-sm` mono and it carries an axis glyph, a sign, up to three
 * digits and a degree sign, which is 40px of type inside 6px of border and
 * padding. `TALL` is what makes the pitch wheel read as vertical rather than as
 * a horizontal one that happens to drag the other way, and it is the height of
 * the two stacked wheels plus the gap between them, so the block squares off.
 */
const WHEEL_LONG_PX = 50;
const WHEEL_SHORT_PX = 24;
const WHEEL_STACK_GAP_PX = 4;
const WHEEL_TALL_PX = 2 * WHEEL_SHORT_PX + WHEEL_STACK_GAP_PX;

/** Gap between the stacked pair and the pitch wheel beside them, CSS px. */
const AXIS_GAP_PX = 4;

/**
 * What the three wheels measure, CSS px, for a caller deciding what else the
 * same corner can hold.
 *
 * Composed from its parts rather than written down, so it cannot go stale
 * behind a change to a wheel's size. The commit is NOT in it: `CommandGroup`
 * draws it on its own line under the wheels, where it is narrower than they
 * are, so it costs this measurement nothing.
 */
export const SETPOINT_INPUT_WIDTH_PX = 2 * WHEEL_LONG_PX + AXIS_GAP_PX;

/**
 * And what the whole control measures top to bottom: the wheels, then
 * `CommandGroup`'s own `--space-8` before the commit, then the commit itself,
 * which is 23px for one line of `--font-size-xs` inside 4px of padding and a
 * border.
 */
export const SETPOINT_INPUT_HEIGHT_PX = WHEEL_TALL_PX + 8 + 23;

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
 */
function AxisWheel({
  glyph,
  name,
  ...wheel
}: {
  glyph: string;
  name: string;
  orientation: "horizontal" | "vertical";
  width: number;
  height: number;
  value: number;
  min: number;
  max: number;
  step: number;
  onChange: (next: number) => void;
}): JSX.Element {
  return (
    <span title={name} style={AXIS_WHEEL_STYLE}>
      <JogWheel
        {...wheel}
        ariaLabel={name}
        format={(v) => `${glyph}${formatDegrees(v)}`}
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
      /* Under the wheels, not beside them: beside, the commit adds its whole
         width to a block that is already two wheels wide, and turns a square
         cluster back into the strip this stopped being. Under, it is narrower
         than the wheels and costs width nothing. */
      orientation="column"
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
        {/* Vertical, and drawn taller than it is wide so it looks like what it
            does: a pitch axis an operator drags up and down. The kit's
            `orientation` already turns the drag, the tape and the caret; the
            box is what makes that legible before anyone touches it. */}
        <AxisWheel
          glyph="P"
          name="Pitch"
          orientation="vertical"
          width={WHEEL_LONG_PX}
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
