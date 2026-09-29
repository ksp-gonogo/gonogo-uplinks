using System.Collections.Generic;

namespace GonogoRp1Uplink
{
    /// <summary>
    /// One tick's reading of RP-1's leaders as plain data, so the Courier thread
    /// can carry it and the mapper below can be tested with no game. Same split,
    /// and for the same reason, as <see cref="Rp1ProgramsRaw"/>.
    /// </summary>
    public sealed class Rp1LeadersRaw
    {
        public double Ut;

        /// <summary>
        /// RP-1's strategy roster was live. False publishes the channel's absence,
        /// which is a different fact from a career with no leaders.
        /// </summary>
        public bool Available;

        public List<Rp1LeaderRaw> Leaders = new List<Rp1LeaderRaw>();
    }

    /// <summary>One leader; see <c>Rp1LeaderEntry</c> for what each field means on the wire.</summary>
    public sealed class Rp1LeaderRaw
    {
        public string? StrategyId;
        public string? Title;
        public string? Department;
        public bool? Active;
        public bool? CanAppoint;
        public string? AppointBlockedReason;
        public double? RehireFromUt;
        public double? SetupFunds;
        public double? SetupScience;
        public double? SetupReputation;
        public double? SetupConfidence;
        public double? DeactivateReputation;
        public double? DismissSubsidyLossPerDay;
        public bool? RemoveOnDeactivate;
        public double? ReactivateCooldown;
        public double? CanRemoveFromUt;
        public double? FreeToRemoveFromUt;
    }

    /// <summary>Maps a leaders reading to <c>rp1.leaders</c> rows. No game API.</summary>
    public static class Rp1LeadersCapture
    {
        /// <summary>The rows, or null to publish the channel's absence.</summary>
        public static List<Dictionary<string, object?>>? BuildLeaders(Rp1LeadersRaw? raw)
        {
            if (raw == null || !raw.Available)
            {
                return null;
            }
            var rows = new List<Dictionary<string, object?>>(raw.Leaders.Count);
            foreach (var l in raw.Leaders)
            {
                rows.Add(new Dictionary<string, object?>
                {
                    ["strategyId"] = l.StrategyId,
                    ["title"] = l.Title,
                    ["department"] = l.Department,
                    ["active"] = l.Active,
                    ["canAppoint"] = l.CanAppoint,
                    ["appointBlockedReason"] = l.AppointBlockedReason,
                    ["rehireFromUt"] = l.RehireFromUt,
                    ["setupFunds"] = l.SetupFunds,
                    ["setupScience"] = l.SetupScience,
                    ["setupReputation"] = l.SetupReputation,
                    ["setupConfidence"] = l.SetupConfidence,
                    ["deactivateReputation"] = l.DeactivateReputation,
                    ["dismissSubsidyLossPerDay"] = l.DismissSubsidyLossPerDay,
                    ["removeOnDeactivate"] = l.RemoveOnDeactivate,
                    ["reactivateCooldown"] = l.ReactivateCooldown,
                    ["canRemoveFromUt"] = l.CanRemoveFromUt,
                    ["freeToRemoveFromUt"] = l.FreeToRemoveFromUt,
                });
            }
            return rows;
        }
    }
}
