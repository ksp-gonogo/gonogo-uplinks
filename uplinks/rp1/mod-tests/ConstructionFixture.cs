using System;

// The construction rate members, in RP-1's own namespace with its own names, on
// the same terms as Rp0Fixture.cs: the walk resolves them exactly as it resolves
// the real thing, and nothing here claims anything about the values a running
// RP-1 would hold.
namespace RP0
{
    public sealed partial class SpaceCenterSettings
    {
        /// <summary>
        /// RP-1's rush cost curve, 1 at the full rate and 2 at 150% in the
        /// shipped config. A straight line between those two here: the walk
        /// hands the curve a rate and publishes what it answers, so the shape is
        /// the test's to choose.
        /// </summary>
        public ROUtils.HermiteCurve? ConstructionRushCost = new LinearRushCurve();
    }

    public static partial class Formula
    {
        /// <summary>Build points per second a new construction is costed at, whatever its place in the list.</summary>
        public static double ConstructionBuildRate = 0.01;

        /// <summary>The facility type the last rate query named, so a test can pin that the building reached it.</summary>
        public static SpaceCenterFacility? LastRateFacility;

        /// <summary>The shipped body, which is two square roots and a floor.</summary>
        public static double GetConstructionBP(double cost, double oldCost, SpaceCenterFacility facilityType)
        {
            var bp = Math.Sqrt(cost + oldCost) - Math.Sqrt(oldCost);
            if (bp < 0)
            {
                bp *= -0.5;
            }
            return Math.Max(bp, 3.0);
        }

        public static double GetConstructionBuildRate(int index, LCSpaceCenter KSC, SpaceCenterFacility facilityType)
        {
            LastRateFacility = facilityType;
            return ConstructionBuildRate;
        }
    }

    /// <summary>1 at or below the full rate, rising by 2 for each unit of rate above it.</summary>
    public sealed class LinearRushCurve : ROUtils.HermiteCurve
    {
        public double Evaluate(double time) => time <= 1.0 ? 1.0 : 1.0 + (time - 1.0) * 2.0;
    }
}
