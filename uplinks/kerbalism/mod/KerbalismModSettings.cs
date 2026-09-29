using System;
using System.Collections.Generic;
using Sitrep.Contract;

namespace Gonogo.KerbalismUplink
{
    /// <summary>
    /// Kerbalism's own settings that decide whether its reliability model does
    /// anything: the install-wide feature switch and the per-save difficulty
    /// settings that make parts wear and fail.
    ///
    /// <para>KSP-free: every value arrives through a reader handed in, so the
    /// list and its unavailable readings can be checked without Kerbalism.</para>
    /// </summary>
    public sealed class KerbalismModSettings : IModSettingsSource
    {
        private const string Group = "Reliability";
        private const string FeatureSetIn = "Kerbalism's settings file";
        private const string DifficultySetIn = "Difficulty settings, Kerbalism";

        private static readonly IReadOnlyList<ModSetting> Listed = new[]
        {
            ModSetting.Bool("reliability", "Part reliability", ModSettingRefresh.Launch,
                description: "Parts wear, fail and need repair",
                group: Group, setIn: FeatureSetIn),
            // A difficulty setting can change from the pause menu mid-flight, so it is read live rather than per save.
            ModSetting.Bool("mtbfFailures", "Failures from wear", ModSettingRefresh.Live,
                description: "With this off, no part ever fails however long it runs",
                group: Group, setIn: DifficultySetIn),
            ModSetting.Number("criticalChance", "Critical failure chance", Units.Ratio, ModSettingRefresh.Live,
                description: "Share of failures that are critical and need two repair kits",
                group: Group, setIn: DifficultySetIn),
            ModSetting.Number("safeModeChance", "Safe mode chance", Units.Ratio, ModSettingRefresh.Live,
                group: Group, setIn: DifficultySetIn),
            ModSetting.Bool("requireRepairKits", "Repairs need kits", ModSettingRefresh.Live,
                group: Group, setIn: DifficultySetIn),
        };

        private readonly Func<string?> _absentReason;
        private readonly Func<IReadOnlyDictionary<string, bool>> _features;
        private readonly Func<bool> _saveLoaded;
        private readonly Func<ReliabilityPreferencesRaw> _preferences;

        /// <param name="absentReason">Why Kerbalism cannot be read at all, or null when it can.</param>
        /// <param name="features">Kerbalism's feature switches by name.</param>
        /// <param name="saveLoaded">Whether a save is loaded, which the difficulty settings belong to.</param>
        /// <param name="preferences">The loaded save's reliability difficulty settings.</param>
        public KerbalismModSettings(
            Func<string?> absentReason,
            Func<IReadOnlyDictionary<string, bool>> features,
            Func<bool> saveLoaded,
            Func<ReliabilityPreferencesRaw> preferences)
        {
            _absentReason = absentReason;
            _features = features;
            _saveLoaded = saveLoaded;
            _preferences = preferences;
        }

        public IReadOnlyList<ModSetting> ListModSettings() => Listed;

        public ModSettingValue ReadModSetting(string id)
        {
            var absent = _absentReason();
            if (absent != null)
            {
                return ModSettingValue.Unavailable(absent);
            }

            switch (id)
            {
                case "reliability":
                    return _features().TryGetValue("Reliability", out var on)
                        ? ModSettingValue.Of(on)
                        : ModSettingValue.Unavailable("Kerbalism's feature switches could not be read");
                case "mtbfFailures":
                    return Preference(p => Of(p.MtbfFailures));
                case "criticalChance":
                    return Preference(p => Of(p.CriticalChance));
                case "safeModeChance":
                    return Preference(p => Of(p.SafeModeChance));
                case "requireRepairKits":
                    return Preference(p => Of(p.RequireRepairKits));
            }

            return ModSettingValue.Unavailable("not a Kerbalism setting");
        }

        private ModSettingValue Preference(Func<ReliabilityPreferencesRaw, ModSettingValue?> field)
        {
            if (!_saveLoaded())
            {
                return ModSettingValue.Unavailable("no save loaded");
            }

            return field(_preferences())
                ?? ModSettingValue.Unavailable("Kerbalism's difficulty settings could not be read");
        }

        private static ModSettingValue? Of(bool? value) =>
            value.HasValue ? ModSettingValue.Of(value.Value) : (ModSettingValue?)null;

        private static ModSettingValue? Of(double? value) =>
            value.HasValue && !double.IsNaN(value.Value) && !double.IsInfinity(value.Value)
                ? ModSettingValue.Of(value.Value)
                : (ModSettingValue?)null;
    }
}
