using System.Collections.Generic;

namespace GonogoAvionicsUplink
{
    /// <summary>
    /// Pure mapper: turns the reflected <see cref="AvionicsRaw"/> reading plus the
    /// vessel's stock total mass into the <c>avionics.status</c> dict. KSP-free +
    /// side-effect-free so it is unit-tested headless. The go/no-go mirrors
    /// <c>RP0.ControlLockerUtils.ShouldLock</c>: control is LOST only when the
    /// vessel mass strictly EXCEEDS the limit, so mass == limit is still GO.
    ///
    /// <para>The verdict is three-valued because its input is. Where
    /// <see cref="AvionicsRaw.ControllableMassTons"/> is <c>null</c> there is no
    /// ceiling to compare against, so <c>controllable</c> goes out unset rather
    /// than as the false a compare against absence produces.</para>
    /// </summary>
    public static class AvionicsCapture
    {
        public static Dictionary<string, object?> Build(AvionicsRaw? raw, double vesselMassTons)
        {
            if (raw == null)
            {
                // The read produced nothing, so the only fact here is the
                // vessel's own mass and nothing else is claimed. This is NOT
                // "no avionics fitted": that arrives as an observed
                // AvionicsActive false out of AvionicsFold. Hardcoding a false
                // pair here made the widget say NO AVIONICS about hardware
                // nobody had looked at, and left its NO READING state
                // unreachable from the mod entirely.
                return new Dictionary<string, object?>
                {
                    ["avionicsActive"] = null,
                    ["controllableMassTons"] = null,
                    ["vesselMassTons"] = vesselMassTons,
                    ["controllable"] = null,
                };
            }
            return new Dictionary<string, object?>
            {
                ["avionicsActive"] = raw.AvionicsActive,
                ["controllableMassTons"] = raw.ControllableMassTons,
                ["vesselMassTons"] = vesselMassTons,
                // No ceiling read, no verdict. `vesselMassTons <= (double?)null`
                // is false in C#, so the old unconditional compare turned an
                // unread limit into a confident NO-GO: the widget's alert tone
                // for a craft nobody had measured.
                ["controllable"] = raw.ControllableMassTons is double limit
                    ? (bool?)(vesselMassTons <= limit)
                    : null,
            };
        }
    }
}
