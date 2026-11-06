using System.Collections.Generic;
using System.Globalization;

namespace Gonogo.RealAntennasUplink
{
    /// <summary>
    /// The address of an antenna on <c>realantennas.antennas</c> and on a hop's
    /// extension bag: the flight id of its part, and an ordinal that separates
    /// several antennas on one part (<c>"1234567890/0"</c>).
    /// </summary>
    internal static class RaAntennaIds
    {
        /// <summary>
        /// The ids of a node's antennas, in list order. An antenna whose part
        /// cannot be read (<c>null</c> flight id) falls back to
        /// <c>"index/&lt;n&gt;"</c>, the position in the list.
        /// </summary>
        public static string[] ForList(IReadOnlyList<string?> flightIds)
        {
            var ids = new string[flightIds.Count];
            var seen = new Dictionary<string, int>();
            for (var i = 0; i < flightIds.Count; i++)
            {
                var flightId = flightIds[i];
                if (flightId == null)
                {
                    ids[i] = "index/" + i.ToString(CultureInfo.InvariantCulture);
                    continue;
                }
                seen.TryGetValue(flightId, out var ordinal);
                seen[flightId] = ordinal + 1;
                ids[i] = flightId + "/" + ordinal.ToString(CultureInfo.InvariantCulture);
            }
            return ids;
        }

        /// <summary>
        /// The id of the antenna at <paramref name="index"/> in its node's list,
        /// or null when its part cannot be read, since the position in a list the
        /// reader does not hold names nothing.
        /// </summary>
        public static string? Of(IReadOnlyList<string?> flightIds, int index)
        {
            if (index < 0 || index >= flightIds.Count || flightIds[index] == null)
            {
                return null;
            }
            return ForList(flightIds)[index];
        }
    }
}
