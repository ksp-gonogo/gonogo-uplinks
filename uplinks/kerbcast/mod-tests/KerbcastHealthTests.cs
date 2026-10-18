using Gonogo.KerbcastUplink;
using Sitrep.Contract;
using Xunit;

namespace GonogoKerbcastUplink.Tests;

/// <summary>
/// The mandatory healthcheck's state machine: the reason the kerbcast Uplink
/// exists (see <see cref="KerbcastHealth"/>'s doc and commit 45111e44).
///
/// <para>These assert the distinctions, not just the enum: an operator looking
/// at a black camera feed must be able to tell "kerbcast isn't installed" from
/// "idle outside a flight" from "the sidecar died" from "your craft has no camera
/// on it", because those are four different fixes.</para>
/// </summary>
public class KerbcastHealthTests
{
    private static UplinkHealth Eval(
        string? reason = null, bool inFlight = true, bool coreActive = true, bool settled = false,
        bool sidecarAlive = true, int cameras = 2) =>
        KerbcastHealth.Evaluate(reason, inFlight, coreActive, settled, sidecarAlive, cameras);

    [Fact]
    public void ReportsUnavailableWithTheRegistrationReason_WhenKerbcastIsAbsent()
    {
        var health = Eval("kerbcast mod not installed", inFlight: false, coreActive: false);

        Assert.Equal(UplinkHealthState.Unavailable, health.State);
        Assert.Equal("kerbcast mod not installed", health.Detail);
    }

    [Fact]
    public void UnavailableReasonWins_EvenIfLaterStateLooksHealthy()
    {
        var health = Eval("unsupported kerbcast version", cameras: 4);

        Assert.Equal(UplinkHealthState.Unavailable, health.State);
    }

    [Theory]
    [InlineData(false, false)]
    [InlineData(true, false)]
    [InlineData(false, true)]
    public void IsHealthyAndIdle_OutsideAFlight_WhateverTheCoreAndSidecarSay(bool coreActive, bool sidecarAlive)
    {
        var health = Eval(inFlight: false, coreActive: coreActive, settled: true,
            sidecarAlive: sidecarAlive, cameras: 0);

        Assert.Equal(UplinkHealthState.Healthy, health.State);
        Assert.Contains("idle until a flight", health.Detail);
    }

    [Fact]
    public void IsUnavailable_InAFlight_WhenTheCoreStaysDownPastTheSettleWindow()
    {
        var health = Eval(coreActive: false, settled: true);

        Assert.Equal(UplinkHealthState.Unavailable, health.State);
        Assert.Contains("KSP.log", health.Detail);
    }

    [Fact]
    public void IsNotAFault_WhileTheFlightSceneIsStillLoading()
    {
        var health = Eval(coreActive: false, settled: false);

        Assert.Equal(UplinkHealthState.Degraded, health.State);
        Assert.Contains("starting", health.Detail);
    }

    [Fact]
    public void ReportsDegradedSidecarProblem_InAFlight_WhenTheSidecarIsConfirmedDead()
    {
        var health = Eval(sidecarAlive: false, cameras: 3);

        Assert.Equal(UplinkHealthState.Degraded, health.State);
        Assert.Contains("sidecar", health.Detail);
    }

    [Fact]
    public void ReportsDegradedCraftProblem_InAFlight_WhenNoCamerasOnTheVessel()
    {
        var health = Eval(cameras: 0);

        Assert.Equal(UplinkHealthState.Degraded, health.State);
        Assert.Contains("no camera parts", health.Detail);
    }

    [Fact]
    public void TreatsAnUnsetCameraCountAsDegraded_NotHealthy()
    {
        Assert.Equal(UplinkHealthState.Degraded, Eval(cameras: -1).State);
    }

    [Fact]
    public void ReportsHealthyWithTheCameraCount_InAFlightWithCameras()
    {
        var health = Eval(cameras: 3);

        Assert.Equal(UplinkHealthState.Healthy, health.State);
        Assert.Equal("3 cameras", health.Detail);
    }

    [Fact]
    public void SingularisesTheOneCameraCase()
    {
        Assert.Equal("1 camera", Eval(cameras: 1).Detail);
    }
}

public class FlightCoreWatchTests
{
    [Fact]
    public void SettlesOnlyAfterTheWindowWithTheCoreDown()
    {
        var watch = new FlightCoreWatch();
        watch.Observe(true, false, 100);
        Assert.False(watch.Settled);
        watch.Observe(true, false, 100 + FlightCoreWatch.SettleSeconds - 0.1);
        Assert.False(watch.Settled);
        watch.Observe(true, false, 100 + FlightCoreWatch.SettleSeconds);
        Assert.True(watch.Settled);
    }

    [Fact]
    public void RestartsTheWindow_WhenTheCoreComesUpOrTheSceneIsLeft()
    {
        var watch = new FlightCoreWatch();
        watch.Observe(true, false, 0);
        watch.Observe(true, false, 50);
        Assert.True(watch.Settled);

        watch.Observe(false, false, 51);
        Assert.False(watch.Settled);
        watch.Observe(true, false, 52);
        watch.Observe(true, false, 53);
        Assert.False(watch.Settled);

        watch.Observe(true, true, 54);
        watch.Observe(true, false, 55);
        Assert.False(watch.Settled);
    }
}
