using System;
using System.Collections;
using System.Collections.Generic;

namespace GonogoPrincipiaUplink
{
    /// <summary>
    /// How a Principia build names a body in the structs it hands back, and the game's
    /// own body index that name stands for.
    ///
    /// <para>Up to 2026101016-Lichnerowicz a slot is <c>&lt;stem&gt;_index</c> and holds
    /// the game's body index. From 2026110907-Lie it is <c>&lt;stem&gt;_city</c> and holds
    /// the <see cref="CityHash"/> of the body's name. Everything this Uplink publishes
    /// is the game's index, whichever the build holds.</para>
    /// </summary>
    public static class PrincipiaBodyKeys
    {
        /// <summary>What a slot named by index holds when it names no body.</summary>
        public const int NoBody = -1;

        public static string IndexField(string stem) => stem + "_index";

        public static string CityField(string stem) => stem + "_city";

        /// <summary>
        /// The raw value of the slot, under whichever of its two names the struct has,
        /// or null when it has neither or the slot is unset.
        /// </summary>
        public static object? Read(Func<string, object?> read, string stem)
        {
            return read(CityField(stem)) ?? read(IndexField(stem));
        }

        /// <summary>
        /// The game's body index one raw key names, or null when it names none this
        /// game has. An index is taken as it is; a city is looked up by name.
        /// </summary>
        public static int? IndexOf(object? key, ICelestialNames celestials)
        {
            switch (key)
            {
                case int index:
                    return index;
                case ulong city:
                    return celestials.IndexOfCity(city);
                default:
                    return null;
            }
        }

        /// <summary>
        /// Every body index a slot holds, in order, for a slot that is one key or a set
        /// of them. A key that names no body ends the read: half a set published as a
        /// whole one is worse than none.
        /// </summary>
        public static List<int> AllIndices(object? value, ICelestialNames celestials)
        {
            var found = new List<int>();
            if (value is int || value is ulong)
            {
                var single = IndexOf(value, celestials);
                if (single != null)
                {
                    found.Add(single.Value);
                }
                return found;
            }
            if (value is IEnumerable items)
            {
                foreach (var item in items)
                {
                    var index = IndexOf(item, celestials);
                    if (index == null)
                    {
                        break;
                    }
                    found.Add(index.Value);
                }
            }
            return found;
        }
    }
}
