using System.Collections.Generic;
using System.Linq;
using SCANsat.SCAN_PartModules;

namespace Gonogo.ScansatUplink
{
    /// <summary>
    /// The live KSP and SCANsat reads behind <see cref="ScanTypeGate"/>, kept
    /// out of that file so the gate's rule compiles and is tested without
    /// either assembly. Every read here runs on the main thread, where the
    /// engine samples its gates.
    /// </summary>
    internal sealed class ScanTypeReads : IScanTypeReads
    {
        public bool? CareerResearch()
        {
            var game = HighLogic.CurrentGame;
            if (game == null) return null;
            if (game.Mode == Game.Modes.SANDBOX) return false;
            return ResearchAndDevelopment.Instance == null ? (bool?)null : true;
        }

        public IReadOnlyList<ScannerCarrier> Carriers()
        {
            var carriers = new List<ScannerCarrier>();
            foreach (var part in PartLoader.LoadedPartsList)
            {
                if (part?.partPrefab == null) continue;
                // One part can carry several scanners, and ModuleSCANresourceScanner is a SCANsat.
                var sensorType = 0;
                foreach (var module in part.partPrefab.Modules)
                {
                    if (module is SCANsat.SCAN_PartModules.SCANsat scanner) sensorType |= scanner.sensorType;
                }
                if (sensorType == 0) continue;
                carriers.Add(new ScannerCarrier(
                    sensorType, part.TechRequired ?? "", ResearchAndDevelopment.PartTechAvailable(part)));
            }
            return carriers;
        }

        public ScanTechDescription Describe(string techId)
        {
            var title = ResearchAndDevelopment.GetTechnologyTitle(techId);
            var nodes = AssetBase.RnDTechTree != null ? AssetBase.RnDTechTree.GetTreeNodes() : null;
            var node = nodes?.FirstOrDefault(n => n?.tech != null && n.tech.techID == techId);
            return new ScanTechDescription(
                string.IsNullOrEmpty(title) ? techId : title,
                node != null ? node.tech.scienceCost : (double?)null);
        }
    }
}
