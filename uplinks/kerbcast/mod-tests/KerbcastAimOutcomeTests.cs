using Gonogo.KerbcastUplink;
using Sitrep.Contract;
using Xunit;

namespace GonogoKerbcastUplink.Tests;

/// <summary>
/// The three answers an aim command can carry back, and the reason the middle
/// one exists. A call that threw is not kerbcast refusing the id, and reporting
/// it as NotFound told an operator their vessel had no camera with the id they
/// had just read off a live feed.
/// </summary>
public class KerbcastAimOutcomeTests
{
    [Fact]
    public void KerbcastAcceptingTheAimSucceeds()
    {
        var result = KerbcastAimOutcome.For(true);

        Assert.True(result.Success);
        Assert.Null(result.ErrorCode);
    }

    /// <summary>
    /// kerbcast clamps an out-of-range angle to the camera's own bounds and
    /// refuses only when the id does not resolve, so its own false is a
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

    [Fact]
    public void ACommandAimKerbcastAcceptsSucceeds() =>
        Assert.True(KerbcastAimOutcome.ForCommandAim("Ok").Success);

    [Theory]
    [InlineData("UnknownCraft")]
    [InlineData("NotCommandFeed")]
    public void ACommandAimAtAnUnknownCraftOrCameraIsNotFound(string answer) =>
        Assert.Equal(CommandErrorCode.NotFound, KerbcastAimOutcome.ForCommandAim(answer).ErrorCode);

    [Theory]
    [InlineData("NotPositioned")]
    [InlineData("TooUncertain")]
    [InlineData("Stale")]
    [InlineData("Refused")]
    public void ACommandAimAtACraftTheCameraCannotSeeIsARangeRefusal(string answer) =>
        Assert.Equal(CommandErrorCode.Range, KerbcastAimOutcome.ForCommandAim(answer).ErrorCode);

    [Theory]
    [InlineData(null)]
    [InlineData("NotLockHolder")]
    [InlineData("NotRunning")]
    public void ACommandAimThatCouldNotBeMadeIsModeUnavailable(string? answer) =>
        Assert.Equal(CommandErrorCode.ModeUnavailable, KerbcastAimOutcome.ForCommandAim(answer).ErrorCode);
}
