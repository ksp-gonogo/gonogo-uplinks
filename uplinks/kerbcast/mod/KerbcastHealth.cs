using Sitrep.Contract;

namespace Gonogo.KerbcastUplink
{
    /// <summary>
    /// The kerbcast mandatory healthcheck: as a pure function.
    ///
    /// <para>This is the reason the kerbcast Uplink exists. Before it, the only
    /// "Kerbcast health" surface read the browser's own
    /// <c>KerbcastDataSource.status</c>: a client-side view of a separate
    /// WebRTC connection, which bypassed the mod contract entirely and was
    /// deleted in <c>45111e44</c> ("the Uplinks list is contract-only"). An
    /// Uplink gets a healthcheck for free by implementing
    /// <see cref="ISitrepUplink.Health"/>; a bolted-on DataSource does not.
    /// This is that healthcheck.</para>
    ///
    /// <para>Extracted from <see cref="KerbcastUplink"/> as a pure function over
    /// its inputs so it can be exercised headless: the live uplink only ever
    /// touches KSP, and a state machine that decides what an operator is told
    /// when their camera feed is black deserves tests, not a live-only code
    /// path.</para>
    /// </summary>
    public static class KerbcastHealth
    {
        /// <summary>
        /// Decides the health state.
        ///
        /// <para>Outside a flight scene the Uplink is idle: kerbcast's capture
        /// core only runs in flight, so a stopped core or an absent sidecar is
        /// the normal state in the Space Centre, the VAB and the tracking
        /// station and reads Healthy. In a flight the cases are distinct,
        /// because they send the operator to different places: kerbcast
        /// refused to start (an install or graphics problem, Unavailable since
        /// no camera feed will carry anything), a sidecar problem (kerbcast's
        /// video process died and the feed will be black regardless of what's
        /// on the craft), or a craft problem (you flew something with no camera
        /// on it).</para>
        /// </summary>
        /// <param name="unavailableReason">
        /// Non-null when the uplink went inert at registration (kerbcast absent,
        /// or its reflection surface moved). Wins over everything else.
        /// </param>
        /// <param name="inFlight">Whether the loaded scene is a flight scene at the last sample.</param>
        /// <param name="coreActive">Whether kerbcast's capture core reported itself live at the last sample.</param>
        /// <param name="coreMissingSettled">
        /// True once the capture core has stayed down for the whole settle window
        /// of the current flight scene (see <see cref="FlightCoreWatch"/>), so the
        /// brief gap while the scene loads is not read as a refusal.
        /// </param>
        /// <param name="sidecarAlive">
        /// The debounced video-sidecar liveness (see <see cref="SidecarDeathDebouncer"/>):
        /// true unless two consecutive in-flight capture ticks have confirmed the
        /// sidecar process dead.
        /// </param>
        /// <param name="cameraCount">Cameras seen on the active vessel at the last sample.</param>
        /// <param name="reach">Where the camera feeds listen, reported as facts beside the state; null for none.</param>
        public static UplinkHealth Evaluate(
            string? unavailableReason, bool inFlight, bool coreActive, bool coreMissingSettled,
            bool sidecarAlive, int cameraCount, KerbcastReach? reach = null)
        {
            var facts = reach?.Facts();
            if (unavailableReason != null)
            {
                return new UplinkHealth(UplinkHealthState.Unavailable, unavailableReason);
            }
            if (!inFlight)
            {
                return new UplinkHealth(UplinkHealthState.Healthy,
                    "idle until a flight; video starts in flight", facts);
            }
            if (!coreActive)
            {
                if (coreMissingSettled)
                {
                    return new UplinkHealth(UplinkHealthState.Unavailable,
                        "kerbcast is not running in this flight; it may have refused to start (see its \"cannot start\" line in KSP.log)", facts);
                }
                // The flight scene is still loading: nothing to claim yet.
                return new UplinkHealth(UplinkHealthState.Degraded,
                    "kerbcast is starting with the flight scene", facts);
            }
            if (!sidecarAlive)
            {
                return new UplinkHealth(UplinkHealthState.Degraded,
                    "video sidecar not alive; feeds will be black", facts);
            }
            if (cameraCount <= 0)
            {
                return new UplinkHealth(UplinkHealthState.Degraded,
                    "kerbcast running, but the active vessel carries no camera parts", facts);
            }
            return new UplinkHealth(UplinkHealthState.Healthy,
                cameraCount == 1 ? "1 camera" : cameraCount + " cameras", facts);
        }
    }
}
