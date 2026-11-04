/** RP-1's year for a leader's dismissal window: Julian, as its own budget figures are. */
const YEAR_SECONDS = 31_557_600;

/** The share of reputation a dismissal takes while the leader's least duration still holds. */
const FLAT_SHARE = 0.2;

/** How far ahead to sample the cost, in years. Only samples before the cost reaches zero are shown. */
const SAMPLE_YEARS = [1, 2, 5] as const;

/** The three instants that fix a serving leader's dismissal cost, as the contract carries them. */
export interface DismissalWindow {
  readonly activatedUt: number;
  readonly canRemoveFromUt: number;
  readonly freeToRemoveFromUt: number;
}

/**
 * The share of current reputation a dismissal takes at `ut`, by RP-1's own
 * `StrategyRP0.DeactivateCost`: 20% until the least duration, then a falling
 * curve, then nothing from the instant dismissal is free. The curve's argument
 * is the elapsed time over the removal penalty less the least duration, as RP-1
 * writes it, and not over the time since the least duration ended.
 */
export function dismissalShare(window: DismissalWindow, ut: number): number {
  const elapsed = ut - window.activatedUt;
  const penalty = window.freeToRemoveFromUt - window.activatedUt;
  const least = Math.max(window.canRemoveFromUt - window.activatedUt, 0);
  if (elapsed >= penalty) {
    return 0;
  }
  if (elapsed <= least || penalty <= least) {
    return FLAT_SHARE;
  }
  const u = elapsed / (penalty - least);
  return Math.max(FLAT_SHARE * (0.1 / (u * 0.5 + 0.1) - 0.15 * u), 0);
}

/** One future date and what dismissing then would cost at the reputation held now. */
export interface DismissalSample {
  readonly years: number;
  readonly reputation: number;
}

/**
 * The cost at a few dates ahead, at today's reputation, for the dates that fall
 * before dismissal is free. Reputation moves, so each figure is the share RP-1
 * would take of what the career holds now.
 */
export function dismissalSamples(
  window: DismissalWindow,
  nowUt: number,
  reputation: number,
): readonly DismissalSample[] {
  const remaining = window.freeToRemoveFromUt - nowUt;
  return SAMPLE_YEARS.filter((years) => years * YEAR_SECONDS < remaining).map(
    (years) => ({
      years,
      reputation:
        reputation * dismissalShare(window, nowUt + years * YEAR_SECONDS),
    }),
  );
}
