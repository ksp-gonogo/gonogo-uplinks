using System.Collections;
using Gonogo.ActionGroupsExtendedUplink;
using Xunit;

namespace Gonogo.ActionGroupsExtendedUplink.Tests
{
    /// <summary>
    /// AGExt is never present in this headless test environment: there is no
    /// AGExt.dll on the reference path, so this is exactly the "AGX absent"
    /// case every real install
    /// without AGX will also hit: the probe must fail-soft to a NOT-available
    /// instance rather than throwing or returning null. The live
    /// AGX-installed binding itself is Deck-validated (Task 5), mirroring
    /// GonogoRealAntennasUplink.RaReflection's untested-live-binding posture.
    /// </summary>
    public class AgxReflectionTests
    {
        [Fact]
        public void Probe_WithAgxAbsent_ReturnsNotAvailableInstance()
        {
            var agx = AgxReflection.Probe();

            Assert.NotNull(agx);
            Assert.False(agx.IsAvailable);
        }

        [Fact]
        public void Probe_WithAgxAbsent_AssignedGroupsIsNull()
        {
            var agx = AgxReflection.Probe();

            Assert.Null(agx.AssignedGroups());
        }

        [Fact]
        public void Probe_WithAgxAbsent_ActivateReturnsFalse()
        {
            var agx = AgxReflection.Probe();

            Assert.False(agx.Activate(1, true));
            Assert.False(agx.Activate(1, false));
        }

        // MapGroups is the pure half of AssignedGroups: the dictionary AGExt
        // returned, plus a state reader. Driving it directly is what lets the
        // per-element failures be exercised at all, since Probe() can only bind
        // to a live AGExt assembly and there is none in this environment.

        [Fact]
        public void MapGroups_ReadsEveryGroupWhenAGExtAnswersForAllOfThem()
        {
            var raw = new Hashtable { [1] = "Solar", [2] = null, [3] = "Gear" };

            var groups = AgxReflection.MapGroups(raw, index => index == 2);

            Assert.NotNull(groups);
            Assert.Equal(3, groups!.Count);
            var solar = Assert.Single(groups, g => g.Index == 1);
            Assert.Equal("Solar", solar.Name);
            Assert.False(solar.State);
            // An assigned group AGExt left unnamed still reads: it is the NAME
            // that is absent, and the backend labels it "AG{n}".
            var unnamed = Assert.Single(groups, g => g.Index == 2);
            Assert.Null(unnamed.Name);
            Assert.True(unnamed.State);
        }

        [Fact]
        public void MapGroups_DeclinesTheTickWhenAGroupsKeyIsNotAnIndex()
        {
            // Dropping the unreadable entry published the other two as the
            // vessel's complete set: the operator cannot tell "AGX reports two
            // groups" from "AGX reports three and we read two", and the third is
            // not on screen to command.
            var raw = new Hashtable { [1] = "Solar", ["nope"] = "Mystery", [3] = "Gear" };

            Assert.Null(AgxReflection.MapGroups(raw, _ => true));
        }

        [Fact]
        public void MapGroups_DeclinesTheTickWhenAGroupsStateIsNotABool()
        {
            // The same collapse one rung along: a state AGExt did not answer
            // with a bool drew a disengaged toggle for a group nobody read.
            var raw = new Hashtable { [1] = "Solar", [2] = "Gear" };

            Assert.Null(AgxReflection.MapGroups(raw, index => index == 2 ? (object?)null : true));
        }
    }
}
