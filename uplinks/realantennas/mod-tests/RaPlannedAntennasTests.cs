using System;
using System.Collections.Generic;
using System.Linq;
using System.Reflection;
using Gonogo.RealAntennasUplink;
using GonogoRealAntennasUplink.Tests.Fakes;
using RealAntennas;
using RealAntennas.Targeting;
using Sitrep.Contract;
using Xunit;

namespace GonogoRealAntennasUplink.Tests
{
    /// <summary>
    /// The kept antenna lists and the reach worked from them. Two claims: what
    /// is kept always equals what reading RealAntennas afresh would give,
    /// through every change RealAntennas can make to an antenna, and a node
    /// nothing has changed on costs a short check and no full read.
    /// </summary>
    public class RaPlannedAntennasTests
    {
        private static readonly RaReflection Ra = RaReflection.ForAssembly(typeof(RealAntenna).Assembly);

        private static readonly FieldInfo[] Figures = typeof(RaPlannedAntenna).GetFields(BindingFlags.Public | BindingFlags.Instance);

        private static void AssertSame(IReadOnlyList<RaPlannedAntenna> expected, IReadOnlyList<RaPlannedAntenna> actual, string node)
        {
            Assert.True(expected.Count == actual.Count, node + ": " + actual.Count + " antennas, expected " + expected.Count);
            for (var i = 0; i < expected.Count; i++)
            {
                foreach (var figure in Figures)
                {
                    var want = figure.GetValue(expected[i]);
                    var got = figure.GetValue(actual[i]);
                    Assert.True(Equals(want, got), node + " antenna " + i + " " + figure.Name + ": " + got + ", expected " + want);
                }
            }
        }

        private static void AssertEveryNodeIsAsReadAfresh(FakeFleet fleet, RaPlannedAntennas kept, long instant)
        {
            foreach (var node in fleet.Nodes)
            {
                AssertSame(ReflectiveOracle.Planned(Ra, node, fleet), kept.Of(node, instant)!.Planned, node.Label);
            }
        }

        [Fact]
        public void EveryFigureIsCompared()
        {
            // The comparison walks the type's public fields, so it has to be seeing them.
            Assert.True(Figures.Length >= 23, "only " + Figures.Length + " fields found on RaPlannedAntenna");
        }

        [Fact]
        public void AFirstReadEqualsReadingEveryFigureAfresh()
        {
            var fleet = FakeFleet.Build();
            var kept = new RaPlannedAntennas(Ra, fleet);

            AssertEveryNodeIsAsReadAfresh(fleet, kept, 1);

            var craft = kept.Of(fleet.Craft[0], 1)!;
            Assert.Equal("vessel:" + fleet.Owners[fleet.Craft[0]], craft.NodeId);
            Assert.Null(craft.Planned[0].DishId);
            Assert.NotNull(craft.Planned[1].DishId);
            Assert.Equal(RaAimKind.Vessel, craft.Planned[1].Aim);
            Assert.Equal(RaAimKind.BodyCentre, craft.Planned[2].Aim);
            Assert.Equal(1, kept.Of(fleet.Stations[0], 1)!.Planned[0].GroundBodyIndex);
        }

        [Fact]
        public void ANodeNothingChangedOnIsNotReadAgain()
        {
            var fleet = FakeFleet.Build();
            var kept = new RaPlannedAntennas(Ra, fleet);
            var first = fleet.Nodes.Select(node => kept.Of(node, 1)!.Planned).ToList();
            var reads = kept.Reads;

            for (var instant = 2L; instant < 50; instant++)
            {
                for (var i = 0; i < fleet.Nodes.Count; i++)
                {
                    Assert.Same(first[i], kept.Of(fleet.Nodes[i], instant)!.Planned);
                }
            }

            Assert.Equal(fleet.Nodes.Count, reads);
            Assert.Equal(reads, kept.Reads);
        }

