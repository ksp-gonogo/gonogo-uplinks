using System;
using System.Collections.Generic;
using System.IO;
using System.Linq;
using Xunit;
using Xunit.Abstractions;

namespace Gonogo.UplinkWiring
{
    /// <summary>
    /// What an Uplink DECLARES and what it REGISTERS have to agree, on every
    /// Uplink in this repo rather than on the ones somebody remembered.
    ///
    /// <para>WHY THIS EXISTS. On 2026-08-31 the whole telemetry mod failed to
    /// start with <c>gate requirements that cannot be enforced: command
    /// "rp1.facility.upgrade" requires gate kind "rp1.facilities"</c>. The named
    /// command was innocent: a DIFFERENT command had been registered with no
    /// matching declaration, <c>AddCommandHandler</c> throws for that, the
    /// Uplink's fail-soft turned the throw into a health string, and every
    /// registration after it was skipped, one of which was the gate evaluator the
    /// named command's requirement needed. One Uplink's typo took the mod down.
    /// The channel half is quieter still and throws nothing at all.</para>
    ///
    /// <para><b>Why HERE.</b> <c>gonogo</c> holds the same walk over the Uplinks
    /// that still live in its <c>mod/</c>, and it enrols them by their existing
    /// under that directory. An Uplink that moves here leaves that walk's reach,
    /// so departure silently removed the guard: the three Uplinks here were
    /// checked in <c>gonogo</c> and checked nowhere afterwards. The check belongs
    /// with the code, which is this repo, and the Uplinks most likely to break
    /// startup are the ones being moved.</para>
    ///
    /// <para><b>Both directions, because only one of them is loud.</b> A
    /// registration with no declaration throws, which is how the outage announced
    /// itself. A DECLARATION with no registration announces nothing: the manifest
    /// advertises the command, the client builds a control for it, and the press
    /// is refused by the engine as unhandled. A declared channel nothing publishes
    /// to is quieter again, because the subscribe is ACCEPTED and the reading
    /// simply never arrives, so a widget holds an empty one for the whole session
    /// with nothing logged. All four are asserted, and all four are at zero here,
    /// so none of them carries a debt list.</para>
    ///
    /// <para><b>Why source rather than running Register.</b> The obvious form is
    /// to hand the Uplink a recording host and compare against its manifest. That
    /// form only sees what the headless test build can RUN, and on the Uplinks
    /// here it runs very little: each <c>mod-tests</c> project compiles a hand
    /// -picked subset of KSP-free files, so the Uplink class itself is usually
    /// absent and <c>Register</c> is never reached. It also needs the vendored
    /// contract and devkit assemblies, which are not ours to redistribute and are
    /// absent on a CI runner. This walk needs the checkout and nothing else.</para>
    ///
    /// <para><b>What it cannot see.</b> It pairs the two sides unconditionally, so
    /// it does not notice a registration whose <c>IsAvailable</c> guard differs
    /// from its declaration's. It does not follow a name built by concatenation at
    /// runtime (<see cref="EveryNameTheWalkReadsResolvesToAValue"/> makes that
    /// visible rather than silent), and it does not look at dynamic-namespace
    /// sub-topics, which are correctly absent from the channel list.</para>
    ///
    /// <para><b>A measured consequence of that, worth knowing before trusting the
    /// publish half.</b> An Uplink with a fail-soft inert path registers a channel
    /// source for the SAME topics it publishes when live, so such a topic has two
    /// publish sites on mutually exclusive branches and either one satisfies this
    /// walk alone. Deleting the live publisher and leaving the inert one standing
    /// was tried on a real Uplink here and the walk stayed green, yet the topic
    /// then reaches no subscriber on any install where the Uplink IS available,
    /// which is the silent failure this direction exists to catch. Five of the six
    /// topics declared across this repo have that shape. Telling the two branches
    /// apart needs control flow, which a text walk does not have, so read the
    /// publish half as a floor against a topic nothing publishes AT ALL rather
    /// than as a guarantee that the live path publishes it.</para>
    /// </summary>
    public class UplinkWiringCoverageTests
    {
        private readonly ITestOutputHelper _output;

