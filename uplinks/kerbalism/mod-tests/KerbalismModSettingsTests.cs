using System.Collections.Generic;
using System.Linq;
using Gonogo.KerbalismUplink;
using Sitrep.Contract;
using Sitrep.Contract.TestSupport;
using Xunit;

namespace GonogoKerbalismUplink.Tests
{
    public class KerbalismModSettingsTests
    {
        private static KerbalismModSettings Source(
            string? absent = null,
            Dictionary<string, bool>? features = null,
            bool saveLoaded = true,
            ReliabilityPreferencesRaw? prefs = null) =>
            new(
                () => absent,
                () => features ?? new Dictionary<string, bool> { ["Reliability"] = true },
                () => saveLoaded,
                () => prefs ?? new ReliabilityPreferencesRaw
                {
                    MtbfFailures = true,
                    CriticalChance = 0.25,
                    SafeModeChance = 0.5,
                    RequireRepairKits = true,
                });

        [Fact]
        public void KeepsTheModSettingsPromiseLoadedAbsentAndWithNoSave()
        {
            ModSettingsConformance.AssertSourceContract(Source());
            ModSettingsConformance.AssertSourceContract(Source(absent: "Kerbalism is not installed"));
            ModSettingsConformance.AssertSourceContract(Source(saveLoaded: false));
            ModSettingsConformance.AssertSourceContract(Source(features: new Dictionary<string, bool>(), prefs: new ReliabilityPreferencesRaw()));
        }

        [Fact]
        public void ReadsTheReliabilitySwitchAndItsDifficultySettings()
        {
            var source = Source();

            Assert.True(source.ReadModSetting("reliability").AsBool);
            Assert.True(source.ReadModSetting("mtbfFailures").AsBool);
            Assert.Equal(0.25, source.ReadModSetting("criticalChance").AsNumber);
            Assert.Equal(0.5, source.ReadModSetting("safeModeChance").AsNumber);
            Assert.True(source.ReadModSetting("requireRepairKits").AsBool);
        }

        [Fact]
        public void WearSwitchedOffReadsOffRatherThanUnknown()
        {
            var read = Source(prefs: new ReliabilityPreferencesRaw { MtbfFailures = false })
                .ReadModSetting("mtbfFailures");

            Assert.True(read.IsAvailable);
            Assert.False(read.AsBool);
        }

        [Fact]
        public void AnUnreadableDifficultySettingIsUnavailableNotOff()
        {
            var source = Source(prefs: new ReliabilityPreferencesRaw());

            foreach (var id in new[] { "mtbfFailures", "criticalChance", "safeModeChance", "requireRepairKits" })
            {
                var read = source.ReadModSetting(id);
                Assert.False(read.IsAvailable, id + " read as a value");
                Assert.Equal("Kerbalism's difficulty settings could not be read", read.UnavailableReason);
            }
        }

        [Fact]
        public void DifficultySettingsWaitForASaveWhileTheFeatureSwitchDoesNot()
        {
            var source = Source(saveLoaded: false);

            Assert.Equal("no save loaded", source.ReadModSetting("mtbfFailures").UnavailableReason);
            Assert.True(source.ReadModSetting("reliability").IsAvailable);
        }

        [Fact]
        public void AMissingFeatureSwitchIsUnavailableNotOff()
        {
            var read = Source(features: new Dictionary<string, bool>()).ReadModSetting("reliability");

            Assert.False(read.IsAvailable);
        }

        [Fact]
        public void KerbalismAbsentMakesEverySettingUnavailableWithTheReason()
        {
            var source = Source(absent: "Kerbalism is not installed");

            foreach (var setting in source.ListModSettings())
            {
                Assert.Equal("Kerbalism is not installed", source.ReadModSetting(setting.Id).UnavailableReason);
            }
        }

        [Fact]
        public void ListsEverySettingReadOnlyUnderReliability()
        {
            var listed = Source().ListModSettings();

            Assert.All(listed, s => Assert.False(s.Writable));
            Assert.All(listed, s => Assert.Equal("Reliability", s.Group));
            Assert.Equal(
                new[] { "reliability", "mtbfFailures", "criticalChance", "safeModeChance", "requireRepairKits" },
                listed.Select(s => s.Id).ToArray());
        }
    }
}
