using System;
using System.Collections.Generic;
using Sitrep.Contract;

namespace GonogoRp1Uplink
{
    /// <summary>
    /// RP-1's own rules that decide which readouts mean anything. A widget
    /// drawing a retirement date on a save where retirement is off is drawing a
    /// date nothing will act on.
    ///
    /// <para>KSP-free: every value arrives through a reader handed in, so the
    /// list and its unavailable readings can be checked without RP-1.</para>
    /// </summary>
    public sealed class Rp1ModSettings : IModSettingsSource
    {
        private static readonly IReadOnlyList<ModSetting> Listed = new[]
        {
            ModSetting.Bool("retirementEnabled", "Crew retirement", ModSettingRefresh.Save,
                description: "With this off, no kerbal ever retires and no retirement date applies",
                group: "Crew"),
            ModSetting.Bool("missionTrainingEnabled", "Mission training", ModSettingRefresh.Save,
                description: "With this off, proficiency training is the only kind and no training can lapse",
                group: "Crew"),
        };

        private readonly Func<bool> _installed;
        private readonly Func<bool?> _retirement;
        private readonly Func<bool?> _missionTraining;

        /// <param name="installed">Whether RP-1's crew handler type resolved.</param>
        /// <param name="retirement">Whether crew retire on the loaded save, or null when the handler is not live.</param>
        /// <param name="missionTraining">Whether mission-specific training is required on the loaded save, or null when the handler is not live.</param>
        public Rp1ModSettings(Func<bool> installed, Func<bool?> retirement, Func<bool?> missionTraining)
        {
            _installed = installed;
            _retirement = retirement;
            _missionTraining = missionTraining;
        }

        public IReadOnlyList<ModSetting> ListModSettings() => Listed;

        public ModSettingValue ReadModSetting(string id)
        {
            if (!_installed())
            {
                return ModSettingValue.Unavailable("RP-1 is not installed");
            }

            if (id == "retirementEnabled")
            {
                var on = _retirement();
                return on.HasValue
                    ? ModSettingValue.Of(on.Value)
                    : ModSettingValue.Unavailable("RP-1 is not managing this save");
            }

            if (id == "missionTrainingEnabled")
            {
                var on = _missionTraining();
                return on.HasValue
                    ? ModSettingValue.Of(on.Value)
                    : ModSettingValue.Unavailable("RP-1 is not managing this save");
            }

            return ModSettingValue.Unavailable("not an RP-1 setting");
        }
    }
}
