// GonogoMechJebUplink: GPLv3. See GonogoMechJebUplink.csproj's header comment
// for the licence/linkage rationale.

using System;
using System.Linq;
using MuMech;

namespace Gonogo.MechJebUplink
{
    /// <summary>
    /// The live KSP and MechJeb reads behind <see cref="MechJebUnlockGate"/>,
    /// kept out of that file so the gate's rule compiles and is tested without
    /// either assembly. Every read here runs on the main thread, where the
    /// engine samples its gates.
    /// </summary>
    internal sealed class MechJebUnlockReads : IMechJebUnlockReads
    {
        private static readonly char[] Separators = { ' ', ',', ';', '\t', '\r', '\n' };

        public bool? CareerResearch()
        {
            var game = HighLogic.CurrentGame;
            if (game == null) return null;
            if (game.Mode == Game.Modes.SANDBOX) return false;
            return ResearchAndDevelopment.Instance == null ? (bool?)null : true;
        }

        public MechJebModuleUnlock? UnlockOf(string module)
        {
            var vessel = FlightGlobals.ActiveVessel;
            var core = vessel == null ? null : vessel.GetMasterMechJeb();
            var computer = core == null ? null : core.GetComputerModule(module);
            if (computer == null) return null;
            return new MechJebModuleUnlock(Split(computer.unlockParts), Split(computer.unlockTechs));
        }

        public bool PartPurchased(string partName)
        {
            var part = PartLoader.LoadedPartsList.FirstOrDefault(a => a.name == partName);
            return part != null && ResearchAndDevelopment.PartModelPurchased(part);
        }

        public bool TechResearched(string techId) =>
            ResearchAndDevelopment.GetTechnologyState(techId) == RDTech.State.Available;

        public MechJebTechDescription Describe(string techId)
        {
            var title = ResearchAndDevelopment.GetTechnologyTitle(techId);
            double? cost = null;
            var nodes = AssetBase.RnDTechTree != null ? AssetBase.RnDTechTree.GetTreeNodes() : null;
            var node = nodes?.FirstOrDefault(n => n?.tech != null && n.tech.techID == techId);
            if (node != null) cost = node.tech.scienceCost;
            return new MechJebTechDescription(string.IsNullOrEmpty(title) ? techId : title, cost);
        }

        private static string[] Split(string list) =>
            (list ?? "").Split(Separators, StringSplitOptions.RemoveEmptyEntries);
    }
}
