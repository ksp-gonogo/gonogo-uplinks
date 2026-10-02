using GonogoRp1Uplink;
using RP0.Crew;
using Sitrep.Contract;
using Sitrep.Contract.TestSupport;
using Xunit;

public class Rp1ModSettingsTests : System.IDisposable
{
    public Rp1ModSettingsTests() => CrewHandler.Instance = null;

    public void Dispose() => CrewHandler.Instance = null;

    private static Rp1ModSettings Source(bool installed = true, bool? retirement = true, bool? missionTraining = true) =>
        new(() => installed, () => retirement, () => missionTraining);

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
    public void ReadsTheMissionTrainingSwitch()
    {
        Assert.False(Source(missionTraining: false).ReadModSetting("missionTrainingEnabled").AsBool);
        Assert.True(Source(missionTraining: true).ReadModSetting("missionTrainingEnabled").AsBool);
        Assert.False(Source(missionTraining: null).ReadModSetting("missionTrainingEnabled").IsAvailable);
    }

    [Fact]
    public void ASaveRp1IsNotManagingReadsUnavailableRatherThanOff()
    {
        var source = Source(retirement: null, missionTraining: null);

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
        CrewHandler.Instance = new CrewHandler { RetirementEnabled = false, IsMissionTrainingEnabled = true };
        var crew = new Rp1CrewReflection();

        Assert.Equal(false, crew.RetirementEnabled);
        Assert.Equal(true, crew.MissionTrainingEnabled);
    }

    [Fact]
    public void TheReflectionReadsNothingWhenTheHandlerIsNotLive()
    {
        var crew = new Rp1CrewReflection();

        Assert.Null(crew.RetirementEnabled);
        Assert.Null(crew.MissionTrainingEnabled);
    }
}
