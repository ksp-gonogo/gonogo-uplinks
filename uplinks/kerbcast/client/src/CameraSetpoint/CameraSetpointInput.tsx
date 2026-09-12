/**
 * CameraSetpointInput: the grouped yaw/pitch/fov vector input for delayed
 * camera control. Yaw and zoom are horizontal `JogWheel` scrubbers stacked in a
 * column; pitch is the same wheel turned a quarter turn, standing beside them,
 * which is what turns three tapes in a line into a block roughly as tall as it
 * is wide. The three sit inside the existing `CommandGroup` commit container, so
 * the whole vector dispatches as ONE delayed command on an explicit commit
 * (never on a child's own change). Vanilla-safe: props only, no gonogo data
 * hooks. The `gated`/`gatedReason`/`commitLabel` pass straight through to
 * `CommandGroup`, whose own gating disables the commit under `no-path`, so this
 * component does not re-implement it.
 */

import { value } from "@ksp-gonogo/sitrep-sdk";
import { CommandGroup, JogWheel, writeQuantity } from "@ksp-gonogo/ui-kit";
import type { CSSProperties } from "react";
// Named, not default: `styled-components@6` ships no `exports` map, so under
// `moduleResolution: nodenext` the default import resolves to the CJS
// namespace and `styled.div` is a type error. The named export binds in both
// modes, and the nodenext typecheck is the gate that says so.
import { styled } from "styled-components";

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
 * ONE wheel box, CSS px, drawn twice: the flat wheels are `LONG x SHORT` and
 * the standing one is `SHORT x LONG`. Same control, quarter turn. Against the
 * kit's 120x40 (horizontal) and 40x120 (vertical) defaults, which are both far
 * too big for a corner of a video.
 *
 * `SHORT` is the kit's `JOG_WHEEL_MIN_TARGET_PX` exactly: the WCAG 2.2 SC 2.5.8
 * floor for a pointer target, and the floor is where this sits because the two
 * flat wheels are stacked and their heights come straight out of the shot. The
 * kit clamps a smaller ask up to it anyway, so asking for less would be a number
 * that silently did not apply.
 *
 * `LONG` is set by TEXT rather than by taste: a flat wheel's caret label is the
 * kit's `--font-size-sm` mono and it carries an axis glyph, a sign, up to three
 * digits and a degree sign, which is 40px of type inside 6px of border and
 * padding.
 *
 * The standing wheel used to take the STACK's height (52) instead of `LONG`,
 * on a "span the pair you stand beside" rule. It is within 2px of the same
 * number and it is the wrong rule: it made the pitch box a function of how many
 * flat axes happen to be stacked, so a third flat axis would have stretched the
 * pitch wheel rather than left it alone.
 */
const WHEEL_LONG_PX = 50;
const WHEEL_SHORT_PX = 24;
const WHEEL_STACK_GAP_PX = 4;

/** The stacked flat pair, top to bottom. */
const AXIS_STACK_HEIGHT_PX = 2 * WHEEL_SHORT_PX + WHEEL_STACK_GAP_PX;

/** Gap between the stacked pair and the pitch wheel beside them, CSS px. */
const AXIS_GAP_PX = 4;

/**
 * The commit control beside the wheels: `CommandGroup`'s own gap before it, then
 * the button. Both numbers are measured off the rendered control in the render
 * harness rather than reasoned about; the first guess from the type metrics was
 * 55 against a then-67px button, which would have under-reported the cluster's
 * width by 12px to every caller asking whether a tile fits.
 *
 * The gap is `--space-8`, which {@link CommitScope} sets to 4 so the cluster
 * keeps one rhythm; the width is what "Commit" measures in the uppercase mono
 * that scope also hands the button.
 *
 * Its HEIGHT is not written down here because nothing needs it: the commit is
 * shorter than the wheels it stands beside, so the cluster's depth is theirs.
 * It measures 24 in the same render, which is the wheels' own short axis and
 * the WCAG 2.2 SC 2.5.8 target floor: the mono face is what took it there, from
 * the 22 the kit's default type drew.
 */
const COMMIT_GAP_PX = 4;
const COMMIT_WIDTH_PX = 63;

/**
 * What the whole control measures across, CSS px, for a caller deciding what
 * else the same corner can hold: the stacked pair, the pitch wheel beside them,
 * and the commit beside both.
 *
 * Composed from its parts rather than written down, so it cannot go stale
 * behind a change to a wheel's size. The commit is IN it now, because it is on
 * the same line: `orientation="row"` trades its whole line of height for its
 * own width, which is the trade a control drawn on a 194px-tall picture wants.
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
 * they are. The taller of the two columns, because the standing wheel is sized
 * off its flat partner and the stack is sized off how many flat axes there are,
 * so neither one is guaranteed to be the deeper.
 */
