using System.Collections.Generic;
using Gonogo.KerbalismUplink;
using Sitrep.Contract;
using Xunit;

namespace GonogoKerbalismUplink.Tests
{
    /// <summary>
    /// Whether Kerbalism publishes its reliability topics at all, which is a
    /// different question from what they say once it does.
    ///
    /// <para>A save with failures definitely switched off publishes nothing, so
    /// a console says nothing rather than showing a craft of clean parts that
    /// nothing is breaking. The cut is DEFINITE-off only, and the indeterminate
    /// case below is the point of the distinction rather than a leftover.</para>
    /// </summary>
    public class ReliabilityCapabilityDeclineTests
    {
        private static ReliabilityPreferencesRaw Prefs(bool? mtbfFailures) =>
            new() { MtbfFailures = mtbfFailures };

        [Fact]
        public void DeclinesWhenTheReliabilityFeatureIsSwitchedOff()
        {
            var features = new Dictionary<string, bool> { ["Reliability"] = false };

            Assert.Equal(ReliabilityCoverage.Disabled,
                KerbalismReliabilityMap.ComputeCoverage(features, Prefs(true)));
            Assert.False(KerbalismReliabilityMap.CanServe(features, Prefs(true)));
        }

        /// <summary>
        /// The gate that is easy to miss: with the feature ON and mtbfFailures OFF,
        /// Kerbalism's own Reliability FixedUpdate skips the whole wear-and-break
        /// path, so nothing ever fails and every part reads clean. Publishing there
        /// would tell the operator the craft is watched and fine.
        /// </summary>
        [Fact]
        public void DeclinesWhenMtbfFailuresAreSwitchedOffEvenWithTheFeatureOn()
        {
            var features = new Dictionary<string, bool> { ["Reliability"] = true };

            Assert.Equal(ReliabilityCoverage.Disabled,
                KerbalismReliabilityMap.ComputeCoverage(features, Prefs(false)));
            Assert.False(KerbalismReliabilityMap.CanServe(features, Prefs(false)));
        }

        [Fact]
        public void ServesWhenItIsActuallyModelling()
        {
            var features = new Dictionary<string, bool> { ["Reliability"] = true };

            Assert.Equal(ReliabilityCoverage.Modeled,
                KerbalismReliabilityMap.ComputeCoverage(features, Prefs(true)));
            Assert.True(KerbalismReliabilityMap.CanServe(features, Prefs(true)));
        }

        /// <summary>
        /// STILL SERVES when it cannot tell which way its own switch is set.
        /// Serving and admitting the uncertainty is honest; going quiet would
        /// launder a "do not know" into a clean "nothing here".
        /// </summary>
        [Theory]
        [InlineData(true)]   // feature on, mtbfFailures unreadable
        [InlineData(false)]  // features unreadable entirely
        public void ServesWhenItCannotTellWhetherItIsModelling(bool featuresResolved)
        {
            var features = featuresResolved
                ? new Dictionary<string, bool> { ["Reliability"] = true }
                : new Dictionary<string, bool>();
            var prefs = Prefs(featuresResolved ? null : true);

            Assert.Equal(ReliabilityCoverage.Indeterminate,
                KerbalismReliabilityMap.ComputeCoverage(features, prefs));
            Assert.True(KerbalismReliabilityMap.CanServe(features, prefs));
        }

        /// <summary>
        /// A features dictionary that resolved but carries no Reliability key at
        /// all: the type was found and the field was not, which is a shape this
        /// build does not understand rather than a switch it can read.
        /// </summary>
        [Fact]
        public void ServesWhenTheFeatureKeyIsAbsentFromAResolvedDictionary()
        {
            var features = new Dictionary<string, bool> { ["Science"] = true };

            Assert.Equal(ReliabilityCoverage.Indeterminate,
                KerbalismReliabilityMap.ComputeCoverage(features, Prefs(true)));
            Assert.True(KerbalismReliabilityMap.CanServe(features, Prefs(true)));
        }
    }
}
