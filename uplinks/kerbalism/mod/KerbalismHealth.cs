using Sitrep.Contract;

namespace Gonogo.KerbalismUplink
{
    /// <summary>
    /// The Uplink's health from whether Kerbalism's assembly is loaded, whether
    /// the loaded game runs Kerbalism and whether Kerbalism can be asked:
    /// unavailable while the assembly is missing or the game does not run
    /// Kerbalism, starting while Kerbalism is loaded and setting itself up for
    /// the game, unavailable if that setup outlasts the time limit, healthy once
    /// it completes, however late.
    /// </summary>
    public static class KerbalismHealth
    {
        /// <summary>Why a setting cannot be read while Kerbalism's assembly is not loaded.</summary>
        public const string NotInstalled = "Kerbalism is not installed";

        /// <summary>Why the Uplink is starting, and why a setting cannot be read while it is.</summary>
        public const string StillLoading = "Kerbalism hasn't finished loading.";

        /// <summary>Why the Uplink is unavailable, and why a setting cannot be read, in a game that does not run Kerbalism.</summary>
        public const string MissingFromGame =
            "Kerbalism doesn't run in this game. KSP's built-in scenarios and tutorials don't load it.";

        /// <summary>Why the Uplink is unavailable, and why a setting cannot be read, once Kerbalism has not set itself up within the time limit.</summary>
        public const string SetupStalled =
            "Kerbalism did not finish setting up. Check KSP.log for Kerbalism errors.";

        /// <param name="loaded">Whether Kerbalism's assembly is loaded and its API type resolved.</param>
        /// <param name="available">Whether Kerbalism has also set itself up for the loaded game (see <see cref="KerbalismReadiness"/>).</param>
        /// <param name="missingFromGame">Whether the loaded game does not hold Kerbalism's scenario (see <see cref="KerbalismReadiness.IsMissingFromGame"/>).</param>
        /// <param name="stalled">Whether Kerbalism has not set itself up within the time limit (see <see cref="KerbalismReadiness.IsStalled"/>).</param>
        public static UplinkHealth For(bool loaded, bool available, bool missingFromGame = false, bool stalled = false)
        {
            if (!loaded)
            {
                return new UplinkHealth(UplinkHealthState.Unavailable, "Kerbalism assembly not loaded");
            }
            if (missingFromGame)
            {
                return new UplinkHealth(UplinkHealthState.Unavailable, MissingFromGame);
            }
            if (!available && stalled)
            {
                return new UplinkHealth(UplinkHealthState.Unavailable, SetupStalled);
            }
            if (!available)
            {
                return UplinkHealth.Starting(StillLoading);
            }
            return UplinkHealth.Healthy;
        }

        /// <summary>
        /// Why a Kerbalism setting cannot be read, or null when it can: the same
        /// reason the health gives, so the two never disagree.
        /// </summary>
        public static string? SettingsUnavailableReason(bool loaded, bool available, bool missingFromGame, bool stalled = false)
        {
            if (!loaded)
            {
                return NotInstalled;
            }
            if (missingFromGame)
            {
                return MissingFromGame;
            }
            if (available)
            {
                return null;
            }
            return stalled ? SetupStalled : StillLoading;
        }
    }
}
