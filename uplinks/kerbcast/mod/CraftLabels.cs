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
    /// Each craft's name and kind by persistentId. Only grows while one save is
    /// loaded, so a craft the game no longer has still lists under its last
    /// name. Main thread only.
    /// </summary>
    public sealed class CraftLabels
    {
        private readonly Dictionary<uint, CraftLabel> _labels = new Dictionary<uint, CraftLabel>();

        /// <summary>Records a craft the game lists now. A later listing of the same craft updates its label.</summary>
        public void Learn(uint persistentId, CraftLabel label)
        {
            if (persistentId != 0)
            {
                _labels[persistentId] = label;
            }
        }

        public bool TryLabel(uint persistentId, out CraftLabel label) => _labels.TryGetValue(persistentId, out label);

        /// <summary>A craft KSP renumbered keeps its label under <paramref name="newPersistentId"/>.</summary>
        public void Renumber(uint oldPersistentId, uint newPersistentId)
        {
            if (_labels.TryGetValue(oldPersistentId, out var label))
            {
                _labels[newPersistentId] = label;
            }
        }
    }
}
