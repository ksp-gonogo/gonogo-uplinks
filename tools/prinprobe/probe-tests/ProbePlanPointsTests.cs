using System.Linq;
using GonogoPrinProbe;
using Xunit;

namespace GonogoPrinProbe.Tests
{
    public class ProbePlanPointsTests
    {
        private static PlanState At(double ut) => new PlanState(ut, new Triple(ut, 0, 0), new Triple(0, ut, 0));

        /// <summary>The comparison measures time from the first point, so the plan's start
        /// leads whatever order the apsides arrive in.</summary>
        [Fact]
        public void TheStartLeadsAndTheApsidesFollowInTimeOrder()
        {
            var points = ProbePlanPoints.FromApsides(At(100), new[] { At(2800), At(400) }, new[] { At(1600) });

            Assert.Equal(new[] { 100.0, 400, 1600, 2800 }, points.Select(p => p.Ut));
            Assert.Equal(100.0, points[0].Q.X);
        }

        [Fact]
        public void AnApsisAtOrBeforeTheStartIsLeftOut()
        {
            var points = ProbePlanPoints.FromApsides(At(100), new[] { At(100), At(50) }, new[] { At(900) });

            Assert.Equal(new[] { 100.0, 900 }, points.Select(p => p.Ut));
        }

        [Fact]
        public void APlanWithNoApsidesIsItsStartAlone()
        {
            var points = ProbePlanPoints.FromApsides(At(100), new PlanState[0], new PlanState[0]);

            Assert.Single(points);
        }
    }
}
