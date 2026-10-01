using GonogoRp1Uplink;
using RP0.Crew;
using Sitrep.Contract;
using Sitrep.Contract.TestSupport;
using Xunit;

public class Rp1ModSettingsTests : System.IDisposable
{
    public Rp1ModSettingsTests() => CrewHandler.Instance = null;

    public void Dispose() => CrewHandler.Instance = null;

    private static Rp1ModSettings Source(bool installed = true, bool? retirement = true) =>
        new(() => installed, () => retirement);

    [Fact]
    public void KeepsTheModSettingsPromiseInstalledAbsentAndNotManaged()
    {
        ModSettingsConformance.AssertSourceContract(Source());
        ModSettingsConformance.AssertSourceContract(Source(installed: false));
        ModSettingsConformance.AssertSourceContract(Source(retirement: null));
    }

    [Fact]
    public void ReadsTheRetirementSwitch()
    {
        Assert.False(Source(retirement: false).ReadModSetting("retirementEnabled").AsBool);
        Assert.True(Source(retirement: true).ReadModSetting("retirementEnabled").AsBool);
    }

    [Fact]
    public void ASaveRp1IsNotManagingReadsUnavailableRatherThanOff()
    {
        var source = Source(retirement: null);

        Assert.False(source.ReadModSetting("retirementEnabled").IsAvailable);
        Assert.False(source.ReadModSetting("missionTrainingEnabled").IsAvailable);
    }

    [Fact]
    public void AnUninstalledRp1ReadsUnavailableWhateverTheReadersSay()
    {
        var source = Source(installed: false, retirement: true);

        Assert.Equal("RP-1 is not installed", source.ReadModSetting("retirementEnabled").UnavailableReason);
    }

    [Fact]
    public void TheReflectionReadsTheHandlersSwitches()
    {
        CrewHandler.Instance = new CrewHandler { RetirementEnabled = false };
        var crew = new Rp1CrewReflection();

        Assert.Equal(false, crew.RetirementEnabled);
    }

    [Fact]
    public void TheReflectionReadsNothingWhenTheHandlerIsNotLive()
    {
        var crew = new Rp1CrewReflection();

        Assert.Null(crew.RetirementEnabled);
    }
}
