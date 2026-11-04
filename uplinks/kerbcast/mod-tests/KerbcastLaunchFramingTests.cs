using Gonogo.KerbcastUplink;
using Xunit;

namespace GonogoKerbcastUplink.Tests;

/// <summary>
/// How much wider than the craft a launchpad camera frames it: nothing without a
/// countdown, more and more over the countdown, the widest at T-0 and while the
/// craft is on the ground, and back to nothing after liftoff or a called-off countdown.
/// </summary>
public class KerbcastLaunchFramingTests
{
    private const double Widest = KerbcastLaunchFraming.WidestRadiusM;
    private const double Ease = KerbcastLaunchFraming.EaseBackSeconds;

    [Fact]
    public void ThereIsNoExtraRadiusWithoutACountdown()
    {
        var framing = new KerbcastLaunchFraming();

        Assert.Equal(0.0, framing.RadiusM(5.0, true));
        Assert.False(framing.Active);
    }

    [Fact]
    public void TheRadiusGrowsOverTheCountdownAndIsTheWidestAtZero()
    {
        var framing = new KerbcastLaunchFraming();
        framing.Start(10.0, 10.0);

        Assert.Equal(0.0, framing.RadiusM(100.0, true), 6);
        Assert.Equal(Widest * KerbcastLaunchFraming.Ease(0.5), framing.RadiusM(105.0, true), 6);
        Assert.Equal(Widest, framing.RadiusM(110.0, true), 6);
    }

    [Fact]
    public void ACountdownThatStartsPartWayInBeginsPartWayUp()
    {
        var framing = new KerbcastLaunchFraming();
        framing.Start(5.0, 20.0);

        Assert.Equal(Widest * KerbcastLaunchFraming.Ease(0.75), framing.RadiusM(100.0, true), 6);
        Assert.Equal(Widest, framing.RadiusM(105.0, true), 6);
    }

    [Fact]
    public void TheRadiusStaysWideWhileTheCraftIsOnTheGround()
    {
        var framing = new KerbcastLaunchFraming();
        framing.Start(2.0, 2.0);
        framing.RadiusM(0.0, true);

        Assert.Equal(Widest, framing.RadiusM(10.0, true));
        Assert.Equal(Widest, framing.RadiusM(15.0, true));
        Assert.True(framing.Active);
    }

    [Fact]
    public void TheRadiusEasesBackOnceTheCraftIsOffTheGroundAndEndsAtNothing()
    {
        var framing = new KerbcastLaunchFraming();
        framing.Start(2.0, 2.0);
        framing.RadiusM(0.0, true);
        framing.RadiusM(3.0, true);

        Assert.Equal(Widest, framing.RadiusM(4.0, false), 6);
        Assert.Equal(Widest * (1.0 - KerbcastLaunchFraming.Ease(0.5)), framing.RadiusM(4.0 + Ease / 2.0, false), 6);
        Assert.Equal(0.0, framing.RadiusM(4.0 + Ease, false), 6);
        Assert.False(framing.Active);
    }

    [Fact]
    public void ACraftThatNeverLeavesTheGroundEasesBackAfterTheHold()
    {
        var framing = new KerbcastLaunchFraming();
        framing.Start(1.0, 1.0);
        framing.RadiusM(0.0, true);

        var zeroAt = 1.0;
        Assert.Equal(Widest, framing.RadiusM(zeroAt + KerbcastLaunchFraming.HoldSeconds - 1.0, true));
        Assert.Equal(Widest, framing.RadiusM(zeroAt + KerbcastLaunchFraming.HoldSeconds, true));
        Assert.Equal(0.0, framing.RadiusM(zeroAt + KerbcastLaunchFraming.HoldSeconds + Ease, true), 6);
    }

    [Fact]
    public void ACalledOffCountdownEasesBackFromWhereItHadGot()
    {
        var framing = new KerbcastLaunchFraming();
        framing.Start(10.0, 10.0);
        framing.RadiusM(0.0, true);
        var half = Widest * KerbcastLaunchFraming.Ease(0.5);
        Assert.Equal(half, framing.RadiusM(5.0, true), 6);

        framing.Cancel();

        Assert.Equal(half, framing.RadiusM(5.0, true), 6);
        Assert.Equal(half * (1.0 - KerbcastLaunchFraming.Ease(0.5)), framing.RadiusM(5.0 + Ease / 2.0, true), 6);
        Assert.Equal(0.0, framing.RadiusM(5.0 + Ease, true), 6);
    }

    [Fact]
    public void ACancelWithNothingRunningChangesNothing()
    {
        var framing = new KerbcastLaunchFraming();

        framing.Cancel();

        Assert.Equal(0.0, framing.RadiusM(1.0, true));
        Assert.False(framing.Active);
    }

    [Fact]
    public void TheCurveRisesSteadilyWithNoChangeInSpeedAtEitherEnd()
    {
        var last = 0.0;
        for (var i = 1; i <= 100; i++)
        {
            var value = KerbcastLaunchFraming.Ease(i / 100.0);
            Assert.True(value > last, $"step {i}");
            last = value;
        }
        Assert.Equal(0.0, KerbcastLaunchFraming.Ease(0.0));
        Assert.Equal(1.0, KerbcastLaunchFraming.Ease(1.0));

        const double h = 1e-4;
        Assert.True((KerbcastLaunchFraming.Ease(h) - KerbcastLaunchFraming.Ease(0.0)) / h < 0.01);
        Assert.True((KerbcastLaunchFraming.Ease(1.0) - KerbcastLaunchFraming.Ease(1.0 - h)) / h < 0.01);
    }

    [Fact]
    public void TheCurveTakesLongerToSettleThanToStart()
    {
        Assert.True(1.0 - TimeToReach(0.9) > TimeToReach(0.1), "from 90 percent to the end against from the start to 10 percent");
        Assert.True(1.0 - TimeToReach(0.99) > TimeToReach(0.01));
    }

    private static double TimeToReach(double level)
    {
        var low = 0.0;
        var high = 1.0;
        for (var i = 0; i < 60; i++)
        {
            var mid = (low + high) / 2.0;
            if (KerbcastLaunchFraming.Ease(mid) < level)
            {
                low = mid;
            }
            else
            {
                high = mid;
            }
        }
        return low;
    }

    [Fact]
    public void ThePullInIsLongerThanOneSecondSoItIsNotASnap()
    {
        Assert.True(Ease >= 2.0);
    }
}
