using System;
using System.Collections.Generic;
using Sitrep.Contract;

namespace Gonogo.ContractConfiguratorUplink.Tests
{
    internal sealed class RecordingObjectiveLine : IObjectiveDelayLine
    {
        public string ProviderId => "recording-objective-line";

        public List<string> Rebound { get; } = new List<string>();

        public Func<ObjectiveChange, Action?>? Resolver { get; private set; }

        public List<ObjectiveChange> Held { get; } = new List<ObjectiveChange>();

        public bool Hold(ObjectiveChange change, Action apply)
        {
            Held.Add(change);
            return true;
        }

        public bool HasHeldAtOrBefore(Guid contractId, double ut) => false;

        public void Rebind(string ownerId, Func<ObjectiveChange, Action?> resolve)
        {
            Rebound.Add(ownerId);
            Resolver = resolve;
        }
    }
}
