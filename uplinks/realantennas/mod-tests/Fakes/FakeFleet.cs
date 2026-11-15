#nullable disable
using System;
using System.Collections.Generic;
using Gonogo.RealAntennasUplink;
using RealAntennas;
using RealAntennas.Targeting;

namespace GonogoRealAntennasUplink.Tests.Fakes
{
    /// <summary>A save's worth of fake RealAntennas nodes, craft with an omni and two aimed dishes and stations with several antennas, and the game's own answers about them.</summary>
    internal sealed class FakeFleet : IRaNodeFacts
    {
        public const double EarthRadiusMeters = 6371000.0;

        public readonly List<RACommNode> Craft = new List<RACommNode>();
        public readonly List<RACommNode> Stations = new List<RACommNode>();
        public readonly List<RACommNode> Nodes = new List<RACommNode>();
        public readonly Dictionary<RACommNode, Guid> Owners = new Dictionary<RACommNode, Guid>();

        /// <summary>Every vessel in the game as (its node), debris included, for the owner walk.</summary>
        public readonly List<RACommNode> VesselNodes = new List<RACommNode>();

        /// <summary>Each craft's saved parts, each a list of saved modules, for the part-id walk.</summary>
        public readonly Dictionary<RACommNode, List<(uint Id, List<object> Modules)>> SavedParts =
            new Dictionary<RACommNode, List<(uint, List<object>)>>();

        public static FakeFleet Build(int craft = 17, int stations = 13, int otherVessels = 130, int partsPerCraft = 80, int modulesPerPart = 12, int stationAntennas = 6)
        {
            var fleet = new FakeFleet();
            var body = new object();
            for (var s = 0; s < stations; s++)
            {
                var node = new RACommNode { ParentBody = body, Label = "station " + s };
                string[] cycle = { "S", "S", "X", "X", "Ka", "Ka" };
                var bands = new string[stationAntennas];
                for (var b = 0; b < stationAntennas; b++)
                {
                    bands[b] = cycle[b % cycle.Length];
                }
                for (var a = 0; a < bands.Length; a++)
                {
                    node.RAAntennaList.Add(new RealAntennaDigital
                    {
                        Name = node.Label,
                        ParentNode = node,
                        TechLevelInfo = TechLevelInfo.GetTechLevel(7),
                        RFBand = BandInfo.Get(bands[a]),
                        Gain = 40f + a,
                        TxPower = 60f,
                        SymbolRate = BandInfo.Get(bands[a]).MaxSymbolRate(7),
                        AMWTemp = 40f + a,
                    });
                }
                fleet.Stations.Add(node);
            }
            for (var c = 0; c < craft; c++)
            {
                var node = new RACommNode { Label = "craft " + c };
                var id = new Guid(c + 1, 0, 0, new byte[8]);
                fleet.Owners[node] = id;
                var parts = new List<(uint, List<object>)>();
                for (var p = 0; p < partsPerCraft; p++)
                {
                    var modules = new List<object>();
                    for (var m = 0; m < modulesPerPart; m++)
                    {
                        modules.Add(new object());
                    }
                    parts.Add(((uint)(1000 * (c + 1) + p), modules));
                }
                fleet.SavedParts[node] = parts;
                (string Band, float Gain)[] kit = { ("S", 3f), ("X", 30f), ("Ka", 40f) };
                for (var a = 0; a < kit.Length; a++)
                {
                    var antenna = new RealAntennaDigital
                    {
                        Name = node.Label,
                        ParentNode = node,
                        // Each antenna on a part near the end of the craft, as a relay's dishes are.
                        ParentSnapshot = parts[partsPerCraft - 1 - a].Item2[modulesPerPart / 2],
                        TechLevelInfo = TechLevelInfo.GetTechLevel(5),
                        RFBand = BandInfo.Get(kit[a].Band),
                        Gain = kit[a].Gain,
                        TxPower = 40f,
                        SymbolRate = BandInfo.Get(kit[a].Band).MaxSymbolRate(5),
                    };
                    antenna.modulator.ModulationBits = 3;
                    node.RAAntennaList.Add(antenna);
                }
                fleet.Craft.Add(node);
            }
            for (var c = 0; c < craft; c++)
            {
                var antennas = fleet.Craft[c].RAAntennaList;
                antennas[1].Target = new AntennaTargetVessel
                {
                    vesselId = fleet.Owners[fleet.Craft[(c + 1) % craft]].ToString(),
                    vesselName = "craft " + ((c + 1) % craft),
                };
                antennas[2].Target = new AntennaTargetLatLonAlt
                {
                    bodyName = "Earth",
                    latLonAlt = new FakeVector3 { x = 0f, y = 0f, z = -(float)EarthRadiusMeters },
                };
            }
            for (var v = 0; v < otherVessels; v++)
            {
                fleet.VesselNodes.Add(new RACommNode { Label = "debris " + v });
            }
            fleet.VesselNodes.AddRange(fleet.Craft);
            fleet.Nodes.AddRange(fleet.Stations);
            fleet.Nodes.AddRange(fleet.Craft);
            return fleet;
        }

        /// <summary>The owner of a node, found as the backend finds it: by walking every vessel.</summary>
        public Guid? OwnerOf(object node)
        {
            foreach (var candidate in VesselNodes)
            {
                if (ReferenceEquals(candidate, node))
                {
                    return Owners.TryGetValue(candidate, out var id) ? id : (Guid?)null;
                }
            }
            return null;
        }

        /// <summary>The persistent id of the part an antenna is on, found as the backend finds it for an unloaded craft: by walking every saved part's modules.</summary>
        public uint? PartOf(object node, object antenna)
        {
            var snapshot = ((RealAntenna)antenna).ParentSnapshot;
            if (snapshot == null || !(node is RACommNode ra) || !SavedParts.TryGetValue(ra, out var parts))
            {
                return null;
            }
            foreach (var part in parts)
            {
                if (part.Modules.Contains(snapshot))
                {
                    return part.Id;
                }
            }
            return null;
        }

        public string VesselNodeId(object node) => OwnerOf(node) is Guid owner ? "vessel:" + owner : null;

        public string GroundKey(object node) => node is RACommNode ra && ra.isGroundStation ? "ground:" + ra.Label : null;

        public (uint Part, int Ordinal)?[] PartIds(object node, IReadOnlyList<object> antennas)
        {
            var found = new (uint Part, int Ordinal)?[antennas.Count];
            var seen = new Dictionary<uint, int>();
            for (var i = 0; i < antennas.Count; i++)
            {
                var part = PartOf(node, antennas[i]);
                if (part == null)
                {
                    continue;
                }
                seen.TryGetValue(part.Value, out var ordinal);
                seen[part.Value] = ordinal + 1;
                found[i] = (part.Value, ordinal);
            }
            return found;
        }

        public int? GroundBodyIndex(object node) => node is RACommNode ra && ra.isGroundStation ? 1 : (int?)null;

        public (int Index, double RadiusMeters)? Body(string name) => name == "Earth" ? (1, EarthRadiusMeters) : ((int, double)?)null;
    }
}
