using System;
using System.Collections.Generic;
using System.Linq;

namespace Gonogo.KerbcastUplink
{
    /// <summary>
    /// What this Uplink asks of kerbcast, in terms that name no kerbcast or KSP
    /// type, so everything above it can be tested headless against a fake.
    /// <see cref="KerbcastControlApi"/> is the one implementation that touches
    /// kerbcast's assembly, and only after <see cref="KerbcastBinding"/> has
    /// confirmed it is loaded and its surface resolves.
    ///
    /// <para>Every member is fail-soft: a call kerbcast cannot answer yields
    /// typed absence (<c>null</c>, empty, or <c>false</c> for a write), never a
    /// value that would read as kerbcast saying no.</para>
    /// </summary>
    public interface IKerbcastApi
    {
        /// <summary>Whether kerbcast's core is live: a flight scene with the plugin running.</summary>
        bool IsActive();

        /// <summary>
        /// Whether kerbcast's video sidecar process is alive, or null when nobody
        /// could ask. Null is never false: false is a positive claim that the
        /// sidecar is down, which <see cref="SidecarDeathDebouncer"/> latches on.
        /// </summary>
        bool? SidecarAlive();

        /// <summary>kerbcast's camera views for one vessel (a stock KSP <c>Vessel</c>), or empty.</summary>
        IReadOnlyList<KerbcastView> CamerasFor(object? vessel);

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
    /// A plain, kerbcast-type-free reading of one <c>KerbcastCameraView</c>.
    /// Carries <see cref="Part"/> as a bare <c>object</c>: the value is a stock
    /// KSP <c>Part</c>, and keeping it untyped here keeps this struct headless.
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
        public object? Part;
    }

    /// <summary>
    /// The outcome of reaching for kerbcast: a usable <see cref="Api"/>, or the
    /// <see cref="Reason"/> there is none, which the Uplink reports as its
    /// unavailability reason rather than going silently dark.
    /// </summary>
    public sealed class KerbcastBinding
    {
        public const string KerbcastAssemblyName = "Kerbcast";

        public IKerbcastApi? Api { get; }

        /// <summary>Why there is no <see cref="Api"/>; null when there is one.</summary>
        public string? Reason { get; }

        private KerbcastBinding(IKerbcastApi? api, string? reason)
        {
            Api = api;
            Reason = reason;
        }

        /// <summary>Whether an assembly named Kerbcast is loaded in this process.</summary>
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
                return new KerbcastBinding(null, "kerbcast mod not installed (Kerbcast assembly not loaded)");
            }
            try
            {
                return new KerbcastBinding(create(), null);
            }
            catch (Exception e) when (e is TypeLoadException or MissingMemberException or System.IO.FileLoadException or System.IO.FileNotFoundException or TypeInitializationException)
            {
                return new KerbcastBinding(null,
                    "kerbcast's KerbcastControl surface has moved (" + e.GetType().Name + "): unsupported kerbcast version");
            }
        }
    }
}
