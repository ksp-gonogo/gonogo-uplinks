using System.Collections.Generic;
using Sitrep.Contract;

namespace GonogoRp1Uplink
{
    /// <summary>
    /// What <c>rp1.build.quote</c> has already worked out, so asking again for
    /// the same build does not load the craft's parts a second time.
    ///
    /// <para>An entry is good while two things hold. The key names the build: the
    /// craft file, its editor, when the file was last written and the complex.
    /// The stamp names what else the price depends on, which is the career's own
    /// state (tooling bought, and what leaders and strategies do to a vehicle
    /// purchase). A different stamp makes the entry a miss, and the next quote
    /// replaces it.</para>
    ///
    /// <para>Read and written on the game's main thread only, where commands run.
    /// It is bounded: past <see cref="Capacity"/> entries it forgets everything,
    /// which costs one load per build asked about again.</para>
    /// </summary>
    public sealed class Rp1QuoteCache
    {
        /// <summary>Entries held before the cache starts over.</summary>
        public const int Capacity = 256;

        private readonly Dictionary<string, Entry> _entries = new Dictionary<string, Entry>();

        /// <summary>The key for one build. Every part is separated so no two builds can share one.</summary>
        public static string KeyOf(string file, KspEditorFacility? facility, long modified, string lcId) =>
            file.Length + ":" + file + "|" + (facility == null ? "-" : ((int)facility.Value).ToString())
            + "|" + modified + "|" + lcId;

        /// <summary>The cached price when an entry exists for the key and was made under the same stamp.</summary>
        public bool TryGet(string key, string stamp, out double price)
        {
            if (_entries.TryGetValue(key, out var entry) && entry.Stamp == stamp)
            {
                price = entry.Price;
                return true;
            }

            price = 0.0;
            return false;
        }

        /// <summary>Remembers a price under a key and the stamp it was made under, replacing any earlier one.</summary>
        public void Put(string key, string stamp, double price)
        {
            if (_entries.Count >= Capacity && !_entries.ContainsKey(key))
            {
                _entries.Clear();
            }

            _entries[key] = new Entry(stamp, price);
        }

        private readonly struct Entry
        {
            public readonly string Stamp;
            public readonly double Price;

            public Entry(string stamp, double price)
            {
                Stamp = stamp;
                Price = price;
            }
        }
    }
}
