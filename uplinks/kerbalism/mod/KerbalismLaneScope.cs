using System;
using System.Collections.Generic;

namespace Gonogo.KerbalismUplink
{
    /// <summary>
    /// Which Kerbalism channels describe the active craft and so keep a reading
    /// per craft, and which craft the background read takes next. KSP-free so
    /// both choices are testable, and each is made in one place.
    /// </summary>
    public static class KerbalismLaneScope
    {
        /// <summary>The shortest UT between two background reads of one craft.</summary>
        public const double IntervalUt = 30.0;

        /*
         * The channels that read one craft's own systems. Space weather is the sun's,
         * diagnostics carries Kerbalism's game-wide message log beside the craft's
         * devices, and an EVA reading is the kerbal outside, so none of them follows a
         * craft. Reliability follows for the craft switched back to, though only a
         * loaded craft's parts can be read for it.
         */
        private static readonly HashSet<string> Following = new HashSet<string>(StringComparer.Ordinal)
        {
            "kerbalism.lifesupport",
            "kerbalism.crew",
            "kerbalism.transmission",
            "kerbalism.reliability",
        };

        /// <summary>Whether <paramref name="topic"/> keeps a reading per craft and follows the active one on screen.</summary>
        public static bool Follows(string topic) => Following.Contains(topic);

        /// <summary>
        /// The next craft in <paramref name="craft"/>, after <paramref name="cursor"/>,
        /// that has not been read in the last <paramref name="intervalUt"/>, or null
        /// when none is due. Moves the cursor to it and records it as read at
        /// <paramref name="ut"/>. A read stamped after <paramref name="ut"/> belongs
        /// to a timeline a load abandoned, so that craft is due.
        /// </summary>
        public static string? NextDue(
            IReadOnlyList<string> craft,
            IDictionary<string, double> lastReadUt,
            ref int cursor,
            double ut,
            double intervalUt = IntervalUt)
        {
            for (var tried = 0; tried < craft.Count; tried++)
            {
                cursor = (cursor + 1) % craft.Count;
                var id = craft[cursor];
                if (lastReadUt.TryGetValue(id, out var last) && ut - last < intervalUt && ut >= last)
                {
                    continue;
                }
                lastReadUt[id] = ut;
                return id;
            }
            return null;
        }
    }
}
