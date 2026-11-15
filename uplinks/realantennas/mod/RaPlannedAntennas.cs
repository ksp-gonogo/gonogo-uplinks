using System;
using System.Collections.Generic;
using System.Runtime.CompilerServices;

namespace Gonogo.RealAntennasUplink
{
    /// <summary>What the antenna read needs from the game and cannot get from RealAntennas: who owns a node, which part an antenna is on, and where a named body is.</summary>
    internal interface IRaNodeFacts
    {
        /// <summary>The node's plan id, <c>"vessel:&lt;guid&gt;"</c>, or null for a node no vessel owns.</summary>
        string? VesselNodeId(object node);

        /// <summary>The key a ground node's antennas are kept under, or null for a node that is not one.</summary>
        string? GroundKey(object node);

        /// <summary>The part and the ordinal on that part of each of <paramref name="antennas"/>, null for one whose part cannot be read. Asked only for a node a vessel owns.</summary>
        (uint Part, int Ordinal)?[] PartIds(object node, IReadOnlyList<object> antennas);

        /// <summary>The index of the body a ground node stands on, or null for any other node.</summary>
        int? GroundBodyIndex(object node);

        /// <summary>The index and radius in metres of the body called <paramref name="name"/>, or null when there is none.</summary>
        (int Index, double RadiusMeters)? Body(string? name);
    }

    /// <summary>
    /// Each node's antennas as the plan reads them, kept until RealAntennas
    /// changes one. A node's list is read in full once, then checked against a
    /// short signature at most once per instant: the antenna objects, the
    /// figures RealAntennas can change on one in place, and what each is aimed
    /// at. While the signature holds, the same list is handed back, so anything
    /// worked out from a list can be kept for as long as the list is.
    ///
    /// <para>Main thread only. A list is never edited once made.</para>
    /// </summary>
    internal sealed class RaPlannedAntennas
    {
        /// <summary>One node's antennas and what they were read from.</summary>
        internal sealed class Entry
        {
            internal Entry(List<RaPlannedAntenna> planned, string? nodeId, object? list, Mark[] marks)
            {
                Planned = planned;
                NodeId = nodeId;
                List = list;
                Marks = marks;
            }

            /// <summary>The antennas, in RealAntennas' own order.</summary>
            public List<RaPlannedAntenna> Planned { get; }

            /// <summary>The node's plan id, or null for a node no vessel owns.</summary>
            public string? NodeId { get; }

            internal object? List { get; }

            internal Mark[] Marks { get; }

            internal long CheckedAt { get; set; }

            internal long CheckedEpoch { get; set; }
        }

        /// <summary>What is compared of one antenna to tell whether it has to be read again.</summary>
        internal struct Mark
        {
            public object Antenna;
            public double? Gain;
            public double? TxPower;
            public double? SymbolRate;
            public double? AmwTemp;
            public string? EncoderOverride;
            public int? ModulationBits;
            public object? Band;
            public object? TechLevel;
            public object? Modulator;
            public object? Target;
            public string? AimLabel;
        }

        private readonly RaReflection _ra;
        private readonly IRaNodeFacts _game;
        private readonly Action<string, IReadOnlyList<RaPlannedAntenna>>? _onRead;
        private readonly ConditionalWeakTable<object, Entry> _entries = new ConditionalWeakTable<object, Entry>();
        private long _epoch;

        /// <param name="onRead">Called with a node's key and its antennas each time they are read afresh.</param>
        public RaPlannedAntennas(RaReflection ra, IRaNodeFacts game, Action<string, IReadOnlyList<RaPlannedAntenna>>? onRead = null)
        {
            _ra = ra;
            _game = game;
            _onRead = onRead;
        }

        /// <summary>How many times a node's antennas have been read in full, which rises only when something about a node changed.</summary>
        public long Reads { get; private set; }

        /// <summary>Has every node checked again on its next ask, whatever instant it was last checked at. For a change this Uplink made itself, such as a dish it turned.</summary>
        public void CheckAgain() => _epoch++;

        /// <summary>
        /// The node's antennas as they stand at <paramref name="instant"/>, or
        /// null for no node. Two asks at one instant are answered from one check,
        /// so the many pairs a capture asks about a node cost one.
        /// </summary>
        /// <param name="instant">A number that differs whenever the game may have changed since the last ask, such as the frame count.</param>
        public Entry? Of(object? node, long instant)
        {
            if (node == null)
            {
                return null;
            }
            if (_entries.TryGetValue(node, out var entry))
            {
                if (entry.CheckedAt == instant && entry.CheckedEpoch == _epoch)
                {
                    return entry;
                }
                if (Unchanged(node, entry))
                {
                    entry.CheckedAt = instant;
                    entry.CheckedEpoch = _epoch;
                    return entry;
                }
                _entries.Remove(node);
            }
            entry = Read(node);
            entry.CheckedAt = instant;
            entry.CheckedEpoch = _epoch;
            _entries.Add(node, entry);
            return entry;
        }

        private bool Unchanged(object node, Entry entry)
        {
            if (!ReferenceEquals(_ra.ReadPublicMember(node, "RAAntennaList"), entry.List)
                || !string.Equals(_game.VesselNodeId(node), entry.NodeId, StringComparison.Ordinal))
            {
                return false;
            }
            var antennas = _ra.NodeAntennas(node);
            if (antennas.Count != entry.Marks.Length)
            {
                return false;
            }
            for (var i = 0; i < antennas.Count; i++)
            {
                if (!Same(entry.Marks[i], MarkOf(antennas[i])))
                {
                    return false;
                }
            }
            return true;
        }

