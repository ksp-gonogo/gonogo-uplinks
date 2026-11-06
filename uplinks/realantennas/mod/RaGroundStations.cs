using System;
using System.Collections.Generic;
using System.Reflection;
using CommNet;
using Sitrep.Contract;

namespace Gonogo.RealAntennasUplink
{
    /// <summary>
    /// The ground stations of the network, with RealAntennas' own facts about
    /// each in its extension bag. The place of a station comes off the stock
    /// <c>CommNetHome</c> RealAntennas builds its station nodes from; the bag
    /// comes off the antennas on that node.
    ///
    /// <para>Main thread only: it reads live Unity objects. The set of homes is
    /// found by a scene search, so it is looked for again at most once every few
    /// seconds, while each pass still reads the antennas, so a station upgrade
    /// shows within one search interval.</para>
    /// </summary>
    internal sealed class RaGroundStations
    {
        private const float SearchIntervalSeconds = 5f;

        private static readonly FieldInfo? CommField = typeof(CommNetHome).GetField("comm", BindingFlags.NonPublic | BindingFlags.Instance);
        private static readonly FieldInfo? BodyField = typeof(CommNetHome).GetField("body", BindingFlags.NonPublic | BindingFlags.Instance);
        private static readonly FieldInfo? LatitudeField = typeof(CommNetHome).GetField("lat", BindingFlags.NonPublic | BindingFlags.Instance);
        private static readonly FieldInfo? LongitudeField = typeof(CommNetHome).GetField("lon", BindingFlags.NonPublic | BindingFlags.Instance);

        private readonly RaReflection _ra;
        private CommNetHome[] _homes = new CommNetHome[0];
        private float _searchedAt = float.NegativeInfinity;

        public RaGroundStations(RaReflection ra)
        {
            _ra = ra;
        }

        /// <summary>Every home with a node, in the order the scene lists them.</summary>
        public IReadOnlyList<CommsGroundStation> Read()
        {
            var now = UnityEngine.Time.realtimeSinceStartup;
            if (now - _searchedAt >= SearchIntervalSeconds)
            {
                _homes = UnityEngine.Object.FindObjectsOfType<CommNetHome>();
                _searchedAt = now;
            }

            var stations = new List<CommsGroundStation>();
            foreach (var home in _homes)
            {
                if (home == null)
                {
                    continue;
                }
                var comm = CommField?.GetValue(home) as CommNode;
                if (comm == null)
                {
                    continue;
                }
                var body = BodyField?.GetValue(home) as CelestialBody;
                var latitude = LatitudeField?.GetValue(home) as double?;
                var longitude = LongitudeField?.GetValue(home) as double?;
                var placed = body != null && latitude != null && longitude != null
                    && !double.IsNaN(latitude.Value) && !double.IsNaN(longitude.Value);
                var techLevels = new List<int?>();
                foreach (var antenna in _ra.NodeAntennas(comm))
                {
                    techLevels.Add(_ra.TechLevel(antenna));
                }
                stations.Add(new CommsGroundStation
                {
                    Id = RaCommsBackend.NodeId(comm),
                    Name = RaCommsBackend.NodeDisplayName(comm),
                    BodyName = placed ? body!.name : null,
                    Latitude = placed ? latitude : null,
                    Longitude = placed ? WrapLongitude(longitude!.Value) : null,
                    Extensions = Bag(techLevels),
                });
            }
            return stations;
        }

        /// <summary>
        /// The station's <c>"realantennas"</c> extension bag: its tech level, the
        /// highest among its antennas, and how many it carries. A station whose
        /// antennas cannot be listed gets no bag, and a station with antennas but
        /// no readable level gets a count alone.
        /// </summary>
        public static Dictionary<string, object?>? Bag(IReadOnlyList<int?> antennaTechLevels)
        {
            if (antennaTechLevels.Count == 0)
            {
                return null;
            }
            int? highest = null;
            foreach (var level in antennaTechLevels)
            {
                if (level != null && (highest == null || level.Value > highest.Value))
                {
                    highest = level;
                }
            }
            return new Dictionary<string, object?>
            {
                [RaHopExtensions.ProviderId] = new Dictionary<string, object?>
                {
                    ["techLevel"] = highest,
                    ["antennaCount"] = antennaTechLevels.Count,
                },
            };
        }

        /// <summary>A longitude wrapped to (-180, 180], the range every geographic value on the wire uses.</summary>
        public static double WrapLongitude(double degrees)
        {
            var wrapped = degrees % 360.0;
            if (wrapped > 180.0)
            {
                wrapped -= 360.0;
            }
            else if (wrapped <= -180.0)
            {
                wrapped += 360.0;
            }
            return wrapped;
        }
    }
}
