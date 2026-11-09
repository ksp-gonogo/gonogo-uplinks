using Gonogo.KerbcastUplink;
using Kerbcast.Api.Testing;
using Xunit;

namespace GonogoKerbcastUplink.Tests;

/// <summary>Holds the tests that raise Kerbcast's process-wide lock-lost event, which no other test may overlap.</summary>
[CollectionDefinition(Name, DisableParallelization = true)]
public sealed class LockLostEventCollection
{
    public const string Name = "Kerbcast lock-lost event";
}

/// <summary>A player's release of the command lock in game holds until signal delay is switched off and on again.</summary>
[Collection(LockLostEventCollection.Name)]
public class KerbcastPlayerReleaseTests
{
    private const double Light = 299792458.0;

    private static KerbcastAuthority Authority(RecordingKerbcast kc) =>
        new KerbcastAuthority(() => kc, kc.Supports);

    [Fact]
    public void APlayersReleaseHoldsAcrossHeartbeatsWhileDelayStaysOn()
    {
        var kc = new RecordingKerbcast();
        var authority = Authority(kc);
        authority.Tick(0.0, Light);

        kc.Command.ReleaseByPlayer();
        Assert.Null(kc.Command.LockOwner);

        Assert.Equal(AuthorityState.ReleasedByPlayer, authority.Tick(0.1, Light));
        var calls = kc.Calls.Count;
        Assert.Equal(AuthorityState.ReleasedByPlayer, authority.Tick(1.5, Light));
        Assert.Equal(AuthorityState.ReleasedByPlayer, authority.Tick(30.0, Light * 2));

        Assert.Null(kc.Command.LockOwner);
        Assert.Null(authority.Publisher);
        Assert.Equal(calls, kc.Calls.Count);
    }

    [Fact]
    public void SwitchingDelayOffAndOnAgainTakesTheLockAfterAPlayersRelease()
    {
        var kc = new RecordingKerbcast();
        var authority = Authority(kc);
        authority.Tick(0.0, Light);
        kc.Command.ReleaseByPlayer();
        authority.Tick(0.1, Light);

        Assert.Equal(AuthorityState.DelayOff, authority.Tick(1.0, null));
        Assert.Equal(AuthorityState.Governing, authority.Tick(2.0, Light));

        Assert.Equal(KerbcastAuthority.Owner, kc.Command.LockOwner);
        Assert.True(authority.Publisher!.Attached);
    }
}
