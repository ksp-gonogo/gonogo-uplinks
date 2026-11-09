using System.Linq;
using Gonogo.RealAntennasUplink;
using Sitrep.Contract;
using Sitrep.Contract.TestSupport;
using Xunit;

namespace GonogoRealAntennasUplink.Tests
{
    public class RaRetargetModSettingsTests
    {
        private const string A = "11111111-1111-1111-1111-111111111111";
        private const string B = "22222222-2222-2222-2222-222222222222";

        private static RaRetargetModSettings SourceOver(RaRetargetRegister register, System.Action? onTurnedOff = null) =>
            new RaRetargetModSettings(register, onTurnedOff ?? (() => { }));

        [Fact]
        public void KeepsTheModSettingsPromise()
        {
            ModSettingsConformance.AssertSourceContract(SourceOver(new RaRetargetRegister()));
            ModSettingsConformance.AssertWriterContract(SourceOver(new RaRetargetRegister()));
        }

        [Fact]
        public void IsListedAsAWritableSwitchThatReadsOnInASaveThatNeverChangedIt()
        {
            var source = SourceOver(new RaRetargetRegister());

            var setting = Assert.Single(source.ListModSettings());
            Assert.Equal(SettingKind.Bool, setting.Kind);
            Assert.True(setting.Writable);
            Assert.True(source.ReadModSetting(RaRetargetModSettings.AutoRetargetId).AsBool);
        }

        [Fact]
        public void ACraftWithNoChoiceOfItsOwnFollowsTheSaveWideSetting()
        {
            var register = new RaRetargetRegister();
            var source = SourceOver(register);

            Assert.True(register.Allowed(A));
            source.WriteModSetting(RaRetargetModSettings.AutoRetargetId, ModSettingValue.Of(false));
            Assert.False(register.Allowed(A));
            source.WriteModSetting(RaRetargetModSettings.AutoRetargetId, ModSettingValue.Of(true));
            Assert.True(register.Allowed(A));
        }

        [Fact]
        public void ACraftWithItsOwnChoiceKeepsItWhateverTheSaveWideSettingBecomes()
        {
            var register = new RaRetargetRegister();
            var source = SourceOver(register);
            register.SetAllowed(A, true);
            register.SetAllowed(B, false);

            source.WriteModSetting(RaRetargetModSettings.AutoRetargetId, ModSettingValue.Of(false));
            Assert.True(register.Allowed(A));
            Assert.False(register.Allowed(B));

            source.WriteModSetting(RaRetargetModSettings.AutoRetargetId, ModSettingValue.Of(true));
            Assert.True(register.Allowed(A));
            Assert.False(register.Allowed(B));
        }

        [Fact]
        public void TurningItOffFromOnTellsTheUplinkToPutDishesBackAndNothingElseDoes()
        {
            var calls = 0;
            var source = SourceOver(new RaRetargetRegister(), () => calls++);

            source.WriteModSetting(RaRetargetModSettings.AutoRetargetId, ModSettingValue.Of(true));
            Assert.Equal(0, calls);
            source.WriteModSetting(RaRetargetModSettings.AutoRetargetId, ModSettingValue.Of(false));
            Assert.Equal(1, calls);
            source.WriteModSetting(RaRetargetModSettings.AutoRetargetId, ModSettingValue.Of(false));
            Assert.Equal(1, calls);
        }

        [Fact]
        public void AWriteOfAnotherIdOrKindIsRefusedAndChangesNothing()
        {
            var register = new RaRetargetRegister();
            var source = SourceOver(register);

            Assert.False(source.WriteModSetting("other", ModSettingValue.Of(false)).Success);
            Assert.False(source.WriteModSetting(RaRetargetModSettings.AutoRetargetId, ModSettingValue.Of(1.0)).Success);
            Assert.True(register.AllowedByDefault);
        }

        [Fact]
        public void TheChannelNamesTheCraftsWhoseSwitchReadsOff()
        {
            var register = new RaRetargetRegister();
            register.SetAllowed(A, false);
            Assert.Equal(new[] { A }, register.NotAllowed(new[] { A, B }).ToArray());

            register.AllowedByDefault = false;
            register.SetAllowed(B, true);
            Assert.Equal(new[] { A }, register.NotAllowed(new[] { A, B }).ToArray());
            Assert.Equal(new[] { A, "other" }, register.NotAllowed(new[] { B, "other" }).ToArray());
        }

        [Fact]
        public void TheSaveWideChoiceAndEveryCraftsOwnSurviveASaveAndALoad()
        {
            var register = new RaRetargetRegister { AllowedByDefault = false };
            register.SetAllowed(A, true);
            var node = new ConfigNode();
            RaRetargetPersistence.Save(register, node);
            var loaded = new RaRetargetRegister();

            RaRetargetPersistence.Load(loaded, node);

            Assert.False(loaded.AllowedByDefault);
            Assert.True(loaded.Allowed(A));
            Assert.False(loaded.Allowed(B));
        }

        [Fact]
        public void ASaveThatHoldsNoSaveWideChoiceLoadsAsOn()
        {
            var node = new ConfigNode();
            node.AddNode("REALANTENNAS_RETARGET");
            var loaded = new RaRetargetRegister { AllowedByDefault = false };

            RaRetargetPersistence.Load(loaded, node);

            Assert.True(loaded.AllowedByDefault);
        }
    }
}
