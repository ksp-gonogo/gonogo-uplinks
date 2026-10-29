// GonogoKosUplink: GPLv3. See GonogoKosUplink.csproj's header comment for the
// licence/linkage rationale.

using System;
using System.Collections.Generic;

namespace Gonogo.KosUplink
{
    /// <summary>
    /// Works out which craft each kOS CPU is aboard from one pass over the
    /// processors, for routing a CPU's topics and commands to that craft.
    ///
    /// <para>A CPU still listed whose part has no vessel for a pass keeps the
    /// craft it was last seen on: staging detaches parts and builds a new
    /// vessel over a few frames, and dropping the entry then would hold the
    /// terminal's topic and refuse its commands until a later pass maps the
    /// CPU again. A CPU no longer listed leaves the map.</para>
    ///
    /// <para>KSP-free by construction, so it is exercised headlessly.</para>
    /// </summary>
    public static class KosCoreVesselMap
    {
        /// <summary>
        /// The map for the next pass. <paramref name="observed"/> holds every
        /// listed CPU's core id with the vessel id its part reports, or null
        /// when the part has none.
        /// </summary>
        public static Dictionary<string, string> Next(
            IReadOnlyDictionary<string, string> previous,
            IEnumerable<KeyValuePair<string, string?>> observed)
        {
            var next = new Dictionary<string, string>(StringComparer.Ordinal);
            foreach (var entry in observed)
            {
                if (!string.IsNullOrEmpty(entry.Value))
                {
                    next[entry.Key] = entry.Value!;
                }
                else if (previous.TryGetValue(entry.Key, out var last))
                {
                    next[entry.Key] = last;
                }
            }
            return next;
        }
    }
}
