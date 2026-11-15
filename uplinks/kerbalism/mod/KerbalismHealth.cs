using Sitrep.Contract;

namespace Gonogo.KerbalismUplink
{
    /// <summary>
    /// The Uplink's health from whether Kerbalism's assembly is loaded and whether
    /// Kerbalism can be asked: unavailable while the assembly is missing, starting
    /// while Kerbalism is loaded and setting itself up for the game, healthy once
    /// both hold.
    /// </summary>
    public static class KerbalismHealth
    {
        /// <param name="loaded">Whether Kerbalism's assembly is loaded and its API type resolved.</param>
        /// <param name="available">Whether Kerbalism has also set itself up for the loaded game (see <see cref="KerbalismReadiness"/>).</param>
        public static UplinkHealth For(bool loaded, bool available)
        {
            if (!loaded)
            {
                return new UplinkHealth(UplinkHealthState.Unavailable, "Kerbalism assembly not loaded");
            }
            if (!available)
            {
                return UplinkHealth.Starting("Kerbalism hasn't finished loading.");
            }
            return UplinkHealth.Healthy;
        }
    }
}