export const SETPOINT_INPUT_HEIGHT_PX = Math.max(
  AXIS_STACK_HEIGHT_PX,
  WHEEL_LONG_PX,
);

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
 * 50px box, and the full word for everyone else.
 *
 * The glyph goes in the caret LABEL because that is the only thing this control
 * can draw inside itself, and inside is the only place a label is free: a label
 * column beside three wheels this small is another 9px of picture per row, for
 * the same number of characters. The full word is on `ariaLabel`, which is the
 * accessible NAME and is never abbreviated, and again as a `title` on the
 * wrapper so a pointer can ask what "P" means. The wrapper exists only for that
 * title: `JogWheel` renders no `...rest`, so there is nowhere else to put it.
 *
 * The STANDING wheel carries no caret label, and that survives the wheel being
 * its flat partner turned rather than a thin strip, because a quarter turn is
 * the one thing the kit's `orientation` prop does NOT do to the caret label: it
 * turns the drag axis, the tape, the caret bar and `aria-orientation`, and
 * leaves the label an upright `<span>` centred in the box. So the room a label
 * has is the box's WIDTH either way, and standing, that width is
 * `WHEEL_SHORT_PX`: 18px of content inside the kit's border and compact inset,
 * against the 40px `P−10°` measures in the kit's `--font-size-sm` mono. Both
 * numbers are measured off the rendered control, and the kit's root is
 * `overflow: hidden`, so a label that does not fit is not one that shrinks, it
 * is one sliced through the middle.
 *
 * Nor can the axis be named there instead of measured. `JogWheel` writes
 * `aria-valuetext` FROM whatever `format` returns, so a wheel drawing a bare
 * "P" would announce "P" to a screen reader in place of its angle. An empty
 * format writes an empty valuetext, which falls back to `aria-valuenow`, so the
 * angle is read correctly by the one audience that cannot see the tape move.
 * The standing axis is named on `ariaLabel` and in the wrapper's `title`, and
 * its angle is drawn — as a position rather than as digits — by the framing
 * preview at the foot of the same picture. Naming it on its face as well needs
 * a `JogWheel` that separates its caret label from its value text.
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
    <CommitScope>
      <CommandGroup
        value={value}
        onChange={onChange}
        onCommit={onCommit}
        gated={gated}
        gatedReason={gatedReason}
        commitLabel={commitLabel}
        /* Beside the wheels, not under them. Under, the commit cost a whole
           line: a 52px block of wheels drew an 88px cluster, nearly half the
           height of the 194px picture the default tile produces. Beside, it
           costs its width instead, on the axis the corner has more of. */
        orientation="row"
        /* One block, always. The children here are a single laid-out div, so a
           wrap would only ever break the pitch wheel off under the pair and
           make the cluster taller than the picture can spare. */
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
          {/* The flat wheel's own box, turned: its width is their height and
              its height is their width, so the three are one control drawn
              twice rather than two bars and a strip.

              The kit's `orientation` prop is the whole of the turn, and a CSS
              `rotate(90deg)` over a horizontal wheel is NOT an alternative to
              it. `JogWheel` picks its drag axis by reading `e.clientX` or
              `e.clientY`, which are VIEWPORT coordinates and do not rotate with
              the element: a transformed wheel draws a tape running up the
              screen and moves it when the operator drags ACROSS the screen.
              The transform turns the picture and leaves the control where it
              was. */}
          <AxisWheel
            glyph="P"
            name="Pitch"
            labelled={false}
            orientation="vertical"
            width={WHEEL_SHORT_PX}
            height={WHEEL_LONG_PX}
            value={value.pitch}
            min={bounds.pitchMin}
            max={bounds.pitchMax}
            step={step}
            onChange={(pitch) => onChange({ ...value, pitch })}
          />
        </div>
      </CommandGroup>
    </CommitScope>
  );
}

/**
 * The stacked pair and the standing wheel, side by side and centred on each
 * other. Centred rather than top-aligned because the two columns are now sized
 * by different rules and land 2px apart; the standing wheel reads as the pair's
 * partner when it is centred on them and as a dropped one when it is not.
 */
const AXES_STYLE: CSSProperties = {
  display: "flex",
  alignItems: "center",
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

/**
 * What makes the commit read as part of this cluster rather than as a form
 * button dropped on a video.
 *
 * `CommandGroup` renders its own commit and offers a caller three things about
 * it: `commitLabel` (a string), `orientation`, and `gated`. None of them is
 * appearance, and a bespoke button beside the group would be a second
 * implementation of select-then-commit. So the lever is the scope the kit's
 * button is drawn in, in two parts.
 *
 * <p><b>Two spacing tokens, which inside this subtree only the commit reads.</b>
 * `--space-8` is `CommandGroup`'s gap between its inputs and its commit (its
 * inputs gap too, but there is one input here) and `--space-12` is the button's
 * side padding. At the kit's own values the commit sat 8px from the wheels in a
 * cluster whose own rhythm is 4, so it read as a slab set down beside the
 * control rather than as the last element of it; at 4 the cluster keeps one
 * rhythm throughout.</p>
 *
 * <p><b>One rule reaching the button itself, for the type.</b> This widget's
 * chrome is tracked-out uppercase mono throughout ("STARBOARD CAM", "1.4 S",
 * "Y18°") and the commit was the one element in it set in title-case Arial: the
 * loudest thing in the cluster while being the least of it. That is not a
 * choice the kit made, it is the UA stylesheet: a `<button>` gets its own
 * `font`, and resets `text-transform` and `letter-spacing` to `initial`, so
 * none of the three inherits from an ancestor. Every other button in the kit
 * answers that with `font-family: inherit`; `CommandGroup`'s is the one that
 * does not, so it renders in Arial under every theme. Setting the three here is
 * a stand-in for that one missing line, and it goes when the kit grows it.</p>
 *
 * <p>The label stays "Commit" rather than "COMMIT": `text-transform` changes
 * what is drawn and not the accessible name, and a screen reader handed an
 * all-caps name may spell it out.</p>
 *
 * <p>`& button` rather than a child selector because the group's own root sits
 * between: the subtree holds exactly one button, which is the commit.</p>
 */
const CommitScope = styled.div`
  display: flex;
  --space-8: 4px;
  --space-12: 8px;

  & button {
    font-family: var(--font-family-mono, ui-monospace, monospace);
    text-transform: uppercase;
    letter-spacing: 0.08em;
  }
`;
