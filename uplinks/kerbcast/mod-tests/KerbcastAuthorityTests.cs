using System.Linq;
using Gonogo.KerbcastUplink;
using Kerbcast.Api;
using Kerbcast.Api.Testing;
using Xunit;

namespace GonogoKerbcastUplink.Tests;

/// <summary>
/// The command lock follows Gonogo's signal delay: held with a world model
/// required while delay is on, never held while it is off, and never taken at
/// all on a Kerbcast that cannot back it with a world model.
/// </summary>
public class KerbcastAuthorityTests
{
    private const double Light = 299792458.0;

    private static KerbcastAuthority Authority(RecordingKerbcast kc) =>
        new KerbcastAuthority(() => kc, kc.Supports);

    [Fact]
    public void DelayOnTakesTheLockWithAWorldModelRequiredAndPassesTheSignalSpeed()
    {
        var kc = new RecordingKerbcast();
        var authority = Authority(kc);

        Assert.Equal(AuthorityState.Governing, authority.Tick(0.0, Light));

        Assert.Equal(KerbcastAuthority.Owner, kc.Command.LockOwner);
        Assert.Equal(LockOptions.WorldModelRequired, kc.Command.LockOptions);
        Assert.Equal(Light, kc.Command.LightSpeed);
        Assert.Equal(KerbcastAuthority.Owner, kc.Command.ReservedOwner);
        Assert.Equal(typeof(KerbcastAuthority).Assembly.GetName().Name, kc.Command.ReservedAssembly);
        Assert.NotNull(authority.Publisher);
        Assert.True(authority.Publisher!.Attached);
    }

    [Fact]
    public void DelayOffHoldsNoLockAndReleasesOneHeld()
    {
        var kc = new RecordingKerbcast();
        var authority = Authority(kc);

        Assert.Equal(AuthorityState.DelayOff, authority.Tick(0.0, null));
        Assert.Null(kc.Command.LockOwner);
        Assert.DoesNotContain(kc.Calls, c => c.StartsWith("TakeLock"));

        authority.Tick(1.0, Light);
        Assert.Equal(AuthorityState.DelayOff, authority.Tick(2.0, null));

        Assert.Null(kc.Command.LockOwner);
        Assert.Null(kc.Command.LightSpeed);
        Assert.Null(authority.Publisher);
        Assert.Null(kc.Command.ReservedOwner);
    }

    [Fact]
    public void DelayOffAtStartClearsAReservationAndLockLeftByAnEarlierRun()
    {
        var kc = new RecordingKerbcast();
        kc.Command.Reserve(KerbcastAuthority.Owner, typeof(KerbcastAuthority).Assembly.GetName().Name);
        kc.Command.ChangeScene();
        Assert.Equal(KerbcastAuthority.Owner, kc.Command.LockOwner);
        var authority = Authority(kc);

        Assert.Equal(AuthorityState.DelayOff, authority.Tick(0.0, null));

        Assert.Null(kc.Command.LockOwner);
        Assert.Null(kc.Command.ReservedOwner);
        var calls = kc.Calls.Count;

        authority.Tick(1.0, null);

        Assert.Equal(calls, kc.Calls.Count);
    }

    [Fact]
    public void AReleaseAndARetakeAttachAFreshPublisher()
    {
        var kc = new RecordingKerbcast();
        var authority = Authority(kc);
        authority.Tick(0.0, Light);
        var first = authority.Publisher;

        kc.Command.ReleaseLock(KerbcastAuthority.Owner);
        Assert.False(first!.Attached);

        Assert.Equal(AuthorityState.Governing, authority.Tick(0.1, Light));
        Assert.NotSame(first, authority.Publisher);
        Assert.True(authority.Publisher!.Attached);
    }

