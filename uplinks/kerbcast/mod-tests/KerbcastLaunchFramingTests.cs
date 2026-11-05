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
        Assert.Equal(KerbcastLaunchFraming.Widened(0.5), framing.RadiusM(105.0, true), 6);
        Assert.Equal(Widest, framing.RadiusM(110.0, true), 6);
    }

    [Fact]
    public void ACountdownThatStartsPartWayInBeginsPartWayUp()
    {
        var framing = new KerbcastLaunchFraming();
        framing.Start(5.0, 20.0);

        Assert.Equal(KerbcastLaunchFraming.Widened(0.75), framing.RadiusM(100.0, true), 6);
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
        var half = KerbcastLaunchFraming.Widened(0.5);
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
    public void AnOccludedViewEasesTheHeldRadiusOutByTheOcclusionExtraAndBackOnceItClears()
    {
        var framing = new KerbcastLaunchFraming();
        framing.Start(1.0, 1.0);
        framing.RadiusM(0.0, true);
        var extra = KerbcastLaunchFraming.OcclusionExtraRadiusM;

        Assert.Equal(Widest, framing.RadiusM(2.0, true, true), 6);
        Assert.Equal(Widest + extra * KerbcastLaunchFraming.Ease(0.5), framing.RadiusM(2.0 + Ease / 2.0, true, true), 6);
        Assert.Equal(Widest + extra, framing.RadiusM(2.0 + Ease, true, true), 6);
        Assert.Equal(Widest + extra, framing.RadiusM(10.0, true, true), 6);

        Assert.Equal(Widest + extra, framing.RadiusM(10.0, true, false), 6);
        Assert.Equal(Widest + extra * (1.0 - KerbcastLaunchFraming.Ease(0.5)), framing.RadiusM(10.0 + Ease / 2.0, true, false), 6);
        Assert.Equal(Widest, framing.RadiusM(10.0 + Ease, true, false), 6);
    }

    [Fact]
    public void TheLeastOcclusionExtraIsOneMoreWidestStep()
    {
        Assert.Equal(KerbcastLaunchFraming.WidestRadiusM, KerbcastLaunchFraming.OcclusionExtraRadiusM);
    }

    [Fact]
    public void AViewThatClearsPartWayOutEasesBackFromWhereItHadGot()
    {
        var framing = new KerbcastLaunchFraming();
        framing.Start(1.0, 1.0);
        framing.RadiusM(0.0, true);
        var extra = KerbcastLaunchFraming.OcclusionExtraRadiusM;
        framing.RadiusM(2.0, true, true);
        var part = Widest + extra * KerbcastLaunchFraming.Ease(0.5);
        Assert.Equal(part, framing.RadiusM(2.0 + Ease / 2.0, true, true), 6);

        Assert.Equal(part, framing.RadiusM(2.0 + Ease / 2.0, true, false), 6);
        Assert.Equal(Widest + (part - Widest) * (1.0 - KerbcastLaunchFraming.Ease(0.5)), framing.RadiusM(2.0 + Ease, true, false), 6);
    }

    [Fact]
    public void OcclusionWithNoCountdownRunningStillEasesTheExtraInAndOut()
    {
        var framing = new KerbcastLaunchFraming();
        var extra = KerbcastLaunchFraming.OcclusionExtraRadiusM;

        Assert.Equal(0.0, framing.RadiusM(5.0, false, true), 6);
        Assert.Equal(extra * KerbcastLaunchFraming.Ease(0.5), framing.RadiusM(5.0 + Ease / 2.0, false, true), 6);
        Assert.Equal(extra, framing.RadiusM(5.0 + Ease, false, true), 6);
        Assert.True(framing.Active);

        Assert.Equal(extra, framing.RadiusM(20.0, false, false), 6);
        Assert.Equal(0.0, framing.RadiusM(20.0 + Ease, false, false), 6);
        Assert.False(framing.Active);
    }

    [Fact]
    public void TheOcclusionExtraGrowsWithTheRangeAboveItsFloor()
    {
        Assert.Equal(KerbcastLaunchFraming.OcclusionExtraRadiusM, KerbcastLaunchFraming.OcclusionExtraM(500.0));
        Assert.Equal(KerbcastLaunchFraming.OcclusionExtraRadiusM, KerbcastLaunchFraming.OcclusionExtraM(double.NaN));
        Assert.Equal(13619.0 / 128.0, KerbcastLaunchFraming.OcclusionExtraM(13619.0), 6);
    }

    [Fact]
    public void ARangeThatChangesEveryTickMovesTheExtraWithoutRestartingTheEase()
    {
        var framing = new KerbcastLaunchFraming();
        framing.RadiusM(0.0, false, true, 10000.0);

        var half = framing.RadiusM(Ease / 2.0, false, true, 12000.0);
        var done = framing.RadiusM(Ease, false, true, 14000.0);

        Assert.Equal(12000.0 / 128.0 * KerbcastLaunchFraming.Ease(0.5), half, 6);
        Assert.Equal(14000.0 / 128.0, done, 6);
    }

    [Fact]
    public void TheFramingStaysActiveWhileTheOcclusionExtraIsStillEasingBack()
    {
        var framing = new KerbcastLaunchFraming();
        framing.RadiusM(0.0, false, true);
        framing.RadiusM(Ease, false, true);

        framing.RadiusM(10.0, false, false);
        framing.RadiusM(10.0 + Ease / 2.0, false, false);
        Assert.True(framing.Active);

        Assert.Equal(0.0, framing.RadiusM(10.0 + Ease, false, false), 6);
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

    private static double ApparentSizeFraction(double progress)
    {
        var nominal = KerbcastLaunchFraming.NominalCraftRadiusM;
        var largest = 1.0 / nominal;
        var smallest = 1.0 / (nominal + Widest);
        var size = 1.0 / (nominal + KerbcastLaunchFraming.Widened(progress));
        return (largest - size) / (largest - smallest);
    }

    [Fact]
    public void TheWideningKeepsShrinkingTheCraftUntilTheLastFifteenPercentOfTheCountdown()
    {
        Assert.Equal(0.0, ApparentSizeFraction(0.0), 9);
        for (var i = 1; i <= 84; i++)
        {
            Assert.True(ApparentSizeFraction(i / 100.0) < 0.97, $"at {i} percent the craft is already within 3 percent of its smallest");
        }
        for (var i = 96; i <= 100; i++)
        {
            Assert.True(ApparentSizeFraction(i / 100.0) > 0.99, $"at {i} percent");
        }
        Assert.Equal(Widest, KerbcastLaunchFraming.Widened(1.0), 6);
    }

    [Fact]
    public void TheWideningIsSteadyWithNoChangeInSpeedAtEitherEnd()
    {
        var last = 0.0;
        for (var i = 1; i <= 100; i++)
        {
            var value = KerbcastLaunchFraming.Widened(i / 100.0);
            Assert.True(value >= last, $"step {i}");
            last = value;
        }
        const double h = 1e-4;
        Assert.True(ApparentSizeFraction(h) / h < 0.01);
        Assert.True((ApparentSizeFraction(1.0) - ApparentSizeFraction(1.0 - h)) / h < 0.01);
        Assert.True((ApparentSizeFraction(KerbcastLaunchFraming.WidenedByFraction) - ApparentSizeFraction(KerbcastLaunchFraming.WidenedByFraction - h)) / h < 0.01);
    }
}