        public UplinkWiringCoverageTests(ITestOutputHelper output) => _output = output;

        /// <summary>
        /// Uplinks that must be seen to register a command handler. A floor, not a
        /// list to keep current: it exists so an extractor that stops matching
        /// <c>host.AddCommandHandler</c> goes red instead of reporting a clean
        /// repo.
        /// </summary>
        private const int MinimumUplinksRegisteringCommands = 1;

        /// <summary>Uplinks that must be seen to take a publisher. Same floor, same reason.</summary>
        private const int MinimumUplinksPublishingTopics = 3;

        [Fact]
        public void EveryCommandAnUplinkRegistersIsAlsoDeclared()
        {
            var offenders = Scan()
                .Where(u => u.UndeclaredCommands.Count > 0)
                .Select(u => u.Name + ": " + string.Join(", ", u.UndeclaredCommands))
                .ToList();

            Assert.True(
                offenders.Count == 0,
                "These commands are registered with no matching CommandDeclaration. "
                + "AddCommandHandler throws for that, the throw lands in the Uplink's own "
                + "fail-soft, and every registration after it is skipped:\n  "
                + string.Join("\n  ", offenders));
        }

        [Fact]
        public void EveryTopicAnUplinkPublishesToIsAlsoDeclared()
        {
            var offenders = Scan()
                .Where(u => u.UndeclaredTopics.Count > 0)
                .Select(u => u.Name + ": " + string.Join(", ", u.UndeclaredTopics))
                .ToList();

            Assert.True(
                offenders.Count == 0,
                "These topics are published to with no matching ChannelDeclaration. Nothing "
                + "throws: the publisher works, the Uplink publishes every tick, and the engine "
                + "refuses every subscribe, so the topic is absent from the wire with nothing "
                + "logged:\n  " + string.Join("\n  ", offenders));
        }

        /// <summary>
        /// The other direction of the same pairing, which the outage's shape hides:
        /// a registration with no declaration throws and takes the rest of Register
        /// down with it, so it is loud, whereas a declaration with no registration
        /// is silent all the way to the operator's finger.
        /// </summary>
        [Fact]
        public void EveryCommandAnUplinkDeclaresIsAlsoRegistered()
        {
            var offenders = Scan()
                .Where(u => u.UnregisteredCommands.Count > 0)
                .Select(u => u.Name + ": " + string.Join(", ", u.UnregisteredCommands))
                .ToList();

            Assert.True(
                offenders.Count == 0,
                "These commands are declared with no AddCommandHandler. Nothing throws and "
                + "nothing is logged: the manifest advertises the command, a client renders a "
                + "control for it, and the press is refused by the engine as unhandled:\n  "
                + string.Join("\n  ", offenders));
        }

        /// <summary>
        /// The channel half of the same direction, and the quietest of the four.
        /// A subscribe to a declared topic nothing publishes to is ACCEPTED, so
        /// there is no refusal to notice; the reading simply never arrives and the
        /// widget holds an empty one for the life of the session.
        /// </summary>
        [Fact]
        public void EveryTopicAnUplinkDeclaresIsAlsoPublishedTo()
        {
            var offenders = Scan()
                .Where(u => u.UnpublishedTopics.Count > 0)
                .Select(u => u.Name + ": " + string.Join(", ", u.UnpublishedTopics))
                .ToList();

            Assert.True(
                offenders.Count == 0,
                "These topics are declared with nothing publishing to them. The subscribe is "
                + "accepted rather than refused, so the widget reading one holds an empty "
                + "reading for the whole session with nothing logged:\n  "
                + string.Join("\n  ", offenders));
        }

