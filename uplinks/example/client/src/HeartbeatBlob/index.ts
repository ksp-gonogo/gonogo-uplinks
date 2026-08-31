import type {
  ContributionEntry,
  ContributionTopics,
} from "@ksp-gonogo/sitrep-sdk";
import { magnitudeOf } from "@ksp-gonogo/sitrep-sdk";
import type { ExampleHeartbeat } from "../topics.js";
import { EXAMPLE } from "../uplink.js";

/**
 * The entry shape this slot takes.
 *
 * Named through the generic rather than directly, and that is not a style
 * choice: the concrete interface (`SystemEntity`) is declared inside the sdk's
 * `api/contribution-slots` module, which the barrel imports for its declaration
 * merge and does not re-export, so `import type { SystemEntity }` does not
 * resolve. `ContributionEntry<S>` is exported and resolves to the same type, so
 * it is the route an author outside the repo has. Worth an alias here because
 * without one the return type has to be spelled at every use.
 */
type SystemViewEntity = ContributionEntry<"system-view.entities">;

/**
 * A CONTRIBUTION: data this Uplink hands to another widget's renderer, with no
 * component of its own.
 *
 * The distinction from an augment is worth getting straight, because they look
 * similar in a registration and are not alike at all:
 *
 *   an AUGMENT contributes a COMPONENT. It renders itself, inside a slot, and
 *   owns what it looks like.
 *
 *   a CONTRIBUTION contributes DATA. The host draws it, in the host's own visual
 *   language, so many contributors land in one coherent picture instead of each
 *   drawing its own idea of a marker.
 *
 * Reach for a contribution whenever the host is already drawing a KIND of thing
 * and you have another one of them. Here that is a system-view entity: the view
 * knows how to place something in a body's orbit frame, project it, and draw it
 * at the reader's zoom, and none of that is knowledge this Uplink should acquire.
 *
 * ## `compute` is pure, and that is a hard requirement
 *
 * It takes the current value of every declared dep and returns entries. No hooks,
 * no fetches, no state: it is called during the host's render and re-run when its
 * inputs change, so a side effect here runs at a cadence nobody chose. Anything
 * that needs a hook belongs in an augment.
 *
 * Returning `null` and returning `[]` mean the same thing, and both mean "nothing
 * to draw". Say it by returning nothing rather than by contributing an entry with
 * a neutral style: an entry is a mark on the screen, and a mark that means
 * "nothing" is still a mark the reader has to dismiss.
 */
EXAMPLE.registerContribution({
  id: "heartbeat-blob",
  contributes: "system-view.entities",
  requires: "example",
  /*
   * TWO deps, and they are not the same kind of dep, which is the one rough edge
   * in this file worth reading before you copy it.
   *
   * `system.bodies` is one of the topics the SLOT declares, so `topics` types it
   * precisely: the mapped half of `ContributionTopics` covers exactly the union
   * the slot owner enumerated.
   *
   * `example.heartbeat` is THIS Uplink's own topic, which the slot's author had
   * never heard of and could not have enumerated. It still arrives, through the
   * `& Record<string, unknown>` tail on `ContributionTopics`, but typed
   * `unknown`, so reading it needs the cast below. That cast is load-bearing and
   * it is the only unchecked step in this file: nothing verifies that the shape
   * asserted here is the shape the Topic carries.
   *
   * Worth knowing rather than working around. The alternative, not declaring the
   * dep and reading the Topic through a hook, is not available: `compute` is not
   * a component and cannot hold one.
   */
  deps: ["system.bodies", "example.heartbeat"],
  compute: computeHeartbeatBlob,
  /*
   * No `owner` here, unlike the widget and the augment: registering THROUGH the
   * handle stamps it, and the type omits the field so it cannot be passed twice
   * or passed differently. The registration route is the difference, and it also
   * namespaces the id, so this contribution is `example:heartbeat-blob` in the
   * registry without this file spelling the prefix.
   */
});

/**
 * Exported because it is PURE, which makes it the cheapest thing in this package
 * to test: hand it a topics bag, assert the entries. No render, no host, no
 * registry. A contribution whose compute is inlined into the registration can
 * only be tested by standing up the widget that draws it, which tests the drawing
 * as much as the arithmetic.
 */
export function computeHeartbeatBlob(
  topics: ContributionTopics<"system-view.entities">,
): readonly SystemViewEntity[] | null {
  const home = topics["system.bodies"]?.bodies?.[0]?.name;
  if (!home) return null;

  const heartbeat = topics["example.heartbeat"] as ExampleHeartbeat | undefined;
  const ticks = magnitudeOf(heartbeat?.ticks);
  if (ticks == null) return null;

  return [
    {
      id: "example-heartbeat",
      position: {
        kind: "fixed",
        parentName: home,
        xMetres: PARK_RADIUS_M,
        yMetres: 0,
        zMetres: 0,
      },
      /*
       * The radius breathes with the publish cadence, over a range chosen so the
       * blob stays legible against a body rather than swallowing it. Same honesty
       * rule the Pulse dial follows: the size is a cadence, not a measurement of
       * anything, so nothing here invites reading a distance off it.
       */
      shape: {
        kind: "blob",
        radiusMetres:
          MIN_BLOB_M +
          (ticks % SWEEP_TICKS) * ((MAX_BLOB_M - MIN_BLOB_M) / SWEEP_TICKS),
      },
      style: { emphasis: "bright", severity: "info" },
      meta: { source: "example Uplink", ticks },
    },
  ];
}

/** Parked a little clear of the home body so the blob reads as its own mark. */
const PARK_RADIUS_M = 2_000_000;
const MIN_BLOB_M = 150_000;
const MAX_BLOB_M = 600_000;
/** The same sixty-publish cycle the Pulse dial sweeps on, so the two agree. */
const SWEEP_TICKS = 60;
