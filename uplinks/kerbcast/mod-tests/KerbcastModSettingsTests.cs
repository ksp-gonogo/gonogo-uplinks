using Gonogo.KerbcastUplink;
using Sitrep.Contract;
using Sitrep.Contract.TestSupport;
using Xunit;

namespace GonogoKerbcastUplink.Tests;

public class KerbcastModSettingsTests
{
    private sealed class Save
    {
        public string? Unavailable;
        public bool? Throttle = false;
        public bool Accepts = true;

        public KerbcastModSettings Source() => new(
            () => Unavailable,
            () => Throttle,
            on =>
            {
                if (!Accepts) return false;
                Throttle = on;
                return true;
            });
    }

    [Fact]
    public void KeepsTheModSettingsPromiseLoadedAbsentAndWithNoSave()
    {
        ModSettingsConformance.AssertSourceContract(new Save().Source());
        ModSettingsConformance.AssertWriterContract(new Save().Source());
        ModSettingsConformance.AssertSourceContract(new Save { Unavailable = "Kerbcast is not loaded" }.Source());
        ModSettingsConformance.AssertSourceContract(new Save { Unavailable = "no save loaded" }.Source());
        ModSettingsConformance.AssertSourceContract(new Save { Throttle = null }.Source());
    }

    [Fact]
    public void ListsTheThrottleAsWritable()
    {
        var setting = Assert.Single(new Save().Source().ListModSettings());

        Assert.Equal(KerbcastModSettings.ThrottleId, setting.Id);
        Assert.Equal(SettingKind.Bool, setting.Kind);
        Assert.True(setting.Writable);
    }

    [Fact]
    public void AWriteSetsTheSavesThrottleAndTheNextReadSaysSo()
    {
        var save = new Save();
        var source = save.Source();

        Assert.True(source.WriteModSetting(KerbcastModSettings.ThrottleId, ModSettingValue.Of(true)).Success);
        Assert.True(save.Throttle);
        Assert.True(source.ReadModSetting(KerbcastModSettings.ThrottleId).AsBool);
    }

    [Fact]
    public void WithNoSaveAWriteIsRefusedWithTheReasonAndChangesNothing()
    {
        var save = new Save { Unavailable = "no save loaded" };

        var result = save.Source().WriteModSetting(KerbcastModSettings.ThrottleId, ModSettingValue.Of(true));

        Assert.False(result.Success);
        Assert.Equal("no save loaded", result.Detail);
        Assert.False(save.Throttle);
    }

    [Fact]
    public void AWriteKerbcastWouldNotTakeIsRefused()
    {
        var result = new Save { Accepts = false }.Source()
            .WriteModSetting(KerbcastModSettings.ThrottleId, ModSettingValue.Of(true));

        Assert.False(result.Success);
    }

    [Fact]
    public void AnUnreadableThrottleIsUnavailableNotOff()
    {
        var read = new Save { Throttle = null }.Source().ReadModSetting(KerbcastModSettings.ThrottleId);

        Assert.False(read.IsAvailable);
    }
}
