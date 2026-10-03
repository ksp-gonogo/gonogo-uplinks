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
    internal sealed class MechJebUnlockGate : ICommandGateEvaluator
    {
        public const string KindName = "mechjeb-module-unlocked";

        private readonly Func<bool?> _careerResearch;
        private readonly Func<string, MechJebModuleUnlock?> _unlockOf;
        private readonly Func<string, bool> _partPurchased;
        private readonly Func<string, bool> _techResearched;
        private readonly Func<string, MechJebTechDescription> _describe;

        /// <param name="careerResearch">
        /// Whether this game researches at all: null while no game or research
        /// scenario is loaded, false in sandbox, where MechJeb unlocks everything.
        /// </param>
        /// <param name="unlockOf">The named module's unlock lists on the active vessel, or null when no MechJeb is aboard.</param>
        public MechJebUnlockGate(
            Func<bool?> careerResearch,
            Func<string, MechJebModuleUnlock?> unlockOf,
            Func<string, bool> partPurchased,
            Func<string, bool> techResearched,
            Func<string, MechJebTechDescription> describe)
        {
            _careerResearch = careerResearch;
            _unlockOf = unlockOf;
            _partPurchased = partPurchased;
            _techResearched = techResearched;
            _describe = describe;
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

            try
            {
                var research = _careerResearch();
                if (research == null) return GateVerdict.Unknown("the research scenario is not loaded");
                if (research == false) return GateVerdict.Pass();

                var unlock = _unlockOf(module);
                if (unlock == null) return GateVerdict.Unknown("no MechJeb is aboard the active vessel");
                if (unlock.Parts.Length == 0 && unlock.Techs.Length == 0) return GateVerdict.Pass();
                if (unlock.Parts.Any(_partPurchased) || unlock.Techs.Any(_techResearched)) return GateVerdict.Pass();

                if (unlock.Techs.Length == 0)
                {
                    return GateVerdict.NotUnlocked(
                        $"none of the parts that unlock {module} has been purchased");
                }

                var cheapest = unlock.Techs
                    .Select(id => new { Id = id, Description = _describe(id) })
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
