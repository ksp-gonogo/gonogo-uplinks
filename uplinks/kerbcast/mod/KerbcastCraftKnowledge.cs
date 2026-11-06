using System;
using System.Collections.Generic;
using System.Text;
using GonogoKerbcastUplink;
using Sitrep.Contract;

namespace Gonogo.KerbcastUplink
{
    /// <summary>How one command centre knows one craft, as the world model holds it this tick.</summary>
    public readonly struct CraftKnowledgeFact
    {
        public CraftKnowledgeFact(string centre, uint persistentId, CraftKnowledgeState state, double? lastKnownUt)
        {
            Centre = centre;
            PersistentId = persistentId;
            State = state;
            LastKnownUt = lastKnownUt;
        }

        /// <summary>The centre's id in the roster vocabulary: <c>ground:&lt;name&gt;</c> or <c>vessel:&lt;guid&gt;</c>.</summary>
        public string Centre { get; }

        public uint PersistentId { get; }

        public CraftKnowledgeState State { get; }

        public double? LastKnownUt { get; }
    }

    /// <summary>
    /// What <see cref="KerbcastUplink"/> publishes on <c>kerbcast.craftKnowledge</c>:
    /// the wire entries for a tick's knowledge, and whether it differs from the last
    /// one sent. Kept apart from the Uplink so it tests headless.
    /// </summary>
    public sealed class KerbcastCraftKnowledgeFeed
    {
        private string? _lastSignature;

        /// <summary>
        /// The entries to publish for <paramref name="facts"/>, or null when they are the
        /// ones already sent. A craft the centre knows nothing of is not listed, so it has
        /// no entry.
        /// </summary>
        public List<object>? Next(IReadOnlyList<CraftKnowledgeFact> facts)
        {
            var entries = new List<object>(facts.Count);
            var signature = new StringBuilder();
            foreach (var fact in facts)
            {
                var state = Word(fact.State);
                if (state == null)
                {
                    continue;
                }
                entries.Add(new Dictionary<string, object?>
                {
                    ["centre"] = fact.Centre,
                    ["craftId"] = (long)fact.PersistentId,
                    ["knowledge"] = state,
                    ["lastKnownUt"] = fact.LastKnownUt,
                });
                signature.Append(fact.Centre).Append('|').Append(fact.PersistentId).Append('|').Append(state)
                    .Append('|').Append(fact.LastKnownUt?.ToString("R", System.Globalization.CultureInfo.InvariantCulture)).Append(';');
            }
            var text = signature.ToString();
            if (text == _lastSignature)
            {
                return null;
            }
            _lastSignature = text;
            return entries;
        }

        /// <summary>Forgets what was sent, so the next tick publishes whatever it holds.</summary>
        public void Reset() => _lastSignature = null;

        internal static string? Word(CraftKnowledgeState state) => state switch
        {
            CraftKnowledgeState.Heard => "heard",
            CraftKnowledgeState.Seen => "seen",
            CraftKnowledgeState.Modelled => "modelled",
            CraftKnowledgeState.Held => "held",
            _ => null,
        };
    }
}
