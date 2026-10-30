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
}
