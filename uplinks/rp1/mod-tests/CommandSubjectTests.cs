using System;
using System.Collections.Generic;
using System.Linq;
using System.Reflection;
using GonogoRp1Uplink;
using Sitrep.Contract;
using Xunit;

namespace GonogoRp1Uplink.Tests
{
    /// <summary>
    /// Core's startup check on command Subjects, run against this Uplink's own
    /// manifest so a missing one fails here rather than on a rig.
    ///
    /// <para>Core's <c>ChannelEngine.ValidateCommandSubjects</c> marks the WHOLE
    /// Uplink unavailable when any command that rides the signal delay names no
    /// <see cref="CommandDeclaration.Subject"/> resolving to a declared channel or
    /// dynamic namespace, which took this Uplink dark in a real install. That
    /// engine is not in the devkit, so the rule is restated here: a command is
    /// delayed unless its <see cref="SitrepCommandAttribute"/> says TrueNow, and
    /// its Subject, up to any <c>{args.X}</c> segment, must be a channel this
    /// manifest declares or a topic <c>Sitrep.Contract</c> tags, which is how
    /// core's own channels are known here.</para>
    /// </summary>
    public sealed class CommandSubjectTests
    {
        [Fact]
        public void Every_delayed_command_names_a_Subject_that_resolves()
        {
            Assert.Empty(Violations(BuildEveryCommand(), typeof(Rp1WarpArgs).Assembly));
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

            var violations = Violations(planted, typeof(Rp1WarpArgs).Assembly);

            Assert.Equal(2, violations.Count);
        }

        /// <summary>
        /// The manifest with every command declared. The real constructor declares
        /// only the commands whose RP-1 types resolved, which on a machine without
        /// RP-1 is almost none, so every availability flag is passed as true instead.
        /// </summary>
        private static UplinkManifest BuildEveryCommand()
        {
            var build = typeof(Rp1ScUplink).GetMethod("BuildManifest", BindingFlags.NonPublic | BindingFlags.Static)!;
            var flags = build.GetParameters().Select(_ => (object)true).ToArray();
            return (UplinkManifest)build.Invoke(null, flags)!;
        }

        private static List<string> Violations(UplinkManifest manifest, Assembly slice)
        {
            var topics = new HashSet<string>(StringComparer.Ordinal);
            foreach (var channel in manifest.Channels)
            {
                topics.Add(channel.Topic);
            }
            foreach (var type in typeof(UplinkManifest).Assembly.GetTypes())
            {
                foreach (var tag in type.GetCustomAttributes<SitrepTopicAttribute>(false))
                {
                    topics.Add(tag.TopicId);
                }
            }

            var delays = new Dictionary<string, DelayRole>(StringComparer.Ordinal);
            foreach (var type in slice.GetTypes())
            {
                foreach (var tag in type.GetCustomAttributes<SitrepCommandAttribute>(false))
                {
                    delays[tag.CommandId] = tag.Delay;
                }
            }

            var violations = new List<string>();
            foreach (var command in manifest.Commands)
            {
                var delay = delays.TryGetValue(command.Command, out var tagged) ? tagged : command.Delay;
                if (delay == DelayRole.TrueNow)
                {
                    continue;
                }
                var subject = command.Subject;
                if (string.IsNullOrEmpty(subject))
                {
                    violations.Add(command.Command + " declares no Subject");
                    continue;
                }
                var brace = subject.IndexOf('{');
                var literal = brace < 0 ? subject : subject.Substring(0, brace);
                if (!topics.Contains(literal))
                {
                    violations.Add(command.Command + " names Subject \"" + subject + "\", which no channel declares");
                }
            }
            return violations;
        }
    }
}
