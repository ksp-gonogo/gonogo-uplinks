using System;
using System.Collections.Generic;

namespace Gonogo.RealAntennasUplink
{
    /// <summary>
    /// An antenna as the plain data a save keeps and reads back: nested
    /// dictionaries, lists, strings, numbers and booleans, with every number a
    /// double, which is how a save returns them.
    /// </summary>
    internal static class RaPlannedAntennaData
    {
        internal static List<object?> Of(IReadOnlyList<RaPlannedAntenna> antennas)
        {
            var list = new List<object?>(antennas.Count);
            foreach (var antenna in antennas)
            {
                list.Add(Of(antenna));
            }
            return list;
        }

        internal static Dictionary<string, object?> Of(RaPlannedAntenna a) => new Dictionary<string, object?>
        {
            ["id"] = a.Id,
            ["dishId"] = a.DishId,
            ["steerable"] = a.Steerable,
            ["beamwidthRadians"] = a.BeamwidthRadians,
            ["band"] = a.Band,
            ["txPowerDbm"] = a.TxPowerDbm,
            ["gainDbi"] = a.GainDbi,
            ["frequencyHz"] = a.FrequencyHz,
            ["symbolRateHz"] = a.SymbolRateHz,
            ["noiseTemperatureKelvin"] = a.NoiseTemperatureKelvin,
            ["requiredEbN0Db"] = a.RequiredEbN0Db,
            ["minSymbolRateHz"] = a.MinSymbolRateHz,
            ["modulationBits"] = Number(a.ModulationBits),
            ["techLevel"] = Number(a.TechLevel),
            ["encoderName"] = a.EncoderName,
            ["encoderTechLevel"] = Number(a.EncoderTechLevel),
            ["codingRate"] = a.CodingRate,
            ["encoderRequiredEbN0Db"] = a.EncoderRequiredEbN0Db,
            ["powerDrawEc"] = a.PowerDrawEc,
            ["aim"] = a.Aim.ToString(),
            ["aimLabel"] = a.AimLabel,
            ["aimNodeId"] = a.AimNodeId,
            ["aimBodyIndex"] = Number(a.AimBodyIndex),
        };

        /// <summary>The antennas a save kept, or null when what it kept is not a list of antennas this build wrote.</summary>
        internal static List<RaPlannedAntenna>? From(object? data)
        {
            if (!(data is List<object?> items))
            {
                return null;
            }
            var antennas = new List<RaPlannedAntenna>(items.Count);
            foreach (var item in items)
            {
                if (!(item is Dictionary<string, object?> map) || !(map.TryGetValue("steerable", out var steerable) && steerable is bool))
                {
                    return null;
                }
                antennas.Add(new RaPlannedAntenna
                {
                    Id = Text(map, "id") ?? "",
                    DishId = Text(map, "dishId"),
                    Steerable = (bool)steerable!,
                    BeamwidthRadians = Real(map, "beamwidthRadians"),
                    Band = Text(map, "band"),
                    TxPowerDbm = Real(map, "txPowerDbm"),
                    GainDbi = Real(map, "gainDbi"),
                    FrequencyHz = Real(map, "frequencyHz"),
                    SymbolRateHz = Real(map, "symbolRateHz"),
                    NoiseTemperatureKelvin = Real(map, "noiseTemperatureKelvin"),
                    RequiredEbN0Db = Real(map, "requiredEbN0Db"),
                    MinSymbolRateHz = Real(map, "minSymbolRateHz"),
                    ModulationBits = Whole(map, "modulationBits"),
                    TechLevel = Whole(map, "techLevel"),
                    EncoderName = Text(map, "encoderName"),
                    EncoderTechLevel = Whole(map, "encoderTechLevel"),
                    CodingRate = Real(map, "codingRate"),
                    EncoderRequiredEbN0Db = Real(map, "encoderRequiredEbN0Db"),
                    PowerDrawEc = Real(map, "powerDrawEc"),
                    Aim = Enum.TryParse<RaAimKind>(Text(map, "aim"), out var aim) ? aim : RaAimKind.Untargeted,
                    AimLabel = Text(map, "aimLabel"),
                    AimNodeId = Text(map, "aimNodeId"),
                    AimBodyIndex = Whole(map, "aimBodyIndex"),
                });
            }
            return antennas;
        }

        private static object? Number(int? value) => value == null ? null : (object)(double)value.Value;

        private static string? Text(Dictionary<string, object?> map, string key) => map.TryGetValue(key, out var v) ? v as string : null;

        private static double? Real(Dictionary<string, object?> map, string key) => map.TryGetValue(key, out var v) && v is double d ? d : (double?)null;

        private static int? Whole(Dictionary<string, object?> map, string key) => Real(map, key) is double d ? (int)d : (int?)null;
    }
}
