import { magnitudeOf, registerComponent, useTelemetry } from "@ksp-gonogo/sitrep-sdk";
import { Dial, EmptyState, Panel, Text, Unit } from "@ksp-gonogo/ui-kit";
import { EXAMPLE } from "../uplink.js";

/**
 * A second widget on the SAME Topic as Heartbeat, which is the first thing this
 * file is here to show: a Topic is not owned by a widget, and two widgets reading
 * one channel is the normal case rather than a special one. Nothing is duplicated
 * to make it work, and neither widget knows the other exists.
 *
 * ## The interesting decision: an unbounded value on a bounded instrument
 *
 * `ticks` counts up from load and never comes back. A dial has a `min` and a
 * `max`, so putting `ticks` on one directly means picking a maximum, and there is
 * no honest maximum to pick: whatever number is chosen, the needle pins there and
 * stays, and a pinned needle reads as "at the limit" when the truth is "past a
 * number somebody guessed".
 *
 * So the needle shows POSITION IN A CYCLE and the centre shows the real total.
 * `wrap` makes the dial treat the value modulo its range, so the needle sweeps
 * once per sixty publishes and starts again, which is a cadence an operator can
 * see at a glance. `valueLabel` overrides the centre text with the actual count,
 * because the number a reader takes away has to be the true one.
 *
 * That pairing is the point worth copying: an instrument is a claim about a
 * quantity, and a widget's job is to pick a presentation whose claim is true.
 * `Dial` is happy to draw a lie if you hand it one.
 *
 * ## `magnitudeOf`, and why the raw number is only for arithmetic
 *
 * Values arrive WRAPPED, carrying the unit the C# contract declared.
 * `<Unit>` renders one and is the only thing that should; `magnitudeOf` unwraps
 * one when a number is genuinely needed, which here is the modulus the dial
 * sweeps on. Unwrapping to render is how a unit change in the contract stops
 * reaching the screen, so the unwrap here feeds geometry and the readout below
 * still goes through `<Unit>`.
 */
function PulseDialWidget() {
  const heartbeat = useTelemetry("example.heartbeat");

  if (heartbeat.state !== "observed") {
    return (
      <Panel>
        <Panel.Title>Pulse</Panel.Title>
        <EmptyState>Waiting for the example Uplink</EmptyState>
      </Panel>
    );
  }

  const ticks = magnitudeOf(heartbeat.value.ticks) ?? 0;

  return (
    <Panel>
      <Panel.Title>Pulse</Panel.Title>
      <Dial
        value={ticks}
        min={0}
        max={SWEEP_TICKS}
        wrap
        valueLabel={String(ticks)}
        ticks={DIAL_TICKS}
        ariaLabel={`${ticks} publishes since load`}
      />
      <Text>
        UT <Unit value={heartbeat.value.ut} />
      </Text>
    </Panel>
  );
}

/**
 * One sweep per sixty publishes. An arbitrary number, and it is allowed to be
 * arbitrary BECAUSE the needle is not claiming a magnitude: it says where in the
 * cycle the last publish fell, and the centre readout carries the quantity.
 */
const SWEEP_TICKS = 60;

/** Quarters, so the sweep direction is readable without labelling every step. */
const DIAL_TICKS = [
  { value: 0, label: "0" },
  { value: 15 },
  { value: 30, label: "30" },
  { value: 45 },
];

registerComponent({
  id: "example-pulse-dial",
  name: "Pulse",
  description:
    "The example Uplink's publish cadence on a dial: the needle sweeps once " +
    "per sixty publishes and the centre carries the true total.",
  tags: ["example"],
  defaultSize: { w: 4, h: 4 },
  minSize: { w: 3, h: 3 },
  component: PulseDialWidget,
  dataRequirements: ["example.heartbeat"],
  defaultConfig: {},
  actions: [],
  owner: EXAMPLE,
});

export { PulseDialWidget };
