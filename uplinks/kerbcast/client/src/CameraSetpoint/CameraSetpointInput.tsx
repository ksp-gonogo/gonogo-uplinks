/**
 * CameraSetpointInput: the grouped yaw/pitch/fov vector input for delayed
 * camera control. Three horizontal `JogWheel` scrubbers (Yaw, Pitch and FOV,
 * one row) inside the existing `CommandGroup`
 * commit container, so the whole vector dispatches as ONE delayed command on
 * an explicit commit (never on a child's own change). Vanilla-safe: props only,
 * no gonogo data hooks. The `gated`/`gatedReason`/`commitLabel` pass straight
 * through to `CommandGroup`, whose own gating disables the commit under
 * `no-path`, so this component does not re-implement it.
 */

import { value } from "@ksp-gonogo/sitrep-sdk";
import { CommandGroup, JogWheel, writeQuantity } from "@ksp-gonogo/ui-kit";

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
 * The tape's own box, CSS px, against the kit's 120x40 default.
 *
 * Measured off the thing it sits beside rather than chosen: the kerbcast SDK
 * draws its own pan pad 52x52 in the corner of the same picture, so three tapes
 * and a commit reading as corner chrome is three tapes and a commit at roughly
 * that scale. The height is what matters most and is a hair above the kit's
 * `JOG_WHEEL_MIN_TARGET_PX` floor, because it comes out of the shot.
 */
const WHEEL_WIDTH_PX = 64;
const WHEEL_HEIGHT_PX = 26;

/**
 * What this control measures in one row, CSS px, for a caller deciding what else
 * the same corner can hold.
 *
 * Composed from its parts rather than written down, so it cannot go stale behind
 * a change to the tape size: three tapes, `CommandGroup`'s own 8px gap between
 * its inputs and again before the commit, and the commit button, which is 67px
 * for the word "Commit" at the kit's `--font-size-xs`. That comes to 287, which
 * is what the render harness measures the row at.
 */
export const SETPOINT_INPUT_WIDTH_PX = 3 * WHEEL_WIDTH_PX + 3 * 8 + 67;

const formatDegrees = (v: number): string =>
  writeQuantity(value("°", v), { decimals: 0 });

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
      /* Beside the tapes, not under them: the column form spends about 30px of
         height on the commit, and this group is drawn in the corner of a
         picture rather than in a panel body that has height to spend. */
      orientation="row"
      /* One row, always. Wrapping three tapes onto three lines is what made an
         earlier version ~170px tall inside a 157px tile, and the workaround for
         it (an inner `width: max-content` track) turned the cluster into a
         sideways-scrolling strip with the FOV tape off the edge of the shot. */
      wrap={false}
    >
      <JogWheel
        ariaLabel="Yaw"
        orientation="horizontal"
        width={WHEEL_WIDTH_PX}
        height={WHEEL_HEIGHT_PX}
        value={value.yaw}
        min={bounds.yawMin}
        max={bounds.yawMax}
        step={step}
        format={formatDegrees}
        onChange={(yaw) => onChange({ ...value, yaw })}
      />
      <JogWheel
        ariaLabel="Pitch"
        orientation="horizontal"
        width={WHEEL_WIDTH_PX}
        height={WHEEL_HEIGHT_PX}
        value={value.pitch}
        min={bounds.pitchMin}
        max={bounds.pitchMax}
        step={step}
        format={formatDegrees}
        onChange={(pitch) => onChange({ ...value, pitch })}
      />
      {/* Horizontal like the pan pair, though a zoom reads naturally as a
          vertical slider. A vertical JogWheel's default box is the horizontal
          one's turned on its side, so a single vertical wheel would set the
          height of the whole row, and this row is chrome in the corner of a
          camera picture: its height is the one dimension coming straight out of
          the shot. */}
      <JogWheel
        ariaLabel="Field of view"
        orientation="horizontal"
        width={WHEEL_WIDTH_PX}
        height={WHEEL_HEIGHT_PX}
        value={value.fov}
        min={bounds.fovMin}
        max={bounds.fovMax}
        step={step}
        format={formatDegrees}
        onChange={(fov) => onChange({ ...value, fov })}
      />
    </CommandGroup>
  );
}
