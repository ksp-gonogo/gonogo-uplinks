import type { SlotProps } from "@ksp-gonogo/sitrep-sdk";
import { registerAugment, useTelemetry } from "@ksp-gonogo/sitrep-sdk";
import { Badge, Cluster, Stack, Text, Unit } from "@ksp-gonogo/ui-kit";
import { EXAMPLE } from "../uplink.js";

/**
 * An AUGMENT: a piece of this Uplink rendered inside a widget somebody else owns.
 *
 * This is the mechanism to reach for whenever the thing you want to show belongs
 * beside data another widget already draws. Writing a whole widget instead gives
 * the operator two tiles to place and to read together, and the Uplink still has
 * no way to say "this belongs next to that".
 *
 * ## Three things make an augment, and only one of them is code
 *
 *   `augments`   the slot id. A widget declares its slots in `augmentSlots`, and
 *                the published `SlotRegistry` is the list of every slot the app's
 *                own widgets expose. It is a typed key, not a string: a
 *                misspelling is a compile error rather than an augment that
 *                silently never mounts.
 *   `requires`   the presence gate, and the reason an augment is safe to ship
 *                unconditionally. `AugmentSlot` mounts this only while
 *                `example.available` is live, so an install without this Uplink's
 *                mod half renders the host widget exactly as it was: no empty
 *                section, no "not installed" row, nothing.
 *   `channels`   what to subscribe to. Same role `dataRequirements` plays for a
 *                widget.
 *
 * ## Why the props are empty, and why that is worth knowing
 *
 * `SlotProps<"space-center-status.sections">` resolves to `Record<string, never>`:
 * a body slot passes nothing, because an augment in one renders from its OWN
 * Topics and the host has nothing it needs to hand over. Other slots do pass
 * context, an overlay gets its host's projection so it can draw in the same
 * coordinate space, and the type tells you which kind you are in. Writing the
 * props type out rather than omitting it is what makes that visible at the top of
 * the file.
 *
 * The one thing an augment must not do is read the host's state by any route
 * other than its props. There is no such route, and that is deliberate.
 */
function CadenceSection(_props: SlotProps<"space-center-status.sections">) {
  const heartbeat = useTelemetry("example.heartbeat");

  /*
   * An augment renders NOTHING when it has nothing, rather than a placeholder.
   * A widget owns its whole tile and can afford to say "waiting"; an augment is a
   * guest inside somebody else's layout, and a permanent "waiting for the example
   * Uplink" row inside the space centre panel is a line the operator learns to
   * read past, on every install, forever.
   */
  if (heartbeat.state !== "observed") return null;

  return (
    <Stack gap="xs">
      <Cluster gap="sm">
        <Badge severity="info">example</Badge>
        <Text>
          publishing, last at UT <Unit value={heartbeat.value.ut} />
        </Text>
      </Cluster>
      <Text>
        <Unit value={heartbeat.value.ticks} /> since load
      </Text>
    </Stack>
  );
}

registerAugment({
  id: "example-cadence-section",
  augments: "space-center-status.sections",
  requires: "example",
  channels: ["example.heartbeat"],
  component: CadenceSection,
  owner: EXAMPLE,
});

export { CadenceSection };