    [Fact]
    public void AKerbcastWithoutTheLockOrTheWorldModelIsNeverLocked()
    {
        var kc = new RecordingKerbcast();
        kc.SetSupported(f => f != ApiFeature.WorldModel);
        var authority = Authority(kc);

        Assert.Equal(AuthorityState.Unsupported, authority.Tick(0.0, Light));
        Assert.Null(kc.Command.LockOwner);

        kc.SetSupported(f => f != ApiFeature.CommandLock && f != ApiFeature.WorldModel && f != ApiFeature.LightSpeed);
        Assert.Equal(AuthorityState.Unsupported, authority.Tick(1.0, Light));
        Assert.Empty(kc.Calls);
    }

    [Fact]
    public void AKerbcastWithoutTheSignalSpeedStillGovernsAndNeverCallsIt()
    {
        var kc = new RecordingKerbcast();
        kc.SetSupported(f => f != ApiFeature.LightSpeed);
        var authority = Authority(kc);

        Assert.Equal(AuthorityState.Governing, authority.Tick(0.0, Light));
        Assert.DoesNotContain(kc.Calls, c => c.StartsWith("SetLightSpeed"));
    }

    [Fact]
    public void TheLockIsRenewedOnceASecondAndASpeedChangeGoesAtOnce()
    {
        var kc = new RecordingKerbcast();
        var authority = Authority(kc);

        authority.Tick(0.0, Light);
        authority.Tick(0.4, Light);
        authority.Tick(0.9, Light);
        Assert.Single(kc.Calls, c => c.StartsWith("TakeLock"));

        authority.Tick(1.0, Light);
        Assert.Equal(2, kc.Calls.Count(c => c.StartsWith("TakeLock")));

        authority.Tick(1.1, 3.0);
        Assert.Equal(3.0, kc.Command.LightSpeed);
    }

    [Fact]
    public void AnotherHolderIsReportedAndNoPublisherIsKept()
    {
        var kc = new RecordingKerbcast();
        kc.Command.TakeLock("someone-else", LockOptions.None);
        var authority = Authority(kc);

        Assert.Equal(AuthorityState.HeldByOther, authority.Tick(0.0, Light));
        Assert.Null(authority.Publisher);
        Assert.Equal("someone-else", kc.Command.LockOwner);
    }

    [Fact]
    public void ASceneChangeStartsANewTenureWithAFreshPublisherAndTheSpeedAgain()
    {
        var kc = new RecordingKerbcast();
        var authority = Authority(kc);
        authority.Tick(0.0, Light);
        var first = authority.Publisher;
        Assert.Equal(1, authority.Tenure);

        kc.Command.ChangeScene();
        Assert.Null(kc.Command.LightSpeed);

        Assert.Equal(AuthorityState.Governing, authority.Tick(0.1, Light));
        Assert.NotSame(first, authority.Publisher);
        Assert.True(authority.Publisher!.Attached);
        Assert.Equal(2, authority.Tenure);
        Assert.Equal(Light, kc.Command.LightSpeed);
    }

    [Fact]
    public void AReservationHeldByAnotherModIsLeftAloneAndTheLockStillGoverns()
    {
        var kc = new RecordingKerbcast();
        kc.Command.Reserve("someone-else", typeof(KerbcastAuthorityTests).Assembly.GetName().Name);
        kc.Command.ChangeScene();
        kc.Command.ReleaseLock("someone-else");
        var authority = Authority(kc);

        Assert.Equal(AuthorityState.Governing, authority.Tick(0.0, Light));
        Assert.Equal(AuthorityState.Governing, authority.Tick(1.0, Light));

        Assert.Equal("someone-else", kc.Command.ReservedOwner);
        Assert.Equal(KerbcastAuthority.Owner, kc.Command.LockOwner);
    }

    [Fact]
    public void NoKerbcastInTheSceneIsAbsent()
    {
        var authority = new KerbcastAuthority(() => null, _ => true);

        Assert.Equal(AuthorityState.Absent, authority.Tick(0.0, Light));
        Assert.Null(authority.Publisher);
    }
}
