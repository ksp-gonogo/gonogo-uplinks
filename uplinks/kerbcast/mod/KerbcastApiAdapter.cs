using System;
using System.Collections.Generic;
using System.Reflection;
using System.Runtime.CompilerServices;
using Kerbcast.Api;

namespace Gonogo.KerbcastUplink
{
    /// <summary>
    /// <see cref="IKerbcastApi"/> over Kerbcast.API's <see cref="KerbcastApi.Instance"/>.
    /// Main thread only, as Kerbcast's cameras are.
    ///
    /// <para>Constructed only through <see cref="KerbcastBinding.Bind"/>, after
    /// Kerbcast.API is known to be loaded. Each member that names a Kerbcast.API
    /// type sits in its own non-inlined method, because the JIT resolves a
    /// method's type references when it compiles it: an API that moved a member
    /// fails the one call, not the whole class. The constructor compiles all of
    /// them up front so a moved surface fails the bind, with a reason.</para>
    /// </summary>
    public sealed class KerbcastApiAdapter : IKerbcastApi
    {
        public KerbcastApiAdapter()
        {
            const BindingFlags all = BindingFlags.Public | BindingFlags.NonPublic
                | BindingFlags.Static | BindingFlags.Instance | BindingFlags.DeclaredOnly;
            foreach (var method in typeof(KerbcastApiAdapter).GetMethods(all))
            {
                if (!method.IsAbstract && !method.ContainsGenericParameters)
                {
                    RuntimeHelpers.PrepareMethod(method.MethodHandle);
                }
            }
        }

        public bool IsActive()
        {
            try
            {
                return ActiveCore();
            }
            catch (Exception)
            {
                return false;
            }
        }

        public bool? SidecarAlive()
        {
            try
            {
                return SidecarAliveCore();
            }
            catch (Exception)
            {
                return null;
            }
        }

        public KerbcastReach Reach()
        {
            try
            {
                return ReachCore();
            }
            catch (Exception)
            {
                return KerbcastReach.Unknown;
            }
        }

        public IReadOnlyList<KerbcastView> CamerasFor(Guid vesselId)
        {
            if (vesselId == Guid.Empty)
            {
                return Array.Empty<KerbcastView>();
            }
            try
            {
                return CamerasForCore(vesselId);
            }
            catch (Exception)
            {
                return Array.Empty<KerbcastView>();
            }
        }

        public bool? SetFov(uint flightId, float fov)
        {
            try
            {
                return SetFovCore(flightId, fov);
            }
            catch (Exception)
            {
                return null;
            }
        }

        public string? SetCommandAim(uint flightId, uint subjectPersistentId)
        {
            try
            {
                return SetCommandAimCore(flightId, subjectPersistentId);
            }
            catch (Exception)
            {
                return null;
            }
        }

        public bool? SetPan(uint flightId, float yaw, float pitch)
        {
            try
            {
                return SetPanCore(flightId, yaw, pitch);
            }
            catch (Exception)
            {
                return null;
            }
        }

        public string? ThrottleUnavailable()
        {
            try
            {
                return ThrottleUnavailableCore();
            }
            catch (Exception)
            {
                return "no save loaded";
            }
        }

        public bool? ReadThrottle()
        {
            try
            {
                return ThrottleCore()?.MainScreen;
            }
            catch (Exception)
            {
                return null;
            }
        }

        public bool WriteThrottle(bool on)
        {
            try
            {
                var throttle = ThrottleCore();
                return throttle != null && throttle.SetMainScreen(on);
            }
            catch (Exception)
            {
                return false;
            }
        }

        [MethodImpl(MethodImplOptions.NoInlining)]
        private static bool ActiveCore() => KerbcastApi.Instance != null;

        [MethodImpl(MethodImplOptions.NoInlining)]
        private static bool? SidecarAliveCore() => KerbcastApi.Instance?.SidecarAlive;

        [MethodImpl(MethodImplOptions.NoInlining)]
        private static KerbcastReach ReachCore()
        {
            var kerbcast = KerbcastApi.Instance;
            return kerbcast == null
                ? KerbcastReach.Unknown
                : new KerbcastReach(kerbcast.BindAddress, kerbcast.Port, kerbcast.BindIsLoopback);
        }

        [MethodImpl(MethodImplOptions.NoInlining)]
        private static IReadOnlyList<KerbcastView> CamerasForCore(Guid vesselId)
        {
            var kerbcast = KerbcastApi.Instance;
            if (kerbcast == null || !KerbcastApi.Supports(ApiFeature.CraftIdentity))
            {
                return Array.Empty<KerbcastView>();
            }
            var views = kerbcast.Cameras.CamerasFor(vesselId);
            var result = new List<KerbcastView>(views.Count);
            foreach (var view in views)
            {
                if (view != null)
                {
                    result.Add(Read(view));
                }
            }
            return result;
        }

