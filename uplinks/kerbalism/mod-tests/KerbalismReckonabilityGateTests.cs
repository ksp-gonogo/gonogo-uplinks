using System;
using System.Linq;
using System.Reflection;
using Sitrep.Contract;
using Sitrep.Contract.TestSupport;
using Xunit;

namespace GonogoKerbalismUplink.Tests
{
    /// <summary>
    /// Every model this Uplink declares must resolve against the wire: the
    /// property marks on its own payloads and the marks it places on core's
    /// <c>vessel.resources</c>. A crew list and its rules reorder between
    /// samples, so each list names the entry key a model follows an entry by.
    /// </summary>
    public class KerbalismReckonabilityGateTests
    {
        private static readonly Assembly Own = typeof(KerbalismCrewEntry).Assembly;

        private static readonly Type[] Universe = Own.GetTypes()
            .Concat(typeof(VesselResources).Assembly.GetTypes())
            .ToArray();

        [Fact]
        public void Property_marks_on_the_crew_payload_resolve()
        {
            var problems = ReckonabilityAssertion.Problems(
                Universe,
                ReckonabilityAssertion.TopicPayloads(Universe),
                ReckonabilityAssertion.KnownBases());

            Assert.Empty(problems);
        }

        [Fact]
        public void Marks_on_core_topics_resolve()
        {
            var problems = ReckonabilityAssertion.ProblemsOn(
                Own,
                ReckonabilityAssertion.TopicPayloads(Universe),
                ReckonabilityAssertion.KnownBases());

            Assert.Empty(problems);
        }

        [Fact]
        public void Resource_levels_are_marked_on_core_s_topic_and_crew_accumulators_on_this_one()
        {
            var marked = Own.GetCustomAttributes<SitrepReckonableOnAttribute>().ToList();

            Assert.Contains(marked, m => m.Topic == "vessel.resources" && m.Field == "resources.*.current");
            Assert.True(typeof(KerbalismCrewRule).GetProperty(nameof(KerbalismCrewRule.Problem))!
                .IsDefined(typeof(SitrepReckonableAttribute), false));
        }
    }
}
