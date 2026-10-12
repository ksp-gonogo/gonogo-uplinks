using System.Collections.Generic;
using Gonogo.RealAntennasUplink;
using Sitrep.Contract;
using Sitrep.Contract.TestSupport;
using Xunit;

namespace GonogoRealAntennasUplink.Tests
{
    /// <summary>
    /// Core's startup check on command Subjects, run against this Uplink's own
    /// manifest so a missing one fails here rather than on a rig.
    ///
    /// <para>Core's <c>ChannelEngine.ValidateCommandSubjects</c> marks the WHOLE
    /// Uplink unavailable when any command that rides the signal delay names no
    /// <see cref="CommandDeclaration.Subject"/> resolving to a declared channel or
    /// dynamic namespace, which took this Uplink dark in a real install. That
    /// engine is not in the devkit, so <see cref="CommandSubjectAssertion"/> calls
    /// the same shared rule (<c>Sitrep.Contract.CommandSubjectRule</c>) that
    /// engine does, against this manifest and this Uplink's own command
    /// assembly, so the check here cannot drift from the one that actually
    /// gates a real install.</para>
    /// </summary>
    public sealed class CommandSubjectTests
    {
        [Fact]
        public void Every_delayed_command_names_a_Subject_that_resolves()
        {
            // "fleet." is the per-craft namespace core registers; setAutoRetarget is addressed into it.
            Assert.Empty(CommandSubjectAssertion.Violations(RealAntennasManifest.Build(), typeof(RealAntennasTargetArgs).Assembly, new[] { "fleet." }));
        }

        [Fact]
        public void The_check_fails_a_missing_or_unresolvable_Subject()
        {
            var planted = new UplinkManifest
            {
                Id = "planted",
                Commands = new List<CommandDeclaration>
                {
                    new CommandDeclaration { Command = "planted.blank" },
                    new CommandDeclaration { Command = "planted.nowhere", Subject = "planted.nowhere.{args.Id}" },
                },
            };

            var violations = CommandSubjectAssertion.Violations(planted, typeof(RealAntennasTargetArgs).Assembly);

            Assert.Equal(2, violations.Count);
        }
    }
}
