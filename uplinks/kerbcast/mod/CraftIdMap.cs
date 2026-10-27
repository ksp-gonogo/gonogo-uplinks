using System;
using System.Collections.Generic;

namespace Gonogo.KerbcastUplink
{
    /// <summary>A craft's name and kind as the game last listed it, so a record outlives the craft.</summary>
    public readonly struct CraftLabel
    {
        public CraftLabel(string? name, string? kind)
        {
            Name = name;
            Kind = kind;
        }

        public string? Name { get; }

        /// <summary>KSP's VesselType name ("Ship", "Probe", "Debris").</summary>
        public string? Kind { get; }
    }

    /// <summary>
    /// Craft identity in the direction Kerbcast's world model needs it: Gonogo's
    /// knowledge names a craft by <c>Vessel.id</c>, Kerbcast's records by
    /// <c>persistentId</c>. The map only grows while one save is loaded, so a craft
    /// the game no longer has keeps its id and label. Main thread only.
    /// </summary>
    public sealed class CraftIdMap
    {
        private readonly Dictionary<string, uint> _byVessel = new Dictionary<string, uint>(StringComparer.OrdinalIgnoreCase);
        private readonly Dictionary<uint, CraftLabel> _labels = new Dictionary<uint, CraftLabel>();

        /// <summary>Records a craft the game lists now. A later listing of the same craft updates its label.</summary>
        public void Learn(Guid vesselId, uint persistentId, CraftLabel label)
        {
            if (vesselId == Guid.Empty || persistentId == 0)
            {
                return;
            }
            _byVessel[vesselId.ToString()] = persistentId;
            _labels[persistentId] = label;
        }

        /// <summary>The craft's persistentId, by its id in the <c>vessel.id.ToString()</c> form.</summary>
        public bool TryPersistentId(string vesselId, out uint persistentId) =>
            _byVessel.TryGetValue(vesselId, out persistentId);

        public bool TryLabel(uint persistentId, out CraftLabel label) => _labels.TryGetValue(persistentId, out label);

        /// <summary>A craft KSP renumbered keeps its id and label under <paramref name="newPersistentId"/>.</summary>
        public void Renumber(Guid vesselId, uint oldPersistentId, uint newPersistentId)
        {
            if (_labels.TryGetValue(oldPersistentId, out var label))
            {
                _labels[newPersistentId] = label;
            }
            if (vesselId != Guid.Empty)
            {
                _byVessel[vesselId.ToString()] = newPersistentId;
            }
        }

        /// <summary>Forgets every craft, for a different save.</summary>
        public void Clear()
        {
            _byVessel.Clear();
            _labels.Clear();
        }
    }
}
