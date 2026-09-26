import {
  magnitudeOf,
  registerComponent,
  useTelemetry,
  value,
} from "@ksp-gonogo/sitrep-sdk";
import {
  Dial,
  EmptyState,
  Panel,
  Section,
  Text,
  Unit,
} from "@ksp-gonogo/ui-kit";
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
 * `<Unit>` renders one and `<Dial>` takes one, bounds and ticks included, so the
 * count reaches the needle still carrying its unit. `magnitudeOf` unwraps one
 * when a number is genuinely needed, which here is the centre label and the
 * accessible name. Unwrapping to render is how a unit change in the contract
 * stops reaching the screen, so the UT readout below still goes through `<Unit>`.
 *
 * ## Hand over the reading, not the value inside it
 *
 * Each field of a Topic's reading is itself a reading, carrying the Topic's
 * currency, and `<Dial>` and `<Unit>` both take one whole. Once the heartbeat stops
 * arriving, the last count stays on the dial and the dial marks it as no longer
 * current, which is the instrument's decision rather than this widget's: there
 * is no branch here on how current the reading is.
 */
function PulseDialWidget() {
  const heartbeat = useTelemetry("example.heartbeat");
  const { ticks, ut } = heartbeat;

  if (!("value" in heartbeat)) {
    return (
      <Panel
        panelTitle="Pulse"
        sections={
          <Section>
            <EmptyState>Waiting for the example Uplink</EmptyState>
          </Section>
        }
      />
    );
  }

  // A payload is not the same as a complete one. Every field on a Topic is
  // independently optional, so a payload can arrive without the one this
  // instrument is about. Coalesced to 0 the dial drew a needle at the minimum
  // and the centre read "0", which is the picture of an Uplink that has
  // published nothing, not the picture of a count nobody sent. Same reason the
  // pending state above draws no dial, one step further in.
  const count = "value" in ticks ? magnitudeOf(ticks.value) : null;
  if (count == null) {
    return (
      <Panel
        panelTitle="Pulse"
        sections={
          <Section>
            <EmptyState>The heartbeat carried no tick count</EmptyState>
          </Section>
        }
      />
    );
  }

  return (
    <Panel
      panelTitle="Pulse"
      sections={
        <Section>
          <Dial
            value={ticks}
            min={SWEEP_START}
            max={SWEEP_END}
            wrap
            valueLabel={String(count)}
            ticks={DIAL_TICKS}
            ariaLabel={`${count} publishes since load`}
          />
          <Text>
            UT <Unit value={ut} />
          </Text>
        </Section>
      }
    />
  );
}

/**
 * One sweep per sixty publishes. An arbitrary number, and it is allowed to be
 * arbitrary BECAUSE the needle is not claiming a magnitude: it says where in the
 * cycle the last publish fell, and the centre readout carries the quantity.
 */
const SWEEP_START = value("count", 0);
const SWEEP_END = value("count", 60);

/** Quarters, so the sweep direction is readable without labelling every step. */
const DIAL_TICKS = [
  { value: value("count", 0), label: "0" },
  { value: value("count", 15) },
  { value: value("count", 30), label: "30" },
  { value: value("count", 45) },
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
