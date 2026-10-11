// What the career's funds do to a construction's rate.
//
// RP-1's ConstructionProject.AddProgress bills a construction as it advances and,
// when the career cannot meet the bill, scales the progress it makes by
// CurrencyUtils.GetAffordableFundsFraction: funds over the amount asked, below 0
// answering 0 and above 1 answering 1. A shortfall slows a construction and funds
// of nothing stop it; it is never refused.
//
// The amount asked in a tick is the draw for that tick's length, which this side
// cannot know, so the fraction is taken against one day's draw at the throttle the
// construction is running at. That is exact where it matters, funds at or below
// zero against any draw, and is the sustained slowdown a balance that is not being
// topped up imposes everywhere else.
//
// PURE. The draw per day comes from the rate tables RP-1's upkeep cadence already
// prices, the balance from KSP's Funding, and nothing here calls RP-1.
using System;
using System.Collections.Generic;

namespace GonogoRp1Uplink
{
    public static class Rp1ConstructionAffordability
    {
        /// <summary>
        /// Two throttles are the same step when they differ by less than this: the
        /// slider moves in twentieths, and the stored value is a double that went
        /// through a save.
        /// </summary>
        private const double SameStep = 1e-6;

        /// <summary>
        /// Folds the funds limit into every costed construction's rate, finish
        /// time and stall flag. A construction whose draw or the balance cannot be
        /// read keeps RP-1's costed rate and carries no fraction, since a limit
        /// nobody measured is not one that does not apply.
        /// </summary>
        public static void Apply(
            IReadOnlyList<Rp1ConstructionRaw>? constructions,
            Rp1ConstructionRatesRaw? rates,
            double? funds)
        {
            if (constructions == null || rates?.Constructions == null || funds == null)
            {
                return;
            }

            foreach (var construction in constructions)
            {
                if (construction.Id == null || construction.Rate == null || construction.WorkRate == null)
                {
                    continue;
                }
                var draw = DrawPerDay(rates, construction.Id, construction.WorkRate.Value);
                if (draw == null)
                {
                    continue;
                }

                var fraction = Fraction(funds.Value, draw.Value);
                construction.AffordableFraction = fraction;
                construction.Rate = construction.Rate.Value * fraction;
                construction.Stalled = Rp1ScMath.IsStalled(construction.Rate);
                construction.TimeLeftSeconds = Rp1ScMath.BaseTimeLeft(
                    construction.Progress, construction.TotalPoints, construction.Rate);
            }
        }

        /// <summary>
        /// GetAffordableFundsFraction over a draw: 1 when nothing is asked,
        /// otherwise the balance over the draw bounded to 0 and 1.
        /// </summary>
        public static double Fraction(double funds, double draw)
        {
            if (draw <= 0.0)
            {
                return 1.0;
            }
            var share = funds / draw;
            return share < 0.0 ? 0.0 : share > 1.0 ? 1.0 : share;
        }

        private static double? DrawPerDay(Rp1ConstructionRatesRaw rates, string id, double workRate)
        {
            foreach (var table in rates.Constructions!)
            {
                if (table.Id != id)
                {
                    continue;
                }
                foreach (var step in table.Steps)
                {
                    if (Math.Abs(step.WorkRate - workRate) < SameStep)
                    {
                        return step.CostPerDay;
                    }
                }
            }
            return null;
        }
    }
}