        /// <summary>
        /// The walk finds every Uplink this repo builds. A walk that finds nothing
        /// reports a clean repo, so a floor alone is not enough: it is checked
        /// against the <c>uplink.json</c> files CI's own matrix is built from, so a
        /// walk looking somewhere CI is not goes red rather than quiet.
        ///
        /// <para>An Uplink with no <c>mod/</c> at all is client-only and correctly
        /// absent from the walk, so the manifests are the SUPERSET: the assertion
        /// is that the walk finds nothing the manifests do not know about, and that
        /// every manifest-declared Uplink with a mod half is found.</para>
        /// </summary>
        [Fact]
        public void TheWalkFindsEveryUplinkThisRepoDeclares()
        {
            var found = UplinkSources.Discover();
            var declared = UplinkSources.DeclaredInManifests();

            Assert.True(
                declared.Count > 0,
                "No uplinks/*/uplink.json was found at all, so the independent source this walk "
                + "is checked against is empty and the check below cannot fail.");

            var unknown = found.Keys.Where(name => !declared.Contains(name)).OrderBy(n => n).ToList();
            Assert.True(
                unknown.Count == 0,
                "The walk found Uplink directories with no uplink.json, so CI's matrix does not "
                + "know about them and nothing else here checks them: " + string.Join(", ", unknown));

            var missed = declared
                .Where(name => !found.ContainsKey(name))
                .Where(name => Directory.Exists(Path.Combine(UplinkSources.UplinksDir(), name, "mod")))
                .OrderBy(n => n, StringComparer.Ordinal)
                .ToList();

            Assert.True(
                missed.Count == 0,
                "These Uplinks declare an uplink.json and have a mod/ directory, and the walk did "
                + "not find them, so their wiring is unchecked: " + string.Join(", ", missed));
        }

        /// <summary>
        /// The walk has to find its subjects or it reports a clean repo while
        /// proving nothing, and it has to find the REGISTRATIONS specifically: an
        /// extractor that matched nothing inside a correctly-discovered Uplink
        /// would pass every assertion above.
        /// </summary>
        [Fact]
        public void TheWalkSeesTheWiringItIsMeantToCover()
        {
            var scanned = Scan();

            foreach (var uplink in scanned)
            {
                _output.WriteLine(
                    $"{uplink.Name}: {uplink.RegisteredCommands.Count} registered / "
                    + $"{uplink.DeclaredCommands.Count} declared commands, "
                    + $"{uplink.PublishedTopics.Count} published / "
                    + $"{uplink.DeclaredTopics.Count} declared topics");
            }

            var registering = scanned.Where(u => u.RegisteredCommands.Count > 0).Select(u => u.Name).ToList();
            var publishing = scanned.Where(u => u.PublishedTopics.Count > 0).Select(u => u.Name).ToList();

            Assert.True(
                registering.Count >= MinimumUplinksRegisteringCommands,
                $"The walk saw command handlers on only {registering.Count} Uplink(s), expected at "
                + $"least {MinimumUplinksRegisteringCommands}. An extractor that matches nothing "
                + "reports no violations and looks exactly like a correctly wired repo. Saw: "
                + string.Join(", ", registering));

            Assert.True(
                publishing.Count >= MinimumUplinksPublishingTopics,
                $"The walk saw publishers on only {publishing.Count} Uplink(s), expected at least "
                + $"{MinimumUplinksPublishingTopics}. Saw: " + string.Join(", ", publishing));
        }

        /// <summary>
        /// Every name the walk reads has to resolve to the string it carries.
        ///
        /// <para>The comparison is by VALUE, so a name the walk cannot resolve is
        /// not reported as a violation: it drops out of both sides and the pair it
        /// belonged to is silently not checked. That is the same hole this file
        /// exists to close, one level down, so it is asserted rather than
        /// tolerated.</para>
        /// </summary>
        [Fact]
        public void EveryNameTheWalkReadsResolvesToAValue()
        {
            var unresolved = Scan()
                .Where(u => u.Unresolved.Count > 0)
                .Select(u => u.Name + ": " + string.Join(", ", u.Unresolved))
                .ToList();

            Assert.True(
                unresolved.Count == 0,
                "The walk read these command/topic names and could not resolve them to a string, "
                + "so both sides of their pairing silently drop out of the comparison:\n  "
                + string.Join("\n  ", unresolved));
        }

