import { RP1 } from "../uplink.js";
import { FINANCES_SCREEN } from "./financesScreen.js";

/**
 * RP-1's Programs screen in the Administration Building.
 *
 * <para>RP-1 reorganises the building. `RemoveStockStrategies.cfg` deletes every
 * strategy without `RP0conf`, and `Departments.cfg` replaces the departments
 * wholesale: `Programs` first, then the seven a Leader is hired into. So the
 * building an RP-1 operator opens has screens, and a stock one does not, which
 * is why the host widget asks rather than assumes.</para>
 *
 * <para>The screen is contributed whenever RP-1 is running, NOT when the career
 * happens to be carrying a Program. A career between Programs still has a
 * Programs screen, and drawing one only once something is in it would make an
 * empty screen and a missing one look identical.</para>
 */
/**
 * The screen's id, shared with the augment that draws its body: an augment is
 * bound to the SLOT rather than to one screen, so it is handed `screenId` and
 * decides. Exported so the two agree by construction.
 */
export const PROGRAMS_SCREEN_ID = "programs";

export const PROGRAMS_SCREEN = Object.freeze([
  Object.freeze({
    id: PROGRAMS_SCREEN_ID,
    /*
     * "Programs", not the department's own `title` of "Select Programs". The
     * title is the instruction printed over KSP's own department panel; a tab is
     * a place, and a place is a noun.
     */
    label: "Programs",
    /* First, as it is in Departments.cfg, and as the building opens on it. */
    order: 10,
    departments: ["Programs"],
    /* The screen's body carries Accept, so the host draws no Activate of its own. */
    drawsOwnActions: true,
  }),
]);

/** Every screen RP-1 adds to the building, in one entry list. */
export const RP1_ADMIN_SCREENS = Object.freeze([
  ...PROGRAMS_SCREEN,
  ...FINANCES_SCREEN,
]);

RP1.registerContribution({
  id: "programs-screen",
  contributes: "strategies.screens",
  /*
   * The domain gate rather than a dep on the topic: the aggregation subscribes
   * `rp1.available` itself for anything naming `requires`, so the screen appears
   * and disappears with RP-1 while the contribution stays a constant. Returning
   * the same frozen array every call is what keeps it off the slot's recompute
   * budget: the aggregation compares entries by reference.
   */
  requires: "rp1",
  compute: () => RP1_ADMIN_SCREENS,
});
