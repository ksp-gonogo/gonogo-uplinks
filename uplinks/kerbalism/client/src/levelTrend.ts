import type { RowCrossing } from "./ecosystem.js";

/**
 * How far back, in game seconds, the observed levels are fitted. Two minutes
 * is long enough that a handful of one-second samples of a level jittering by
 * a few hundredths average out, and short enough that a change of load shows
 * within the same minute or two an operator is watching for it. At high time
 * warp one observation spans more than this, which leaves too few samples and
 * the trend reads as unknown.
 */
export const TREND_WINDOW_SECONDS = 120;

/** Fewest samples a fit is drawn from; fewer and the trend is unknown. */
export const TREND_MIN_SAMPLES = 4;

/** Shortest stretch of game time the samples must cover for a fit. */
export const TREND_MIN_SPAN_SECONDS = 30;

/** A change smaller than this share of capacity over the window is not a trend. */
const MIN_CHANGE_OF_CAPACITY = 0.001;

/** A change must also exceed this many standard deviations of the fit's residual. */
const NOISE_SIGMAS = 3;

interface Sample {
  readonly ut: number;
  readonly amount: number;
}

/**
 * What the observed levels say about one resource over the window.
 *
 * `unknown` is too little history to say anything, which is not `steady`:
 * a steady level was watched and did not move.
 */
export type LevelTrend =
  | { readonly kind: "unknown" }
  | { readonly kind: "steady"; readonly spanSeconds: number }
  | {
      readonly kind: "falling" | "rising";
      readonly perSecond: number;
      readonly spanSeconds: number;
    };

/** Whether a change of `change` over a fit with this residual is more than noise. */
function significant(change: number, capacity: number, sigma: number): boolean {
  return (
    Math.abs(change) > NOISE_SIGMAS * sigma &&
    Math.abs(change) > MIN_CHANGE_OF_CAPACITY * capacity
  );
}

/**
 * The recent observed levels of every resource, one sample per observation,
 * and the straight-line trend through them.
 *
 * The slope is an ordinary least-squares fit over {@link TREND_WINDOW_SECONDS},
 * so one noisy sample moves it by a fraction of its size instead of reversing
 * it the way a difference of two neighbouring samples would.
 */
export class LevelHistory {
  private readonly byName = new Map<string, Sample[]>();
  private newestUt = Number.NEGATIVE_INFINITY;

  /**
   * Adds the levels observed at `ut`. Seeing the same observation again adds
   * nothing, and one from earlier than the newest (a recording scrubbed
   * backwards) starts the history over.
   */
  record(ut: number, amounts: Readonly<Record<string, number>>): void {
    if (!Number.isFinite(ut)) return;
    if (ut === this.newestUt) return;
    if (ut < this.newestUt) this.byName.clear();
    this.newestUt = ut;
    for (const [name, amount] of Object.entries(amounts)) {
      if (!Number.isFinite(amount)) continue;
      const samples = this.byName.get(name) ?? [];
      samples.push({ ut, amount });
      while (samples.length > 0 && samples[0].ut < ut - TREND_WINDOW_SECONDS) {
        samples.shift();
      }
      this.byName.set(name, samples);
    }
  }

  reset(): void {
    this.byName.clear();
    this.newestUt = Number.NEGATIVE_INFINITY;
  }

  trend(name: string, capacity: number): LevelTrend {
    const samples = this.byName.get(name) ?? [];
    const first = samples[0];
    const last = samples[samples.length - 1];
    if (
      samples.length < TREND_MIN_SAMPLES ||
      last.ut - first.ut < TREND_MIN_SPAN_SECONDS
    ) {
      return { kind: "unknown" };
    }
    const n = samples.length;
    const meanUt = samples.reduce((sum, s) => sum + s.ut, 0) / n;
    const meanAmount = samples.reduce((sum, s) => sum + s.amount, 0) / n;
    let covariance = 0;
    let variance = 0;
    for (const s of samples) {
      covariance += (s.ut - meanUt) * (s.amount - meanAmount);
      variance += (s.ut - meanUt) ** 2;
    }
    const perSecond = covariance / variance;
    const intercept = meanAmount - perSecond * meanUt;
    const residual = samples.reduce(
      (sum, s) => sum + (s.amount - (intercept + perSecond * s.ut)) ** 2,
      0,
    );
    const sigma = Math.sqrt(residual / Math.max(1, n - 2));
    const spanSeconds = last.ut - first.ut;
    if (!significant(perSecond * spanSeconds, capacity, sigma)) {
      return { kind: "steady", spanSeconds };
    }
    return {
      kind: perSecond < 0 ? "falling" : "rising",
      perSecond,
      spanSeconds,
    };
  }
}

/** One resource's level at the newest observation, for {@link reconcileCrossing}. */
export interface ObservedLevel {
  readonly current: number;
  readonly capacity: number;
  readonly ut: number;
}

/**
 * The crossing to show for a resource, once the model's crossing is checked
 * against what the levels actually did.
 *
 * - Too little history to say: the model's crossing stands
 * - Levels moving the same way the model says: the model's crossing stands,
 *   since it knows about processes that stop
 * - Levels moving the other way: the crossing is drawn from the observed rate,
 *   so a falling level reads "empty in" whatever sign the model's rate had
 * - Levels steady: none, unless the model's rate is too slow to have moved the
 *   level by a detectable amount in the window, in which case the observation
 *   cannot contradict it and it stands
 */
export function reconcileCrossing(
  crossing: RowCrossing | null,
  trend: LevelTrend,
  level: ObservedLevel,
): RowCrossing | null {
  if (trend.kind === "unknown") return crossing;
  if (trend.kind === "steady") {
    if (crossing === null) return null;
    const distance =
      crossing.boundary === "floor"
        ? level.current
        : level.capacity - level.current;
    const seconds = crossing.atUt - level.ut;
    if (seconds <= 0) return null;
    const expected = (distance / seconds) * trend.spanSeconds;
    return expected > MIN_CHANGE_OF_CAPACITY * level.capacity ? null : crossing;
  }
  const boundary = trend.kind === "falling" ? "floor" : "ceiling";
  if (crossing?.boundary === boundary) return crossing;
  const distance =
    boundary === "floor" ? level.current : level.capacity - level.current;
  return {
    boundary,
    atUt: level.ut + distance / Math.abs(trend.perSecond),
  };
}
