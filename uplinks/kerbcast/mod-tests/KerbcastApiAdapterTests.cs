using System;
using Gonogo.KerbcastUplink;
using Kerbcast.Api;
using Kerbcast.Api.Testing;
using Xunit;

namespace GonogoKerbcastUplink.Tests;

/// <summary>
/// The camera half of the Uplink over Kerbcast.API: the active craft's part
/// cameras by its id, docking facts as Kerbcast reports them, and typed absence
/// whenever Kerbcast is not running or lacks a feature.
/// </summary>
[Collection(KerbcastInstance.Name)]
public class KerbcastApiAdapterTests
{
    private static readonly Guid Craft = Guid.Parse("11111111-1111-1111-1111-111111111111");

    [Fact]
    public void ACraftsPartCamerasAreReadWithTheirDockingFacts()
    {
        using var kc = RecordingKerbcast.Install();
        kc.Cameras.Add(new CameraView
        {
            FlightId = 7, Kind = CameraKind.Part, Name = "NavCam", VesselPersistentId = 42, VesselId = Craft,
            PartFlightId = 9, PartName = "dockingPort2", HasDockingNode = true, DockingNodeType = "size1",
            DockingNodeState = "", SupportsZoom = true, Fov = 30, FovMin = 5, FovMax = 60,
        });

        var view = Assert.Single(new KerbcastApiAdapter().CamerasFor(Craft));

        Assert.Equal(7u, view.FlightId);
        Assert.Equal(9u, view.PartFlightId);
        Assert.Equal("NavCam", view.CameraName);
        var docking = DockingCameraFacts.FromView(view);
        Assert.True(docking.IsDockingCamera);
        Assert.Equal("size1", docking.NodeType);
        Assert.Null(docking.State);
    }

    [Fact]
    public void ACameraWhoseDockingNodeCouldNotBeReadIsUndetermined()
    {
        var unread = DockingCameraFacts.FromView(new KerbcastView { HasDockingNode = null });
        var none = DockingCameraFacts.FromView(new KerbcastView { HasDockingNode = false });

        Assert.Null(unread.IsDockingCamera);
        Assert.False(none.IsDockingCamera);
    }

    [Fact]
    public void NoKerbcastInTheSceneIsInactiveWithNoCamerasAndUnknownReach()
    {
        var adapter = new KerbcastApiAdapter();

        Assert.False(adapter.IsActive());
        Assert.Empty(adapter.CamerasFor(Craft));
        Assert.Null(adapter.SidecarAlive());
        Assert.Equal(KerbcastReach.Unknown, adapter.Reach());
        Assert.Null(adapter.SetFov(7, 20f));
    }

    [Fact]
    public void AKerbcastWithoutCraftIdentityListsNoCamerasRatherThanThrowing()
    {
        using var kc = RecordingKerbcast.Install();
        kc.Cameras.Add(new CameraView { FlightId = 7, Kind = CameraKind.Part, VesselPersistentId = 42, VesselId = Craft });
        kc.SetSupported(f => f != ApiFeature.CraftIdentity);

        Assert.Empty(new KerbcastApiAdapter().CamerasFor(Craft));
    }

    [Fact]
    public void TheThrottleIsTheSavesAndAbsentWithNoSave()
    {
        using var kc = RecordingKerbcast.Install();
        var adapter = new KerbcastApiAdapter();

        Assert.Null(adapter.ThrottleUnavailable());
        Assert.True(adapter.WriteThrottle(true));
        Assert.True(adapter.ReadThrottle());

        kc.Cameras.Throttle.Value = null;
        Assert.Equal("no save loaded", adapter.ThrottleUnavailable());
        Assert.False(adapter.WriteThrottle(true));

        kc.SetSupported(f => f != ApiFeature.Throttle);
        Assert.Equal("this Kerbcast has no main-render throttle", adapter.ThrottleUnavailable());
    }

    [Fact]
    public void ActiveAndReachComeFromTheRunningKerbcast()
    {
        using var kc = RecordingKerbcast.Install();
        kc.BindAddress = "0.0.0.0";
        kc.Port = 9000;
        kc.BindIsLoopback = false;
        var adapter = new KerbcastApiAdapter();

        Assert.True(adapter.IsActive());
        var reach = adapter.Reach();
        Assert.NotSame(KerbcastReach.Unknown, reach);
        Assert.Equal(
            new KerbcastReach("0.0.0.0", 9000, false).Facts().Count,
            reach.Facts().Count);
        Assert.NotEmpty(reach.Facts());
    }
}

/// <summary>Tests that install a recorder as <see cref="KerbcastApi.Instance"/>, which is process-wide, run one at a time.</summary>
[CollectionDefinition(Name, DisableParallelization = true)]
public sealed class KerbcastInstance
{
    public const string Name = "KerbcastApi.Instance";
}
