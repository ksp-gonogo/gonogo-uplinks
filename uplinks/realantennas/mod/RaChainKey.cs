using System;
using System.Globalization;

namespace Gonogo.RealAntennasUplink
{
    /// <summary>
    /// The name a chain is kept under: the craft, the part its antenna is on,
    /// and which of that part's antennas it is.
    ///
    /// <para>A chain was kept under the address the targeting commands use,
    /// which is made from the part's flight id while the craft is loaded and
    /// from the antenna's position in the list while it is not. So a craft
    /// that unloaded lost sight of its own chain until it loaded again. The
    /// part's persistent id is readable in both states, off the part or off
    /// its saved snapshot, so a key made from it finds the chain either
    /// way.</para>
    ///
    /// <para>A part keeps its persistent id when its craft docks, undocks or
    /// is renamed, and the game keeps those ids unique within a save. The
    /// craft's id is in the key to say where the antenna was last seen, and
    /// <see cref="SamePart"/> is what recognises it on another craft.</para>
    /// </summary>
    internal static class RaChainKey
    {
        private const string Prefix = "craft/";

        /// <param name="vesselId">The craft's id, as the game writes it.</param>
        /// <param name="partPersistentId">The persistent id of the part the antenna is on.</param>
        /// <param name="ordinal">Which of that part's antennas it is, from zero.</param>
        public static string Of(string vesselId, uint partPersistentId, int ordinal) =>
            Prefix + vesselId + "/" + PartOf(partPersistentId, ordinal);

        /// <summary>Whether a key was made by <see cref="Of"/>, and not an address a chain was kept under before.</summary>
        public static bool IsStable(string? key) =>
            key != null && key.StartsWith(Prefix, StringComparison.Ordinal);

        /// <summary>Whether two keys name the same antenna of the same part, whichever craft each was last seen on.</summary>
        public static bool SamePart(string? a, string? b)
        {
            var partA = PartIn(a);
            return partA != null && partA == PartIn(b);
        }

        /// <summary>The part's persistent id and the ordinal a key ends with, or null for anything <see cref="Of"/> did not make.</summary>
        public static (uint Part, int Ordinal)? PartAndOrdinal(string? key)
        {
            var tail = PartIn(key);
            if (tail == null)
            {
                return null;
            }
            var slash = tail.IndexOf('/');
            return slash > 0
                && uint.TryParse(tail.Substring(0, slash), NumberStyles.None, CultureInfo.InvariantCulture, out var part)
                && int.TryParse(tail.Substring(slash + 1), NumberStyles.None, CultureInfo.InvariantCulture, out var ordinal)
                    ? (part, ordinal)
                    : ((uint, int)?)null;
        }

        private static string PartOf(uint partPersistentId, int ordinal) =>
            partPersistentId.ToString(CultureInfo.InvariantCulture) + "/" + ordinal.ToString(CultureInfo.InvariantCulture);

        /// <summary>The part and ordinal a key ends with, or null for anything <see cref="Of"/> did not make.</summary>
        private static string? PartIn(string? key)
        {
            if (!IsStable(key))
            {
                return null;
            }
            var ordinalAt = key!.LastIndexOf('/');
            var partAt = ordinalAt <= 0 ? -1 : key.LastIndexOf('/', ordinalAt - 1);
            return partAt < Prefix.Length ? null : key.Substring(partAt + 1);
        }
    }
}
