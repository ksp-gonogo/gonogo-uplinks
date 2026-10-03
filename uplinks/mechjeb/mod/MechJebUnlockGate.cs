// GonogoMechJebUplink: GPLv3. See GonogoMechJebUplink.csproj's header comment
// for the licence/linkage rationale.

using System;
using System.Linq;
using Sitrep.Contract;

namespace Gonogo.MechJebUplink
{
    /// <summary>What one MechJeb module needs before its window shows: any of these parts bought, or any of these nodes researched.</summary>
    internal sealed class MechJebModuleUnlock
    {
        public MechJebModuleUnlock(string[] parts, string[] techs)
        {
            Parts = parts;
            Techs = techs;
        }

        public string[] Parts { get; }
        public string[] Techs { get; }
    }

    /// <summary>One tech node's title and research cost, as the save's own tree states them.</summary>
    internal readonly struct MechJebTechDescription
    {
        public MechJebTechDescription(string title, double? scienceCost)
        {
            Title = title;
            ScienceCost = scienceCost;
        }

        public string Title { get; }
        public double? ScienceCost { get; }
    }

    /// <summary>
    /// Authority: MechJeb's own <c>ComputerModule.UnlockCheck</c>, asked of the
    /// module on the active vessel. <see cref="CommandRequirement.Quantity"/> is
    /// the MechJeb module whose window the command stands in for, such as
    /// <c>MechJebModuleAscentMenu</c>.
    ///
    /// <para>MechJeb hides a window until the career has bought one of the
    /// module's <c>unlockParts</c> or researched one of its <c>unlockTechs</c>.
    /// Driving the autopilot behind that window from a dashboard would hand the
    /// operator a capability the game itself still withholds, so the command is
    /// locked by the same rule. The lists are read off the live module rather
    /// than written here, so a career mod that patches MechJeb's unlocks is
    /// answered by its own patch.</para>
    ///
    /// <para>The patched-conics half of MechJeb's check
    /// (<c>IsSpaceCenterUpgradeUnlocked</c>) is not repeated here: the commands
    /// that need it declare core's <c>orbit-display</c> requirement beside this
    /// one.</para>
    /// </summary>
    /// <summary>The live reads behind <see cref="MechJebUnlockGate"/>, replaceable for a headless test.</summary>
    internal interface IMechJebUnlockReads
    {
        /// <summary>
        /// Whether this game researches at all: null while no game or research
        /// scenario is loaded, false in sandbox, where MechJeb unlocks everything.
        /// </summary>
        bool? CareerResearch();

        /// <summary>The named module's unlock lists on the active vessel, or null when no MechJeb is aboard.</summary>
        MechJebModuleUnlock? UnlockOf(string module);

        bool PartPurchased(string partName);

        bool TechResearched(string techId);

        MechJebTechDescription Describe(string techId);
    }

    /// <summary>
    /// Authority: MechJeb's own <c>ComputerModule.UnlockCheck</c>, asked of the
    /// module on the active vessel. <see cref="CommandRequirement.Quantity"/> is
    /// the MechJeb module whose window the command stands in for, such as
    /// <c>MechJebModuleAscentMenu</c>.
    ///
    /// <para>MechJeb hides a window until the career has bought one of the
    /// module's <c>unlockParts</c> or researched one of its <c>unlockTechs</c>.
    /// Driving the autopilot behind that window from a dashboard would hand the
    /// operator a capability the game itself still withholds, so the command is
    /// locked by the same rule. The lists are read off the live module rather
    /// than written here, so a career mod that patches MechJeb's unlocks is
    /// answered by its own patch.</para>
    ///
    /// <para>The patched-conics half of MechJeb's check
    /// (<c>IsSpaceCenterUpgradeUnlocked</c>) is not repeated here: the commands
    /// that need it declare core's <c>orbit-display</c> requirement beside this
    /// one.</para>
    ///
    /// <para>Registered whether or not MechJeb is usable, because every command
    /// declares this kind and the engine refuses to start over a declared kind
    /// nothing evaluates. An unusable MechJeb answers Unknown with its reason.</para>
    /// </summary>
    internal sealed class MechJebUnlockGate : ICommandGateEvaluator
    {
        public const string KindName = "mechjeb-module-unlocked";

        private readonly Func<string?> _unavailable;
        private readonly IMechJebUnlockReads? _reads;

        /// <param name="unavailable">Why MechJeb cannot be used, or null when it can.</param>
        /// <param name="reads">The live reads, null in a build that does not link MechJeb.</param>
        public MechJebUnlockGate(Func<string?> unavailable, IMechJebUnlockReads? reads)
        {
            _unavailable = unavailable;
            _reads = reads;
        }

        public string Kind => KindName;

        /// <summary>The requirement for the window a command stands in for.</summary>
        public static CommandRequirement For(string module) => new CommandRequirement
        {
            Kind = KindName,
            Quantity = module,
        };

        public GateVerdict Evaluate(CommandRequirement requirement, IGateArguments arguments)
        {
            var module = requirement.Quantity ?? "";
            if (module.Length == 0) return GateVerdict.Unknown("no MechJeb module is named");
            var unavailable = _unavailable();
            if (unavailable != null) return GateVerdict.Unknown(unavailable);
            if (_reads == null) return GateVerdict.Unknown("MechJeb2 is not linked into this build");

            try
            {
                var research = _reads.CareerResearch();
                if (research == null) return GateVerdict.Unknown("the research scenario is not loaded");
                if (research == false) return GateVerdict.Pass();

                var unlock = _reads.UnlockOf(module);
                if (unlock == null) return GateVerdict.Unknown("no MechJeb is aboard the active vessel");
                if (unlock.Parts.Length == 0 && unlock.Techs.Length == 0) return GateVerdict.Pass();
                if (unlock.Parts.Any(_reads.PartPurchased) || unlock.Techs.Any(_reads.TechResearched)) return GateVerdict.Pass();

                if (unlock.Techs.Length == 0)
                {
                    return GateVerdict.NotUnlocked(
                        $"none of the parts that unlock {module} has been purchased");
                }

                var cheapest = unlock.Techs
                    .Select(id => new { Id = id, Description = _reads.Describe(id) })
                    .OrderBy(t => t.Description.ScienceCost ?? double.MaxValue)
                    .First();
                return GateVerdict.NotUnlocked(
                    $"{cheapest.Description.Title} has not been researched",
                    new MissingUnlock
                    {
                        Kind = UnlockKind.Tech,
                        Id = cheapest.Id,
                        Name = cheapest.Description.Title,
                        ScienceCost = cheapest.Description.ScienceCost,
                    });
            }
            catch (Exception ex)
            {
                return GateVerdict.Unknown("could not read MechJeb's unlocks: " + ex.Message);
            }
        }
    }
}