        [MethodImpl(MethodImplOptions.NoInlining)]
        private static bool? SetFovCore(uint flightId, float fov)
        {
            var kerbcast = KerbcastApi.Instance;
            return kerbcast == null || !KerbcastApi.Supports(ApiFeature.CameraControl)
                ? (bool?)null
                : kerbcast.Cameras.SetFov(flightId, fov);
        }

        [MethodImpl(MethodImplOptions.NoInlining)]
        private static bool? SetPanCore(uint flightId, float yaw, float pitch)
        {
            var kerbcast = KerbcastApi.Instance;
            return kerbcast == null || !KerbcastApi.Supports(ApiFeature.CameraControl)
                ? (bool?)null
                : kerbcast.Cameras.SetPan(flightId, yaw, pitch);
        }

        [MethodImpl(MethodImplOptions.NoInlining)]
        private static string? SetCommandAimCore(uint flightId, uint subjectPersistentId)
        {
            var kerbcast = KerbcastApi.Instance;
            return kerbcast == null || !KerbcastApi.Supports(ApiFeature.CommandFeeds)
                ? null
                : kerbcast.Command.SetAim(flightId, Aim.Vessel(subjectPersistentId, 0.0, false), KerbcastAuthority.Owner).ToString();
        }

        [MethodImpl(MethodImplOptions.NoInlining)]
        private static string? ThrottleUnavailableCore()
        {
            if (KerbcastApi.Instance != null && !KerbcastApi.Supports(ApiFeature.Throttle))
            {
                return "this Kerbcast has no main-render throttle";
            }
            return ThrottleCore()?.MainScreen == null ? "no save loaded" : null;
        }

        [MethodImpl(MethodImplOptions.NoInlining)]
        private static ThrottleSettings? ThrottleCore()
        {
            var kerbcast = KerbcastApi.Instance;
            return kerbcast == null || !KerbcastApi.Supports(ApiFeature.Throttle) ? null : kerbcast.Cameras.Throttle;
        }

        [MethodImpl(MethodImplOptions.NoInlining)]
        private static KerbcastView Read(CameraView view) => new KerbcastView
        {
            FlightId = view.FlightId,
            PartFlightId = view.PartFlightId == 0 ? (uint?)null : view.PartFlightId,
            CameraName = view.Name,
            PartName = view.PartName,
            PartTitle = view.PartTitle,
            SupportsZoom = view.SupportsZoom,
            SupportsPan = view.SupportsPan,
            Fov = view.Fov,
            FovMin = view.FovMin,
            FovMax = view.FovMax,
            PanYaw = view.PanYaw,
            PanPitch = view.PanPitch,
            PanYawMin = view.PanYawMin,
            PanYawMax = view.PanYawMax,
            PanPitchMin = view.PanPitchMin,
            PanPitchMax = view.PanPitchMax,
            HasDockingNode = view.HasDockingNode,
            DockingNodeType = view.DockingNodeType,
            DockingNodeState = view.DockingNodeState,
        };
    }

    /// <summary>
    /// The Kerbcast.API 1.1 members this Uplink uses, behind a guard on
    /// <see cref="KerbcastApi.ApiMinor"/>. Kept out of <see cref="KerbcastApiAdapter"/> because
    /// that class compiles every method when it binds: a member an older Kerbcast lacks would
    /// fail the whole bind rather than the one call.
    /// </summary>
    public static class KerbcastApiMinor1
    {
        /// <summary>Whether this Kerbcast implements API 1.1 or later; false when it cannot be asked.</summary>
        public static bool Supported()
        {
            try
            {
                return MinorCore() >= 1;
            }
            catch (Exception)
            {
                return false;
            }
        }

        /// <summary>
        /// Gives the state-vector record last added to <paramref name="builder"/> a net acceleration
        /// in metres per second squared, gravity included. Call it only when <see cref="Supported"/>.
        /// </summary>
        [MethodImpl(MethodImplOptions.NoInlining)]
        public static void Accelerate(WorldModelBuilder builder, double x, double y, double z) =>
            builder.Acceleration(new Vec3d(x, y, z));

        [MethodImpl(MethodImplOptions.NoInlining)]
        private static int MinorCore() => KerbcastApi.ApiMinor;
    }

