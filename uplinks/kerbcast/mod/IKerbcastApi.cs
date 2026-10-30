using System;
using System.Collections.Generic;
using System.Linq;

namespace Gonogo.KerbcastUplink
{
    /// <summary>
    /// What this Uplink asks of kerbcast's cameras, in terms that name no
    /// kerbcast or KSP type, so everything above it can be tested headless
    /// against a fake. <see cref="KerbcastApiAdapter"/> is the one implementation,
    /// over Kerbcast.API, built only after <see cref="KerbcastBinding"/> has
    /// confirmed the assembly is loaded and its surface resolves.
    ///
    /// <para>Every member is fail-soft: a call kerbcast cannot answer yields
    /// typed absence (<c>null</c>, empty, or <c>false</c> for a write), never a
    /// value that would read as kerbcast saying no.</para>
    /// </summary>
    public interface IKerbcastApi
    {
        /// <summary>Whether kerbcast is running in this scene: in flight or at the Space Center.</summary>
        bool IsActive();

        /// <summary>
        /// Whether kerbcast's video sidecar process is alive, or null when nobody
        /// could ask. Null is never false: false is a positive claim that the
        /// sidecar is down, which <see cref="SidecarDeathDebouncer"/> latches on.
        /// </summary>
        bool? SidecarAlive();

        /// <summary>Where kerbcast's camera feeds listen, or <see cref="KerbcastReach.Unknown"/> when nobody could ask.</summary>
        KerbcastReach Reach();

        /// <summary>kerbcast's part cameras on one craft, by its <c>Vessel.id</c>, or empty.</summary>
        IReadOnlyList<KerbcastView> CamerasFor(Guid vesselId);

        /// <summary>Applies a field-of-view change. False is kerbcast's own rejection of the id; null means the call could not be made.</summary>
        bool? SetFov(uint flightId, float fov);

        /// <summary>Applies an absolute pan. False is kerbcast's own rejection of the id; null means the call could not be made.</summary>
        bool? SetPan(uint flightId, float yaw, float pitch);

        /// <summary>Why the main-render throttle cannot be reached, or null when it can.</summary>
        string? ThrottleUnavailable();

        /// <summary>The throttle held by the loaded save, or null when it could not be read.</summary>
        bool? ReadThrottle();

        /// <summary>Sets the throttle on the loaded save. False when it could not be written.</summary>
        bool WriteThrottle(bool on);
    }

    /// <summary>
    /// A plain, kerbcast-type-free reading of one part camera.
    ///
    /// <para>Every field is nullable: an unreadable member is typed absence,
    /// never a 0 the wire would misreport as a real reading.</para>
    /// </summary>
    public struct KerbcastView
    {
        public uint? FlightId;
        public uint? PartFlightId;
        public string? CameraName;
        public string? PartName;
        public string? PartTitle;
        public bool? SupportsZoom;
        public bool? SupportsPan;
        public double? Fov;
        public double? FovMin;
        public double? FovMax;
        public double? PanYaw;
        public double? PanPitch;
        public double? PanYawMin;
        public double? PanYawMax;
        public double? PanPitchMin;
        public double? PanPitchMax;

        /// <summary>Whether the camera's part has a docking node; null when kerbcast could not read it.</summary>
        public bool? HasDockingNode;
        public string? DockingNodeType;
        public string? DockingNodeState;
    }

    /// <summary>
    /// The outcome of reaching for kerbcast: a usable <see cref="Api"/>, or the
    /// <see cref="Reason"/> there is none, which the Uplink reports as its
    /// unavailability reason rather than going silently dark.
    /// </summary>
    public sealed class KerbcastBinding
    {
        public const string KerbcastAssemblyName = "Kerbcast.API";

        public IKerbcastApi? Api { get; }

        /// <summary>Why there is no <see cref="Api"/>; null when there is one.</summary>
        public string? Reason { get; }

        private KerbcastBinding(IKerbcastApi? api, string? reason)
        {
            Api = api;
            Reason = reason;
        }

        /// <summary>Whether Kerbcast.API is loaded in this process.</summary>
        public static bool IsKerbcastLoaded() =>
            AppDomain.CurrentDomain.GetAssemblies().Any(a => string.Equals(
                a.GetName().Name, KerbcastAssemblyName, StringComparison.OrdinalIgnoreCase));

        /// <summary>
        /// Binds to kerbcast. <paramref name="create"/> is the only code that
        /// touches kerbcast's types, so it runs only when kerbcast is loaded, and a
        /// type or member that moved surfaces here as a reason, not as a crash
        /// the first time a tick reaches for it.
        /// </summary>
        public static KerbcastBinding Bind(bool kerbcastLoaded, Func<IKerbcastApi> create)
        {
            if (!kerbcastLoaded)
            {
                return new KerbcastBinding(null, "kerbcast mod not installed (Kerbcast.API assembly not loaded)");
            }
            try
            {
                return new KerbcastBinding(create(), null);
            }
            catch (Exception e) when (e is TypeLoadException or MissingMemberException or System.IO.FileLoadException or System.IO.FileNotFoundException or TypeInitializationException)
            {
                return new KerbcastBinding(null,
                    "kerbcast's API surface has moved (" + e.GetType().Name + "): unsupported kerbcast version");
            }
        }
    }
}
