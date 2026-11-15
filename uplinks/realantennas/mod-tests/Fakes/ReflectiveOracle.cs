#nullable disable
using System;
using System.Collections.Generic;
using Gonogo.RealAntennasUplink;
using Sitrep.Contract;

namespace GonogoRealAntennasUplink.Tests.Fakes
{
    /// <summary>
    /// The antenna read and the reach solve done the long way, every figure
    /// taken from RealAntennas by reflection at the moment it is wanted and
    /// nothing kept. What the kept lists and the kept reach must always equal.
    /// </summary>
    internal static class ReflectiveOracle
    {
        public static List<RaPlannedAntenna> Planned(RaReflection ra, object node, IRaNodeFacts game)
        {
            var planned = new List<RaPlannedAntenna>();
            var index = 0;
            var antennas = ra.NodeAntennas(node);
            var nodeId = game.VesselNodeId(node);
            var parts = nodeId == null ? null : game.PartIds(node, antennas);
            foreach (var antenna in antennas)
            {
                var one = new RaPlannedAntenna
                {
                    Id = index++.ToString(),
                    Steerable = ra.Steerable(antenna) == true,
                    BeamwidthRadians = ra.Beamwidth(antenna) * (Math.PI / 180.0),
                    Band = ra.BandName(antenna),
                    TxPowerDbm = ra.TxPower(antenna),
                    GainDbi = ra.Gain(antenna),
                    FrequencyHz = ra.Frequency(antenna),
                    SymbolRateHz = ra.SymbolRate(antenna),
                    NoiseTemperatureKelvin = ra.NoiseTemperatureKelvin(antenna),
                    RequiredEbN0Db = ra.RequiredEbN0Db(antenna),
                    MinSymbolRateHz = ra.MinSymbolRate(antenna),
                    ModulationBits = ra.ModulationBits(antenna),
                    TechLevel = ra.TechLevel(antenna),
                    EncoderName = ra.EncoderName(antenna),
                    EncoderTechLevel = ra.EncoderTechLevel(antenna),
                    CodingRate = ra.CodingRate(antenna),
                    EncoderRequiredEbN0Db = ra.EncoderRequiredEbN0Db(antenna),
                    PowerDrawEc = ra.PowerDrawEcPerSecond(antenna),
                    AimLabel = ra.Target(antenna)?.ToString(),
                };
                var part = parts?[planned.Count];
                if (nodeId != null && part != null && one.Steerable)
                {
                    one.DishId = RaDishIds.Of(nodeId, part.Value.Part, part.Value.Ordinal);
                }
                Aim(ra, game, ra.Target(antenna), one);
                one.GroundBodyIndex = game.GroundBodyIndex(node);
                planned.Add(one);
            }
            return planned;
        }

        private static void Aim(RaReflection ra, IRaNodeFacts game, object target, RaPlannedAntenna antenna)
        {
            antenna.Aim = RaAimKind.Unplaced;
            if (target == null || !antenna.Steerable)
            {
                antenna.Aim = RaAimKind.Untargeted;
                return;
            }
            switch (ra.TargetKind(target))
            {
                case "Vessel":
                    if (!Guid.TryParse(ra.TargetVesselId(target), out var guid))
                    {
                        return;
                    }
                    antenna.Aim = RaAimKind.Vessel;
                    antenna.AimNodeId = "vessel:" + guid;
                    return;
                case "BodyLatLonAlt":
                    var body = game.Body(ra.TargetBodyName(target));
                    var altitude = ra.TargetLatLonAlt(target).Altitude;
                    if (body == null || altitude == null || Math.Abs(altitude.Value + body.Value.RadiusMeters) > 1.0)
                    {
                        return;
                    }
                    antenna.Aim = RaAimKind.BodyCentre;
                    antenna.AimBodyIndex = body.Value.Index;
                    return;
                default:
                    return;
            }
        }

        public static ICommsReachModel Reach(RaReflection ra, object from, object to)
        {
            var fromAntennas = ra.NodeAntennas(from);
            var toAntennas = ra.NodeAntennas(to);
            if (fromAntennas.Count == 0 || toAntennas.Count == 0)
            {
                return CommsReachModels.Unknown;
            }
            var forward = BestDirection(ra, fromAntennas, toAntennas);
            var reverse = BestDirection(ra, toAntennas, fromAntennas);
            if (forward == null || reverse == null)
            {
                return CommsReachModels.Unknown;
            }
            return new MaxRangeReachModel(RaReach.ModelId, RaReach.ModelName, Math.Min(forward.Value, reverse.Value));
        }

        private static double? BestDirection(RaReflection ra, IReadOnlyList<object> transmitters, IReadOnlyList<object> receivers)
        {
            double? best = null;
            foreach (var tx in transmitters)
            {
                var txPower = ra.TxPower(tx);
                var txGain = ra.Gain(tx);
                var frequency = ra.Frequency(tx);
                var symbolRate = ra.SymbolRate(tx);
                if (txPower == null || txGain == null || frequency == null || symbolRate == null)
                {
                    continue;
                }
                foreach (var rx in receivers)
                {
                    var rxGain = ra.Gain(rx);
                    if (rxGain == null)
                    {
                        continue;
                    }
                    var rxRate = ra.SymbolRate(rx);
                    var slowest = RaRateLadder.SlowestCommonSymbolRate(
                        symbolRate, ra.MinSymbolRate(tx), rxRate ?? symbolRate, rxRate == null ? ra.MinSymbolRate(tx) : ra.MinSymbolRate(rx));
                    if (slowest == null)
                    {
                        continue;
                    }
                    var txLevel = ra.EncoderTechLevel(tx);
                    var rxLevel = ra.EncoderTechLevel(rx);
                    var encoderEnd = txLevel != null && rxLevel != null && rxLevel.Value < txLevel.Value ? rx : tx;
                    var range = RaLinkBudget.MaxRangeMeters(
                        txPower.Value,
                        txGain.Value,
                        rxGain.Value,
                        frequency.Value,
                        ra.NoiseTemperatureKelvin(rx) ?? 200.0,
                        slowest.Value,
                        ra.EncoderRequiredEbN0Db(encoderEnd) ?? ra.RequiredEbN0Db(rx) ?? 2.5);
                    if (range != null && (best == null || range.Value > best.Value))
                    {
                        best = range;
                    }
                }
            }
            return best;
        }
    }
}