    /// <summary>
    /// The Kerbcast.API 1.5 members this Uplink uses, behind a guard on
    /// <see cref="KerbcastApi.ApiMinor"/>, kept out of <see cref="KerbcastApiAdapter"/> for the
    /// reason <see cref="KerbcastApiMinor1"/> is.
    /// </summary>
    public static class KerbcastApiMinor5
    {
        /// <summary>Whether this Kerbcast implements API 1.5 or later; false when it cannot be asked.</summary>
        public static bool Supported()
        {
            try
            {
                return MinorCore() >= 5;
            }
            catch (Exception)
            {
                return false;
            }
        }

        /// <summary>Whether a command feed is a tracking network camera. Call it only when <see cref="Supported"/>.</summary>
        [MethodImpl(MethodImplOptions.NoInlining)]
        public static bool IsNetwork(CommandFeed feed) => feed.Network;

        /// <summary>Whether a command feed has no aim of its own, so it follows the default craft. Call it only when <see cref="Supported"/>.</summary>
        [MethodImpl(MethodImplOptions.NoInlining)]
        public static bool FollowsActive(CommandFeed feed) => feed.FollowsActiveVessel;

        /// <summary>A tracking network's vantages, empty when it has none or they cannot be read. Call it only when <see cref="Supported"/>.</summary>
        [MethodImpl(MethodImplOptions.NoInlining)]
        public static IReadOnlyList<NetworkVantageStatus> Vantages(IKerbcast kerbcast, uint flightId)
        {
            try
            {
                return kerbcast.Command.NetworkStatus(flightId) ?? Array.Empty<NetworkVantageStatus>();
            }
            catch (Exception)
            {
                return Array.Empty<NetworkVantageStatus>();
            }
        }

        /// <summary>
        /// Whether a lens at <paramref name="vantage"/> sees a point at <paramref name="ut"/>, or an answer
        /// that is not Known when it cannot be asked. Call it only when <see cref="Supported"/>.
        /// </summary>
        /// <summary>The smallest angle the camera resolves along a tested line, in radians; NaN when this Kerbcast does not report it. Call it only when <see cref="ApiFeature.VantageResolution"/> is supported.</summary>
        public static double ResolutionRad(LineOfSightResult line)
        {
            try
            {
                return ResolutionCore(line);
            }
            catch (Exception)
            {
                return double.NaN;
            }
        }

        [MethodImpl(MethodImplOptions.NoInlining)]
        private static double ResolutionCore(LineOfSightResult line) => line.ResolutionRad;

        [MethodImpl(MethodImplOptions.NoInlining)]
        public static LineOfSightResult Sight(IKerbcast kerbcast, NetworkVantage vantage, double ut, int bodyIndex, double[] position, double? radiusM = null)
        {
            try
            {
                return kerbcast.Command.LineOfSight(vantage, ut, bodyIndex, new Vec3d(position[0], position[1], position[2]), radiusM ?? double.NaN);
            }
            catch (Exception)
            {
                return new LineOfSightResult(false, false, null, false, double.NaN);
            }
        }

        [MethodImpl(MethodImplOptions.NoInlining)]
        private static int MinorCore() => KerbcastApi.ApiMinor;
    }

    /// <summary>
    /// The Kerbcast.API 1.2 members this Uplink uses, behind a guard on
    /// <see cref="KerbcastApi.ApiMinor"/>, kept out of <see cref="KerbcastApiAdapter"/> for the
    /// reason <see cref="KerbcastApiMinor1"/> is.
    /// </summary>
    public static class KerbcastApiMinor2
    {
        /// <summary>Whether this Kerbcast implements API 1.2 or later; false when it cannot be asked.</summary>
        public static bool Supported()
        {
            try
            {
                return MinorCore() >= 2;
            }
            catch (Exception)
            {
                return false;
            }
        }

        /// <summary>
        /// Whether command feed <paramref name="flightId"/> reports its view blocked. False when it
        /// is unknown or cannot be read. Call it only when <see cref="Supported"/>.
        /// </summary>
        public static bool Occluded(IKerbcast kerbcast, uint flightId)
        {
            try
            {
                return OccludedCore(kerbcast, flightId);
            }
            catch (Exception)
            {
                return false;
            }
        }

        [MethodImpl(MethodImplOptions.NoInlining)]
        private static bool OccludedCore(IKerbcast kerbcast, uint flightId) => kerbcast.Cameras.View(flightId)?.Occluded == true;

        [MethodImpl(MethodImplOptions.NoInlining)]
        private static int MinorCore() => KerbcastApi.ApiMinor;
    }

}
