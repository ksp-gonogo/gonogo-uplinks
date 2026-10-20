using System;
using System.Collections.Generic;
using System.Reflection;
using System.Runtime.CompilerServices;
using Kerbcast;

namespace Gonogo.KerbcastUplink
{
    /// <summary>
    /// <see cref="IKerbcastApi"/> over kerbcast's public static facade,
    /// <c>Kerbcast.KerbcastControl</c>, compiled against Kerbcast.dll (a normal
    /// reference, not bundled: kerbcast is installed beside this Uplink). A
    /// rename in kerbcast is a build error here.
    ///
    /// <para>Constructed only through <see cref="KerbcastBinding.Bind"/>, after
    /// kerbcast is known to be loaded. Each member that names a kerbcast type
    /// sits in its own non-inlined method, because the JIT resolves a method's
    /// type references when it compiles it: a kerbcast build that moved a member
    /// fails the one call, not the whole class. The constructor compiles all of
    /// them up front so a moved surface fails the bind, with a reason.</para>
    ///
    /// <para>Deliberately stays on the public <c>KerbcastControl</c> facade and
    /// off kerbcast's internals (<c>KerbcastSidecarHost</c> and the like).</para>
    /// </summary>
    public sealed class KerbcastControlApi : IKerbcastApi
    {
        public KerbcastControlApi()
        {
            const BindingFlags all = BindingFlags.Public | BindingFlags.NonPublic
                | BindingFlags.Static | BindingFlags.Instance | BindingFlags.DeclaredOnly;
            foreach (var method in typeof(KerbcastControlApi).GetMethods(all))
            {
                // The throttle node is optional: a Kerbcast without it still streams, so its absence degrades one setting rather than the bind.
                if (!method.IsAbstract && !method.ContainsGenericParameters && method.Name != nameof(ThrottleNode))
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

        public IReadOnlyList<KerbcastView> CamerasFor(object? vessel)
        {
            if (vessel is not Vessel stock)
            {
                return Array.Empty<KerbcastView>();
            }
            try
            {
                return CamerasForCore(stock);
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
                return KerbcastControl.SetFov(flightId, fov);
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
                return KerbcastControl.SetPan(flightId, yaw, pitch);
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
                return ThrottleNode() == null ? "no save loaded" : null;
            }
            catch (Exception e) when (e is MissingMemberException or TypeLoadException)
            {
                return "this Kerbcast has no main-render throttle";
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
                return ThrottleNode()?.ThrottleMainScreen;
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
                var node = ThrottleNode();
                if (node == null)
                {
                    return false;
                }
                node.ThrottleMainScreen = on;
                return true;
            }
            catch (Exception)
            {
                return false;
            }
        }

        [MethodImpl(MethodImplOptions.NoInlining)]
        private static bool ActiveCore() => KerbcastControl.IsActive;

        [MethodImpl(MethodImplOptions.NoInlining)]
        private static bool SidecarAliveCore() => KerbcastControl.SidecarAlive;

        [MethodImpl(MethodImplOptions.NoInlining)]
        private static IReadOnlyList<KerbcastView> CamerasForCore(Vessel vessel)
        {
            var views = KerbcastControl.CamerasFor(vessel);
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
        private static KerbcastView Read(KerbcastCameraView view) => new KerbcastView
        {
            FlightId = view.FlightId,
            PartFlightId = view.PartFlightId,
            CameraName = view.CameraName,
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
            Part = view.Part,
        };

        /// <summary>The loaded save's Kerbcast difficulty-settings node, or null with no save. Main thread only.</summary>
        [MethodImpl(MethodImplOptions.NoInlining)]
        private static KerbcastGameParameters? ThrottleNode() =>
            HighLogic.CurrentGame?.Parameters?.CustomParams<KerbcastGameParameters>();
    }
}
