import {
  registerComponent,
  useTelemetry,
} from "@ksp-gonogo/sitrep-sdk";
import {
  EmptyState,
  Panel,
  PanelTitle,
  Stack,
  Text,
  Unit,
} from "@ksp-gonogo/ui-kit";
import { EXAMPLE } from "../uplink.js";

/**
 * The whole widget: read one Topic, render its two fields.
 *
 * `useTelemetry` does NOT return `T | undefined`. It returns a `Reading<T>`, a
 * discriminated union over `state`, and that is the single most important thing
 * to understand about reading telemetry here. The states are distinct facts and
 * the type will not let them be conflated:
 *
 *   pending      nothing has arrived yet
 *   unowned      no Uplink claims this Topic, so nothing ever will
 *   absent       the Uplink answered and there is nothing to report
 *   observed     a real measurement, at a real UT
 *   stale        the last real observation, and how old it is
 *   reckonable   as stale, plus a forward-modelled value for this frame
 *
 * Collapsing those into "a value or undefined" is how a widget ends up rendering
 * a zero for "not connected", and a substituted zero reads exactly like a
 * measurement. Handle `observed` and treat everything else as "nothing to show
 * yet" until the widget has a reason to distinguish further.
 *
 * Values arrive WRAPPED, carrying the unit the C# contract declared, which is why
 * `<Unit>` renders them without this file knowing that `ut` means universal time.
 * Never format a unit by hand: `<Unit>` is the only unit renderer, and it is what
 * makes a unit change in the contract reach the screen.
 */
function HeartbeatWidget() {
  const heartbeat = useTelemetry("example.heartbeat");

  if (heartbeat.state !== "observed") {
    return (
      <Panel>
        <PanelTitle>Heartbeat</PanelTitle>
        <EmptyState>Waiting for the example Uplink</EmptyState>
      </Panel>
    );
  }

  return (
    <Panel>
      <PanelTitle>Heartbeat</PanelTitle>
      <Stack>
        <Text>
          Ticks <Unit value={heartbeat.value.ticks} />
        </Text>
        <Text>
          UT <Unit value={heartbeat.value.ut} />
        </Text>
      </Stack>
    </Panel>
  );
}

registerComponent({
  id: "example-heartbeat",
  name: "Heartbeat",
  description:
    "The example Uplink's one channel: how many times it has published, and " +
    "the universal time of the last sample.",
  tags: ["example"],
  defaultSize: { w: 3, h: 3 },
  minSize: { w: 2, h: 2 },
  component: HeartbeatWidget,
  // Declared so the orchestrator knows what to subscribe to. A read this omits
  // still works whenever the app happens to carry the Topic by default, which is
  // how a widget ends up permanently empty on a machine where it does not.
  dataRequirements: ["example.heartbeat"],
  defaultConfig: {},
  actions: [],
  // The identity from uplink.ts. This is what makes the widget picker tag the
  // widget with its Uplink without a per-widget field to forget.
  owner: EXAMPLE,
});

export { HeartbeatWidget };
