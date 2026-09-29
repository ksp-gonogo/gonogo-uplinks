/**
 * RP-1's Leaders screen in the Administration Building.
 *
 * <para>It claims the seven departments RP-1's `Departments.cfg` hires leaders
 * into, so the host lists their cards here rather than on its trailing "Other"
 * screen. It draws those cards without verbs: the Leader Detail augment carries
 * Appoint and Dismiss with what each costs beside it, and core's own activate
 * cannot run with RP-1's building shut. Contributed alongside Programs by the
 * same registration in `programsScreen.ts`.</para>
 */
export const LEADERS_SCREEN_ID = "leaders";

export const LEADERS_SCREEN = Object.freeze([
  Object.freeze({
    id: LEADERS_SCREEN_ID,
    label: "Leaders",
    /* After Programs, as RP-1's own building tabs them. */
    order: 20,
    departments: Object.freeze([
      "Administration",
      "Engineering",
      "FlightDirector",
      "Science",
      "MainContractor",
      "Contractor1",
      "Contractor2",
    ]),
    drawsOwnActions: true,
  }),
]);
