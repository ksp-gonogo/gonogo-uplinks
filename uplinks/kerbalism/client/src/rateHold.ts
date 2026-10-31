/**
 * A measured rate this small against the one held, and of the opposite sign,
 * is a stray sample. The recorded stray readings on electric charge are about
 * 0.5% of the real draw; a reversal worth believing (leaving a shadow) is a
 * large share of it, so 5% leaves an order of magnitude either way.
 */
export const GLITCH_RATIO = 0.05;

/**
 * How long a stray-looking sample is overruled, in game seconds. A rate that
 * really settled at the small opposite value keeps reading it, and is accepted
 * once it has outlasted this.
 */
export const GLITCH_HOLD_SECONDS = 30;

interface Held {
  rate: number;
  confirmedUt: number;
}

/**
 * Keeps each resource's last real measured rate, and answers with it in place
 * of a stray near-zero sample of the opposite sign.
 *
 * Kerbalism's measured net rate for electric charge reads a tiny value of the
 * wrong sign for a sample or two while the level keeps falling, which turns a
 * countdown to empty into one to full. The level trend corrects that once it
 * has half a minute of history; this covers the half minute before it, and any
 * moment the history starts over.
 *
 * A processor is handed the newest payloads only, so the held rates sit beside
 * it. Filtering one observation twice gives the same answer, and one from
 * earlier than the newest (a recording scrubbed backwards) starts over.
 */
export class RateHold {
  private readonly byName = new Map<string, Held>();
  private newestUt = Number.NEGATIVE_INFINITY;

  filter(
    ut: number,
    rates: Readonly<Record<string, number>>,
  ): Record<string, number> {
    if (!Number.isFinite(ut)) return { ...rates };
    if (ut < this.newestUt) this.byName.clear();
    this.newestUt = ut;
    const out: Record<string, number> = {};
    for (const [name, rate] of Object.entries(rates)) {
      const held = this.byName.get(name);
      const stray =
        held !== undefined &&
        rate !== 0 &&
        held.rate !== 0 &&
        Math.sign(rate) !== Math.sign(held.rate) &&
        Math.abs(rate) < GLITCH_RATIO * Math.abs(held.rate) &&
        ut - held.confirmedUt <= GLITCH_HOLD_SECONDS;
      if (stray) {
        out[name] = held.rate;
        continue;
      }
      this.byName.set(name, { rate, confirmedUt: ut });
      out[name] = rate;
    }
    return out;
  }

  reset(): void {
    this.byName.clear();
    this.newestUt = Number.NEGATIVE_INFINITY;
  }
}
