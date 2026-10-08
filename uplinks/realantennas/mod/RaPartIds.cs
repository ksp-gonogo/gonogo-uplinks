using System.Collections.Generic;

namespace Gonogo.RealAntennasUplink
{
    /// <summary>
    /// Which part an antenna is on and which of that part's antennas it is, read
    /// the same way for a loaded craft and an unloaded one. The part's persistent
    /// id is on the live part while its craft is loaded and on the saved part
    /// snapshot while it is not, so an antenna keeps one identity through a load,
    /// a scene change and going on rails.
    /// </summary>
    internal static class RaPartIds
    {
        /// <summary>The persistent id of the part an antenna is on, or null when neither the live part nor the saved snapshot can be found.</summary>
        public static uint? PartPersistentId(RaReflection ra, Vessel? vessel, object antenna)
        {
            if (ra.ReadPublicMember(ra.Parent(antenna), "part") is Part part)
            {
                return part.persistentId;
            }
            var module = ra.ParentSnapshot(antenna) as ProtoPartModuleSnapshot;
            var saved = vessel != null && vessel.protoVessel != null ? vessel.protoVessel.protoPartSnapshots : null;
            if (module == null || saved == null)
            {
                return null;
            }
            foreach (var savedPart in saved)
            {
                if (savedPart != null && savedPart.modules != null && savedPart.modules.Contains(module))
                {
                    return savedPart.persistentId;
                }
            }
            return null;
        }

        /// <summary>
        /// The part and ordinal of every antenna in list order, null for one whose
        /// part cannot be found. The ordinal counts that part's antennas in the
        /// order the list gives them, which is what the chain keys and the dish ids
        /// both use, so the three agree.
        /// </summary>
        public static (uint Part, int Ordinal)?[] Of(RaReflection ra, Vessel? vessel, IReadOnlyList<object> antennas)
        {
            var found = new (uint Part, int Ordinal)?[antennas.Count];
            var seen = new Dictionary<uint, int>();
            for (var i = 0; i < antennas.Count; i++)
            {
                var part = PartPersistentId(ra, vessel, antennas[i]);
                if (part == null)
                {
                    continue;
                }
                seen.TryGetValue(part.Value, out var ordinal);
                seen[part.Value] = ordinal + 1;
                found[i] = (part.Value, ordinal);
            }
            return found;
        }
    }
}
