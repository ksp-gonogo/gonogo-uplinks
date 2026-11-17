// GonogoKosUplink: GPLv3. See GonogoKosUplink.csproj's header comment for the
// licence/linkage rationale.

using System.Collections.Generic;
using kOS.Suffixed;
using kOS.Suffixed.Part;

namespace Gonogo.KosUplink
{
    /// <summary>
    /// Names the part or vessel a returned PART or VESSEL value refers to. Needs
    /// the game's assemblies, so it is installed into
    /// <see cref="KosReturnFields.ReferenceReader"/> by the plugin and is not
    /// part of the headless build.
    /// </summary>
    public static class KosReturnReferences
    {
        public static Dictionary<string, object?>? Read(object value)
        {
            switch (value)
            {
                case PartValue part:
                    return KosReturnShapes.Part(part.Part.name, part.Part.flightID.ToString());
                case VesselTarget vessel:
                    return KosReturnShapes.Vessel(vessel.Vessel.vesselName, vessel.Vessel.id.ToString());
                default:
                    return null;
            }
        }
    }
}