        /// <summary>
        /// Every registration is written on the <c>host</c> parameter, which is
        /// the only receiver the walk reads. An Uplink that stashed the host in a
        /// field and called <c>_host.AddCommandHandler</c> would register commands
        /// this walk never sees and be indistinguishable from a correctly wired
        /// one.
        /// </summary>
        [Fact]
        public void EveryRegistrationIsWrittenOnTheHostParameter()
        {
            var offenders = Scan()
                .Where(u => u.OffHostCalls.Count > 0)
                .Select(u => u.Name + ": " + string.Join(", ", u.OffHostCalls))
                .ToList();

            Assert.True(
                offenders.Count == 0,
                "These registrations are made on something other than the host parameter, so the "
                + "walk cannot see them and reports nothing about whether they are declared. "
                + "Register on the host parameter, or teach the walk this receiver:\n  "
                + string.Join("\n  ", offenders));
        }

        /// <summary>
        /// The instrument checks, and the reason anything above can be believed. A
        /// guard that cannot fail is worse than no guard, so the walk is made to
        /// see a violation that is known to be there: one side of one real pairing
        /// in a real Uplink's source is rewritten IN MEMORY and the walk must then
        /// name exactly that command or topic.
        ///
        /// <para><b>Per Uplink, not once.</b> The shapes differ: a command name is
        /// a call argument where a topic is usually an object-initialiser
        /// assignment, and an Uplink may declare through a private helper. A plant
        /// in one says nothing about the others, so every Uplink with wiring is
        /// planted in, in both directions.</para>
        /// </summary>
        [Theory]
        [MemberData(nameof(UplinksRegisteringCommands))]
        public void TheWalkNamesACommandWhoseDeclarationIsRemoved(string uplink)
        {
            Plant(
                uplink,
                blank: w => w.DeclaredCommands,
                against: w => w.RegisteredCommands,
                reported: w => w.UndeclaredCommands,
                what: "declaration of the command");
        }

        /// <summary>
        /// The direction <see cref="EveryCommandAnUplinkDeclaresIsAlsoRegistered"/>
        /// asserts, proved the same way: the handler registration is taken out and
        /// the declaration left standing.
        /// </summary>
        [Theory]
        [MemberData(nameof(UplinksRegisteringCommands))]
        public void TheWalkNamesACommandWhoseRegistrationIsRemoved(string uplink)
        {
            Plant(
                uplink,
                blank: w => w.RegisteredCommands,
                against: w => w.DeclaredCommands,
                reported: w => w.UnregisteredCommands,
                what: "handler registration of the command");
        }

        /// <summary>
        /// The channel half, separately from the command half, because the two are
        /// read by different code: one half can go blind while the other still
        /// sees.
        /// </summary>
        [Theory]
        [MemberData(nameof(UplinksPublishingTopics))]
        public void TheWalkNamesATopicWhoseDeclarationIsRemoved(string uplink)
        {
            Plant(
                uplink,
                blank: w => w.DeclaredTopics,
                against: w => w.PublishedTopics,
                reported: w => w.UndeclaredTopics,
                what: "declaration of the topic");
        }

        /// <summary>The publish half of the same direction, and the quietest one.</summary>
        [Theory]
        [MemberData(nameof(UplinksPublishingTopics))]
        public void TheWalkNamesATopicWhosePublisherIsRemoved(string uplink)
        {
            Plant(
                uplink,
                blank: w => w.PublishedTopics,
                against: w => w.DeclaredTopics,
                reported: w => w.UnpublishedTopics,
                what: "publisher of the topic");
        }

        public static IEnumerable<object[]> UplinksRegisteringCommands() =>
            Scan().Where(u => u.RegisteredCommands.Count > 0).Select(u => new object[] { u.Name });

        public static IEnumerable<object[]> UplinksPublishingTopics() =>
            Scan().Where(u => u.PublishedTopics.Count > 0).Select(u => new object[] { u.Name });