        private Mark MarkOf(object antenna)
        {
            var modulator = _ra.Modulator(antenna);
            var target = _ra.Target(antenna);
            return new Mark
            {
                Antenna = antenna,
                Gain = _ra.Gain(antenna),
                TxPower = _ra.TxPower(antenna),
                SymbolRate = _ra.SymbolRate(antenna),
                AmwTemp = _ra.AmwTemp(antenna),
                EncoderOverride = _ra.EncoderOverride(antenna),
                ModulationBits = modulator == null ? null : _ra.ReadPublicMember(modulator, "ModulationBits") as int?,
                Band = _ra.Band(antenna),
                TechLevel = _ra.TechLevelInfo(antenna),
                Modulator = modulator,
                Target = target,
                AimLabel = target?.ToString(),
            };
        }

        private static bool Same(Mark a, Mark b) =>
            ReferenceEquals(a.Antenna, b.Antenna)
            && Nullable.Equals(a.Gain, b.Gain)
            && Nullable.Equals(a.TxPower, b.TxPower)
            && Nullable.Equals(a.SymbolRate, b.SymbolRate)
            && Nullable.Equals(a.AmwTemp, b.AmwTemp)
            && string.Equals(a.EncoderOverride, b.EncoderOverride, StringComparison.Ordinal)
            && a.ModulationBits == b.ModulationBits
            && ReferenceEquals(a.Band, b.Band)
            && ReferenceEquals(a.TechLevel, b.TechLevel)
            && ReferenceEquals(a.Modulator, b.Modulator)
            && ReferenceEquals(a.Target, b.Target)
            && string.Equals(a.AimLabel, b.AimLabel, StringComparison.Ordinal);

        private Entry Read(object node)
        {
            Reads++;
            var list = _ra.ReadPublicMember(node, "RAAntennaList");
            var antennas = _ra.NodeAntennas(node);
            var marks = new Mark[antennas.Count];
            for (var i = 0; i < antennas.Count; i++)
            {
                marks[i] = MarkOf(antennas[i]);
            }

            var planned = new List<RaPlannedAntenna>();
            var index = 0;
            var nodeId = _game.VesselNodeId(node);
            var parts = nodeId == null ? null : _game.PartIds(node, antennas);
            var groundBody = _game.GroundBodyIndex(node);
            foreach (var antenna in antennas)
            {
                var target = _ra.Target(antenna);
                var one = new RaPlannedAntenna
                {
                    Id = index++.ToString(),
                    Steerable = _ra.Steerable(antenna) == true,
                    BeamwidthRadians = _ra.Beamwidth(antenna) * (Math.PI / 180.0),
                    Band = _ra.BandName(antenna),
                    TxPowerDbm = _ra.TxPower(antenna),
                    GainDbi = _ra.Gain(antenna),
                    FrequencyHz = _ra.Frequency(antenna),
                    SymbolRateHz = _ra.SymbolRate(antenna),
                    NoiseTemperatureKelvin = _ra.NoiseTemperatureKelvin(antenna),
                    RequiredEbN0Db = _ra.RequiredEbN0Db(antenna),
                    MinSymbolRateHz = _ra.MinSymbolRate(antenna),
                    ModulationBits = _ra.ModulationBits(antenna),
                    TechLevel = _ra.TechLevel(antenna),
                    EncoderName = _ra.EncoderName(antenna),
                    EncoderTechLevel = _ra.EncoderTechLevel(antenna),
                    CodingRate = _ra.CodingRate(antenna),
                    EncoderRequiredEbN0Db = _ra.EncoderRequiredEbN0Db(antenna),
                    PowerDrawEc = _ra.PowerDrawEcPerSecond(antenna),
                    AimLabel = target?.ToString(),
                };
                var part = parts?[planned.Count];
                if (nodeId != null && part != null && one.Steerable)
                {
                    one.DishId = RaDishIds.Of(nodeId, part.Value.Part, part.Value.Ordinal);
                }
                Aim(target, one);
                one.GroundBodyIndex = groundBody;
                planned.Add(one);
            }

            var key = nodeId ?? _game.GroundKey(node);
            if (key != null)
            {
                _onRead?.Invoke(key, planned);
            }
            return new Entry(planned, nodeId, list, marks);
        }

        /// <summary>Fills in where <paramref name="antenna"/> points, <see cref="RaAimKind.Unplaced"/> for an aim the plan cannot place.</summary>
        private void Aim(object? target, RaPlannedAntenna antenna)
        {
            antenna.Aim = RaAimKind.Unplaced;
            if (target == null || !antenna.Steerable)
            {
                antenna.Aim = RaAimKind.Untargeted;
                return;
            }
            switch (_ra.TargetKind(target))
            {
                case "Vessel":
                    if (!Guid.TryParse(_ra.TargetVesselId(target), out var guid))
                    {
                        return;
                    }
                    antenna.Aim = RaAimKind.Vessel;
                    antenna.AimNodeId = "vessel:" + guid;
                    return;
                case "BodyLatLonAlt":
                    var body = _game.Body(_ra.TargetBodyName(target));
                    var altitude = _ra.TargetLatLonAlt(target).Altitude;
                    // RA stores a body-centre aim as the point one radius below the surface.
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
    }
}
