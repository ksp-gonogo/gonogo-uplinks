using System.Collections.Generic;
using System.Linq;

namespace GonogoPrinProbe
{
    /// <summary>One state of the game's flight-plan coast, about the parent, planetarium axes.</summary>
    public readonly struct PlanState
    {
        public PlanState(double ut, Triple q, Triple p)
        {
            Ut = ut;
            Q = q;
            P = p;
        }

        public double Ut { get; }
        public Triple Q { get; }
        public Triple P { get; }
    }

    /// <summary>
    /// The plan's states as a comparison reads them, from 2026101016-Lichnerowicz on, where
    /// Principia renders a plan's apsides rather than its whole coast: the plan's start
    /// first, since the comparison measures time from the first point, then every apsis
    /// after it, in time order.
    /// </summary>
    public static class ProbePlanPoints
    {
        public static List<PlanState> FromApsides(
            PlanState start, IEnumerable<PlanState> apoapsides, IEnumerable<PlanState> periapsides)
        {
            var points = new List<PlanState> { start };
            points.AddRange(apoapsides.Concat(periapsides).Where(a => a.Ut > start.Ut).OrderBy(a => a.Ut));
            return points;
        }
    }
}
