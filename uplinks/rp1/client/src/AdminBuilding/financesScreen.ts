/**
 * RP-1's Finances screen in the Administration Building.
 *
 * <para>It names no departments, so the host lists no strategies on it and the
 * screen is chrome for the Finances augment that draws its body. Contributed
 * alongside Programs by the same registration in `programsScreen.ts`.</para>
 */
export const FINANCES_SCREEN_ID = "finances";

export const FINANCES_SCREEN = Object.freeze([
  Object.freeze({
    id: FINANCES_SCREEN_ID,
    label: "Finances",
    /* After Programs and the leader departments RP-1 declares. */
    order: 90,
  }),
]);
