using System;
using System.Collections.Generic;

namespace Gonogo.KerbcastUplink
{
    /// <summary>
    /// Where one craft was at one instant, by surface position or by body-relative
    /// state. Plain numbers only, so reading the game into it never loads Kerbcast.API.
    /// </summary>
    public readonly struct CraftPlace
    {
        private CraftPlace(double ut, int bodyIndex, bool onSurface, double latitude, double longitude, double altitude, double[] state)
        {
            Ut = ut;
            BodyIndex = bodyIndex;
            OnSurface = onSurface;
            Latitude = latitude;
            Longitude = longitude;
            Altitude = altitude;
            State6 = state;
        }

        /// <summary>A craft on the ground or the water, carried by the body's rotation.</summary>
        private static readonly double[] NoState = new double[0];

        public static CraftPlace Surface(double ut, int bodyIndex, double latitude, double longitude, double altitude) =>
            new CraftPlace(ut, bodyIndex, true, latitude, longitude, altitude, NoState);

        /// <summary>A craft in flight, by body-relative position and velocity in KSP's fixed inertial frame.</summary>
        public static CraftPlace State(double ut, int bodyIndex, double x, double y, double z, double vx, double vy, double vz) =>
            new CraftPlace(ut, bodyIndex, false, 0.0, 0.0, 0.0, new[] { x, y, z, vx, vy, vz });

        /// <summary>Game time the place was read.</summary>
        public double Ut { get; }

        public int BodyIndex { get; }

        /// <summary>True for a <see cref="Surface"/> place, false for a <see cref="State"/> one.</summary>
        public bool OnSurface { get; }

        public double Latitude { get; }

        public double Longitude { get; }

        public double Altitude { get; }

        /// <summary>Position then velocity, six numbers; empty for a surface place.</summary>
        public double[] State6 { get; }
    }

    /// <summary>
    /// Where each craft was, read off the game as it ran, so a command centre's
    /// view of a craft can be placed at the instant that centre last heard or saw
    /// it. A craft's place at a past instant is the latest place read at or before
    /// that instant. Kept coarser as it grows: when a craft's record fills, every
    /// second place is dropped and the spacing between kept places doubles, so the
    /// oldest places stay at the cost of resolution. Main thread only.
    /// </summary>
    public sealed class CraftPlaces
    {
        public const int MaxPerCraft = 2048;

        private const double BaseSpacingSeconds = 1.0;

        private readonly Dictionary<Guid, Record> _craft = new Dictionary<Guid, Record>();

        /// <summary>Whether a place at <paramref name="ut"/> would be kept for <paramref name="vesselId"/>, so a caller can skip reading the game for one that would not.</summary>
        public bool Wants(Guid vesselId, double ut) =>
            !_craft.TryGetValue(vesselId, out var record)
            || record.Places.Count == 0
            || ut - record.Places[record.Places.Count - 1].Ut >= record.Spacing;

        /// <summary>Records a place. One no later than the last kept for the craft, or closer to it than the current spacing, is ignored.</summary>
        public void Learn(Guid vesselId, CraftPlace place)
        {
            if (vesselId == Guid.Empty)
            {
                return;
            }
            if (!_craft.TryGetValue(vesselId, out var record))
            {
                record = new Record();
                _craft[vesselId] = record;
            }
            var places = record.Places;
            if (places.Count > 0 && place.Ut - places[places.Count - 1].Ut < record.Spacing)
            {
                return;
            }
            places.Add(place);
            if (places.Count > MaxPerCraft)
            {
                var kept = new List<CraftPlace>(places.Count / 2 + 1);
                for (var i = 0; i < places.Count; i++)
                {
                    if (i % 2 == 0 || i == places.Count - 1)
                    {
                        kept.Add(places[i]);
                    }
                }
                record.Places = kept;
                record.Spacing *= 2.0;
            }
        }

        /// <summary>The latest place read at or before <paramref name="ut"/>, or false when the craft has none that early.</summary>
        public bool TryAt(Guid vesselId, double ut, out CraftPlace place)
        {
            place = default;
            if (!_craft.TryGetValue(vesselId, out var record))
            {
                return false;
            }
            var places = record.Places;
            var low = 0;
            var high = places.Count - 1;
            var found = -1;
            while (low <= high)
            {
                var mid = (low + high) / 2;
                if (places[mid].Ut <= ut)
                {
                    found = mid;
                    low = mid + 1;
                }
                else
                {
                    high = mid - 1;
                }
            }
            if (found < 0)
            {
                return false;
            }
            place = places[found];
            return true;
        }

        /// <summary>Forgets every craft, as when another game is loaded.</summary>
        public void Clear() => _craft.Clear();

        /// <summary>Forgets places read after <paramref name="ut"/>, as when game time goes backwards.</summary>
        public void DropAfter(double ut)
        {
            foreach (var record in _craft.Values)
            {
                record.Places.RemoveAll(p => p.Ut > ut);
            }
        }

        private sealed class Record
        {
            public List<CraftPlace> Places = new List<CraftPlace>();

            public double Spacing = BaseSpacingSeconds;
        }
    }
}
