using System;
using System.Globalization;

namespace Gonogo.RealAntennasUplink
{
    /// <summary>
    /// The id of one steered dish in a contact plan:
    /// <c>"&lt;nodeId&gt;#&lt;partPersistentId&gt;/&lt;ordinal&gt;"</c>. The part's
    /// persistent id is readable off a loaded part and off a craft's saved
    /// snapshot alike, so an id read from a plan names the same antenna after a
    /// save and a load and while its craft is on rails. It is the key the restore
    /// record of a turned dish is stored under.
    /// </summary>
    internal static class RaDishIds
    {
        /// <param name="nodeId">The craft's node id, <c>"vessel:&lt;guid&gt;"</c>.</param>
        /// <param name="partPersistentId">The persistent id of the part the antenna is on.</param>
        /// <param name="ordinal">Which of that part's antennas it is, from zero.</param>
        public static string Of(string nodeId, uint partPersistentId, int ordinal) =>
            nodeId + "#" + partPersistentId.ToString(CultureInfo.InvariantCulture) + "/" + ordinal.ToString(CultureInfo.InvariantCulture);

        /// <summary>Splits a dish id, or returns false for anything <see cref="Of"/> did not make.</summary>
        public static bool TryParse(string? dishId, out string nodeId, out uint partPersistentId, out int ordinal)
        {
            nodeId = "";
            partPersistentId = 0;
            ordinal = 0;
            if (string.IsNullOrEmpty(dishId))
            {
                return false;
            }
            var hash = dishId!.IndexOf('#');
            var slash = dishId.LastIndexOf('/');
            if (hash <= 0 || slash <= hash + 1 || slash == dishId.Length - 1)
            {
                return false;
            }
            if (!uint.TryParse(dishId.Substring(hash + 1, slash - hash - 1), NumberStyles.None, CultureInfo.InvariantCulture, out partPersistentId)
                || !int.TryParse(dishId.Substring(slash + 1), NumberStyles.None, CultureInfo.InvariantCulture, out ordinal))
            {
                return false;
            }
            nodeId = dishId.Substring(0, hash);
            return true;
        }

        /// <summary>The craft's guid from a node id, or null for a node that is not a craft.</summary>
        public static string? VesselGuid(string nodeId) =>
            nodeId.StartsWith("vessel:", StringComparison.Ordinal) ? nodeId.Substring("vessel:".Length) : null;
    }
}