        [Fact]
        public void ACheckAsksRealAntennasForAFewFiguresPerAntenna()
        {
            var fleet = FakeFleet.Build();
            var kept = new RaPlannedAntennas(Ra, fleet);
            var antennas = 0;
            foreach (var craft in fleet.Craft)
            {
                antennas += kept.Of(craft, 1)!.Planned.Count;
            }

            var before = FakeReads.Count;
            foreach (var craft in fleet.Craft)
            {
                kept.Of(craft, 2);
            }
            var checkedOnce = FakeReads.Count - before;
            foreach (var craft in fleet.Craft)
            {
                kept.Of(craft, 2);
            }
            var askedTwice = FakeReads.Count - before;

            Assert.True(checkedOnce <= 6 * antennas, checkedOnce + " property reads to check " + antennas + " antennas");
            Assert.Equal(checkedOnce, askedTwice);
        }

        public static IEnumerable<object[]> Changes() => new[]
        {
            "retargeted", "target renamed", "target cleared", "tech level", "modulation", "power", "gain", "symbol rate",
            "noise temperature", "encoder", "band", "list replaced", "antenna removed", "antenna swapped", "new owner",
        }.Select(name => new object[] { name });

        private static RACommNode Change(FakeFleet fleet, string change)
        {
            var craft = fleet.Craft[3];
            var dish = (RealAntennaDigital)craft.RAAntennaList[1];
            switch (change)
            {
                case "retargeted":
                    dish.Target = new AntennaTargetVessel { vesselId = fleet.Owners[fleet.Craft[9]].ToString(), vesselName = "craft 9" };
                    return craft;
                case "target renamed":
                    ((AntennaTargetVessel)dish.Target).vesselName = "renamed";
                    return craft;
                case "target cleared":
                    dish.Target = null!;
                    return craft;
                case "tech level":
                    dish.TechLevelInfo = TechLevelInfo.GetTechLevel(8);
                    return craft;
                case "modulation":
                    dish.modulator.ModulationBits = 5;
                    return craft;
                case "power":
                    dish.TxPower = 47f;
                    return craft;
                case "gain":
                    dish.Gain = 4f;
                    return craft;
                case "symbol rate":
                    dish.SymbolRate = 12345.0;
                    return craft;
                case "noise temperature":
                    var station = fleet.Stations[2];
                    station.RAAntennaList[0].AMWTemp = 99f;
                    return station;
                case "encoder":
                    dish.EncoderOverride = "Turbo 1/6";
                    return craft;
                case "band":
                    dish.RFBand = BandInfo.Get("Ka");
                    return craft;
                case "list replaced":
                    craft.RAAntennaList = new List<RealAntenna>(craft.RAAntennaList.AsEnumerable().Reverse());
                    return craft;
                case "antenna removed":
                    craft.RAAntennaList.RemoveAt(0);
                    return craft;
                case "antenna swapped":
                    craft.RAAntennaList[0] = new RealAntennaDigital
                    {
                        Name = "new",
                        ParentNode = craft,
                        TechLevelInfo = TechLevelInfo.GetTechLevel(6),
                        Gain = 22f,
                    };
                    return craft;
                case "new owner":
                    fleet.Owners[craft] = Guid.NewGuid();
                    return craft;
                default:
                    throw new ArgumentException(change);
            }
        }

        [Theory]
        [MemberData(nameof(Changes))]
        public void AChangeRealAntennasMakesIsReadAtTheNextInstant(string change)
        {
            var fleet = FakeFleet.Build();
            var kept = new RaPlannedAntennas(Ra, fleet);
            var before = fleet.Nodes.ToDictionary(node => node, node => kept.Of(node, 1)!.Planned);
            var reads = kept.Reads;

            var changed = Change(fleet, change);

            AssertEveryNodeIsAsReadAfresh(fleet, kept, 2);
            Assert.Equal(reads + 1, kept.Reads);
            foreach (var node in fleet.Nodes)
            {
                if (ReferenceEquals(node, changed))
                {
                    Assert.NotSame(before[node], kept.Of(node, 2)!.Planned);
                }
                else
                {
                    Assert.Same(before[node], kept.Of(node, 2)!.Planned);
                }
            }
        }

