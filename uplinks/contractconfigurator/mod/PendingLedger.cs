using System;
using System.Collections.Generic;
using Sitrep.Contract;

namespace Gonogo.ContractConfiguratorUplink
{
    /// <summary>
    /// Which objectives this Uplink has changes on the delay line for, and the
    /// target of the latest one. The line cannot be asked about a single
    /// objective, only about a contract, so this keeps the per-objective answer
    /// and uses the line's answer for the contract to throw away entries for
    /// changes the line dropped without telling anyone.
    /// </summary>
    internal sealed class PendingLedger
    {
        private sealed class Entry
        {
            public int Count;
            public ObjectiveState Latest;
        }

        private readonly Dictionary<(Guid Contract, string Path), Entry> _entries =
            new Dictionary<(Guid, string), Entry>();

        /// <param name="contractHasHeld">Whether the line still holds any change for the contract.</param>
        /// <returns>The target of the objective's latest change on the line, or null when it has none.</returns>
        public ObjectiveState? LatestTarget(Guid contract, string path, Func<Guid, bool> contractHasHeld)
        {
            if (!contractHasHeld(contract))
            {
                Forget(contract);
                return null;
            }
            return _entries.TryGetValue((contract, path), out var entry) ? entry.Latest : (ObjectiveState?)null;
        }

        public void Held(Guid contract, string path, ObjectiveState target)
        {
            if (!_entries.TryGetValue((contract, path), out var entry))
            {
                entry = new Entry();
                _entries[(contract, path)] = entry;
            }
            entry.Count++;
            entry.Latest = target;
        }

        public void Settled(Guid contract, string path)
        {
            if (_entries.TryGetValue((contract, path), out var entry) && --entry.Count <= 0)
            {
                _entries.Remove((contract, path));
            }
        }

        private void Forget(Guid contract)
        {
            var gone = new List<(Guid, string)>();
            foreach (var key in _entries.Keys)
            {
                if (key.Contract == contract)
                {
                    gone.Add(key);
                }
            }
            foreach (var key in gone)
            {
                _entries.Remove(key);
            }
        }
    }
}
