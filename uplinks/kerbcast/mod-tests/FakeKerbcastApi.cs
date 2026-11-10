using System;
using System.Collections.Generic;
using Gonogo.KerbcastUplink;

namespace GonogoKerbcastUplink.Tests;

/// <summary>A stand-in for kerbcast behind <see cref="IKerbcastApi"/>: scripted answers, and a record of what it was asked.</summary>
public sealed class FakeKerbcastApi : IKerbcastApi
{
    public bool Active = true;
    public bool? Sidecar = true;
    public List<KerbcastView> Cameras = new();
    public bool? FovResult = true;
    public bool? PanResult = true;
    public string? CommandAimResult = "Ok";
    public (uint FlightId, uint Subject)? LastCommandAim;
    public string? ThrottleReason;
    public bool? Throttle = false;
    public (uint FlightId, float Fov)? LastFov;
    public (uint FlightId, float Yaw, float Pitch)? LastPan;

    public KerbcastReach ReachResult = KerbcastReach.Unknown;

    public KerbcastReach Reach() => ReachResult;

    public bool IsActive() => Active;

    public bool? SidecarAlive() => Sidecar;

    public IReadOnlyList<KerbcastView> CamerasFor(Guid vesselId) => vesselId == Guid.Empty ? new List<KerbcastView>() : Cameras;

    public bool? SetFov(uint flightId, float fov)
    {
        LastFov = (flightId, fov);
        return FovResult;
    }

    public bool? SetPan(uint flightId, float yaw, float pitch)
    {
        LastPan = (flightId, yaw, pitch);
        return PanResult;
    }

    public string? SetCommandAim(uint flightId, uint subjectPersistentId)
    {
        LastCommandAim = (flightId, subjectPersistentId);
        return CommandAimResult;
    }

    public string? ThrottleUnavailable() => ThrottleReason;

    public bool? ReadThrottle() => ThrottleReason == null ? Throttle : null;

    public bool WriteThrottle(bool on)
    {
        if (ThrottleReason != null)
        {
            return false;
        }
        Throttle = on;
        return true;
    }
}
