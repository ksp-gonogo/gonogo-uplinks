using Sitrep.Contract;

namespace Gonogo.ContractConfiguratorUplink
{
    internal static class ContractConfiguratorHealth
    {
        /// <param name="loaded">Whether Contract Configurator is loaded.</param>
        /// <param name="hooksFailure">Why the hooks could not be installed, or null when they were.</param>
        /// <param name="lineMissing">Whether the engine has ticked and still offers no objective delay line.</param>
        public static UplinkHealth Of(bool loaded, string? hooksFailure, bool lineMissing)
        {
            if (!loaded)
            {
                return new UplinkHealth(UplinkHealthState.Unavailable, "Contract Configurator is not loaded");
            }
            if (hooksFailure != null)
            {
                return UplinkHealth.Degraded(
                    "Contract Configurator objectives reach the home command without signal delay: the hooks "
                    + "could not be installed (" + hooksFailure + ").");
            }
            if (lineMissing)
            {
                return UplinkHealth.Degraded(
                    "Contract Configurator objectives reach the home command without signal delay: this "
                    + "version of Gonogo offers no objective delay line. Update Gonogo.");
            }
            return UplinkHealth.Healthy;
        }
    }
}