        [Fact]
        public void AChangeInsideAnInstantIsReadOnceToldToCheckAgain()
        {
            var fleet = FakeFleet.Build();
            var kept = new RaPlannedAntennas(Ra, fleet);
            var craft = fleet.Craft[3];
            kept.Of(craft, 1);

            Change(fleet, "retargeted");
            kept.CheckAgain();

            AssertSame(ReflectiveOracle.Planned(Ra, craft, fleet), kept.Of(craft, 1)!.Planned, craft.Label);
        }

        [Fact]
        public void EveryReadIsToldToTheRoster()
        {
            var fleet = FakeFleet.Build();
            var told = new Dictionary<string, IReadOnlyList<RaPlannedAntenna>>();
            var kept = new RaPlannedAntennas(Ra, fleet, (key, antennas) => told[key] = antennas);

            foreach (var node in fleet.Nodes)
            {
                kept.Of(node, 1);
            }
            Change(fleet, "retargeted");
            var again = kept.Of(fleet.Craft[3], 2)!;

            Assert.Equal(fleet.Nodes.Count, told.Count);
            Assert.Same(again.Planned, told[again.NodeId!]);
            Assert.Same(kept.Of(fleet.Stations[0], 2)!.Planned, told["ground:station 0"]);
        }

        [Fact]
        public void ReachFromTheKeptFiguresEqualsReachReadAfresh()
        {
            var fleet = FakeFleet.Build(stationAntennas: 9);
            // One craft with nothing that reads, so a pair with no budget is in the comparison.
            fleet.Craft[5].RAAntennaList.Clear();
            var kept = new RaPlannedAntennas(Ra, fleet);
            var pairs = 0;
            var solved = 0;

            foreach (var from in fleet.Nodes)
            {
                foreach (var to in fleet.Nodes)
                {
                    if (ReferenceEquals(from, to))
                    {
                        continue;
                    }
                    var expected = ReflectiveOracle.Reach(Ra, from, to);
                    var actual = RaReach.BudgetReach(kept.Of(from, 1)!.Planned, kept.Of(to, 1)!.Planned);
                    Assert.Equal(expected.ModelId, actual.ModelId);
                    Assert.True(
                        Nullable.Equals(expected.MaxRangeMeters, actual.MaxRangeMeters),
                        from.Label + " to " + to.Label + ": " + actual.MaxRangeMeters + ", expected " + expected.MaxRangeMeters);
                    pairs++;
                    solved += actual.MaxRangeMeters == null ? 0 : 1;
                }
            }

            Assert.Equal(30 * 29, pairs);
            Assert.True(solved > 700, "only " + solved + " pairs had a reach to compare");
            Assert.True(solved < pairs, "no pair without a budget was compared");
        }

        [Fact]
        public void ReachFromTheKeptFiguresAsksRealAntennasNothing()
        {
            var fleet = FakeFleet.Build();
            var kept = new RaPlannedAntennas(Ra, fleet);
            var craft = kept.Of(fleet.Craft[0], 1)!.Planned;
            var station = kept.Of(fleet.Stations[0], 1)!.Planned;

            var before = FakeReads.Count;
            var reach = RaReach.BudgetReach(craft, station);

            Assert.NotNull(reach.MaxRangeMeters);
            Assert.Equal(before, FakeReads.Count);
        }

        [Fact]
        public void AnUnpoweredEndStillHasNoReach()
        {
            var fleet = FakeFleet.Build();
            var kept = new RaPlannedAntennas(Ra, fleet);
            var craft = kept.Of(fleet.Craft[0], 1)!.Planned;
            var station = kept.Of(fleet.Stations[0], 1)!.Planned;

            var reach = RaReach.Between(craft, station, false, null);

            Assert.Equal(RaReach.UnpoweredModelId, reach.ModelId);
            Assert.Equal(CommsNoReachReasons.Unpowered, (reach as ICommsNoReachReason)?.NoReachReason);
        }
    }
}
