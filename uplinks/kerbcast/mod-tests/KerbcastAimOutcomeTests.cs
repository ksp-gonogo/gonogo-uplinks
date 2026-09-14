using Gonogo.KerbcastUplink;
using Sitrep.Contract;
using Xunit;

namespace GonogoKerbcastUplink.Tests;

/// <summary>
/// The three answers an aim command can carry back, and the reason the middle
/// one exists. kerbcast's SetFov/SetPan do not gate the probe's IsAvailable, so
/// a build where one of them has moved leaves the Uplink available and the
/// command unmakeable, and reporting that as NotFound told an operator their
/// vessel had no camera with the id they had just read off a live feed.
/// </summary>
public class KerbcastAimOutcomeTests
{
    [Fact]
    public void KerbcastAcceptingTheAimSucceeds()
    {
        var result = KerbcastAimOutcome.For(true);

        Assert.True(result.Success);
        Assert.Equal(CommandErrorCode.None, result.ErrorCode);
    }

    /// <summary>
    /// kerbcast clamps an out-of-range angle to the camera's own bounds and
    /// refuses only when the id does not resolve, so its own false IS a
    /// not-found and keeps that code.
    /// </summary>
    [Fact]
    public void KerbcastRefusingTheIdIsNotFound()
    {
        var result = KerbcastAimOutcome.For(false);

        Assert.False(result.Success);
        Assert.Equal(CommandErrorCode.NotFound, result.ErrorCode);
    }

    [Fact]
    public void ACallThatCouldNotBeMadeIsNotACameraTheVesselDoesNotHave()
    {
        var result = KerbcastAimOutcome.For(null);

        Assert.False(result.Success);
        Assert.Equal(CommandErrorCode.ModeUnavailable, result.ErrorCode);
    }
}