        /// <summary>
        /// Rewrite every site on one side of one pairing, then require the walk to
        /// name it. Every site of the name is rewritten because a name written
        /// twice would otherwise survive its own removal.
        /// </summary>
        private static void Plant(
            string uplink,
            Func<UplinkWiring, IReadOnlyList<WiringUse>> blank,
            Func<UplinkWiring, IReadOnlyList<WiringUse>> against,
            Func<UplinkWiring, IReadOnlyList<WiringUse>> reported,
            string what)
        {
            var directories = UplinkSources.Discover()[uplink];
            var wiring = UplinkWiringScan.Scan(uplink, directories);

            Assert.Empty(reported(wiring));

            var (name, sites) = Pairing(blank(wiring), against(wiring));
            var sabotaged = UplinkWiringScan.Scan(uplink, directories, Rewriting(sites));

            Assert.True(
                reported(sabotaged).Any(u => u.Value == name),
                $"The {what} \"{name}\" was rewritten out of {uplink}'s source at "
                + string.Join(", ", sites.Select(s => $"{s.File}:{s.Line}"))
                + " and the walk still reported the two sides as agreeing, so it cannot tell a "
                + "wired Uplink from an unwired one and every pass it reports is meaningless. "
                + "Reported instead: " + Describe(reported(sabotaged)));
        }

        /// <summary>
        /// One name carried by both sides, with every site on the side being
        /// rewritten. Sites shared with the other side are no use: a name written
        /// once for both sides would move both and leave them agreeing.
        /// </summary>
        private static (string Name, IReadOnlyList<WiringUse> Sites) Pairing(
            IReadOnlyList<WiringUse> side, IReadOnlyList<WiringUse> other)
        {
            var shared = other.Select(u => (u.File, u.Index)).ToHashSet();
            var wanted = other.Where(u => u.Value is not null)
                .Select(u => u.Value!)
                .ToHashSet(StringComparer.Ordinal);

            var candidate = side
                .Where(u => u.Value is not null && wanted.Contains(u.Value))
                .GroupBy(u => u.Value!, StringComparer.Ordinal)
                .Where(g => g.All(u => !shared.Contains((u.File, u.Index))))
                .OrderBy(g => g.Key, StringComparer.Ordinal)
                .FirstOrDefault();

            Assert.True(
                candidate is not null,
                "No name is carried by both sides at sites of its own, so there is nothing here "
                + "a plant could remove from one side and leave on the other.");

            return (candidate!.Key, candidate.ToList());
        }

        /// <summary>
        /// The named sites replaced by a name nothing else uses, nothing else
        /// touched. Descending by position so an earlier rewrite does not move a
        /// later one, and it throws rather than passing through a site whose text
        /// is not what the walk read there: a plant that quietly lands nowhere
        /// leaves the two sides agreeing, which is indistinguishable from a walk
        /// that cannot see.
        /// </summary>
        private static Func<string, string, string> Rewriting(IReadOnlyList<WiringUse> sites) => (file, text) =>
        {
            foreach (var site in sites
                .Where(s => string.Equals(s.File, file, StringComparison.Ordinal))
                .OrderByDescending(s => s.Index))
            {
                var found = site.Index >= 0 && site.Index + site.Expression.Length <= text.Length
                    ? text.Substring(site.Index, site.Expression.Length)
                    : null;

                if (!string.Equals(found, site.Expression, StringComparison.Ordinal))
                {
                    throw new InvalidOperationException(
                        $"The walk read \"{site.Expression}\" at {file}:{site.Line} but that "
                        + $"position holds \"{found ?? "<past the end of the file>"}\", so the "
                        + "plant would land nowhere and the test would pass on a walk that sees "
                        + "nothing.");
                }

                text = text.Remove(site.Index, site.Expression.Length).Insert(site.Index, Sabotage);
            }

            return text;
        };

        /// <summary>A name no Uplink declares, registers or publishes.</summary>
        private const string Sabotage = "\"gonogo.notWired\"";

        private static string Describe(IReadOnlyList<WiringUse> uses) =>
            uses.Count == 0 ? "nothing" : string.Join(", ", uses);

        private static List<UplinkWiring> Scan() =>
            UplinkSources.Discover()
                .OrderBy(u => u.Key, StringComparer.Ordinal)
                .Select(u => UplinkWiringScan.Scan(u.Key, u.Value))
                .ToList();
    }
}
