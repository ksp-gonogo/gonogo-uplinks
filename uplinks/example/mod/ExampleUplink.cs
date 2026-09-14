using System.Collections.Generic;
using Sitrep.Contract;

namespace GonogoExampleUplink
{
    /// <summary>
    /// The smallest Uplink that is still a real one: one channel, one publisher,
    /// no third-party mod and no live KSP API.
    ///
    /// <para>It publishes <c>example.heartbeat</c> off the shared
    /// <see cref="KspSnapshot"/>, which is the cheapest source there is: the
    /// snapshot is already built for the tick, so this reads a field rather than
    /// touching the game. That is why <see cref="Register"/> uses
    /// <c>AddChannelSource</c> and not the capture-on-main /
    /// handle-on-Courier <c>AddSampledSource</c> seam. Reach for that seam when you
    /// must read a live KSP or third-party API, because those are main-thread-only
    /// and a channel source's mapper runs on the Courier thread.</para>
    ///
    /// <para><b>The subscription prefix is deliberately absent.</b> The gated
    /// overload of <c>AddSampledSource</c> skips the capture entirely on any tick
    /// where nothing under its declared prefixes is subscribed, which is a pure
    /// win for a capture whose whole effect is its return value and a silent
    /// starvation for one that also writes state something else reads. This Uplink
    /// has nothing downstream of it, and the note is here because the next Uplink
    /// copied from this one might.</para>
    /// </summary>
    [SitrepUplink("example")]
    public sealed class ExampleUplink : ISitrepUplink
    {
        public const string HeartbeatTopic = "example.heartbeat";

        private double _ticks;

        public UplinkManifest Manifest { get; } = new UplinkManifest
        {
            Id = "example",
            Version = "1.0.0",
            Channels = new List<ChannelDeclaration>
            {
                new ChannelDeclaration
                {
                    Topic = HeartbeatTopic,
                    Delivery = Delivery.LossyLatest,
                    // TrueNow, not Delayed: a heartbeat is a fact about the
                    // connection rather than about a vessel, so it is not
                    // reveal-gated. Anything describing a vessel's state IS, and
                    // gets DelayRole.Delayed.
                    Delay = DelayRole.TrueNow,
                    Emission = new EmissionPolicy(
                        keyframeIntervalUt: 30,
                        quantum: EmissionQuantum.Absolute(0)),
                },
            },
        };

        public void Register(IUplinkHost host)
        {
            host.AddChannelSource(HeartbeatTopic, Sample);
        }

        /// <summary>
        /// Mandatory: <c>Health</c> is a member of the base contract rather than a
        /// virtual with a default, so an Uplink that never thinks about readiness
        /// does not compile. For an Uplink wrapping a third-party mod this is where
        /// "the assembly is not loaded" is reported, as
        /// <c>UplinkHealthState.Unavailable</c> with a reason. This one depends on
        /// nothing, so registered without error IS healthy, and the floor is one
        /// line.
        /// </summary>
        public UplinkHealth Health() => UplinkHealth.Healthy;

        /// <summary>
        /// Runs on the Courier thread, so it may touch nothing KSP-facing. The
        /// snapshot is null on a tick with nothing to report, and returning null
        /// publishes nothing rather than publishing a zero: a substituted zero is
        /// indistinguishable from a real reading downstream.
        ///
        /// <para><b>A non-null snapshot is not the same thing as a readable
        /// UT</b>, which is the whole reason <see cref="ReadableUt"/> exists.
        /// Copy it along with this file.</para>
        /// </summary>
        internal object? Sample(KspSnapshot? snapshot)
        {
            var ut = ReadableUt(snapshot);
            if (ut == null)
            {
                return null;
            }
            // Only a published tick counts: a `ticks` that also counted the
            // declined ones would be a second invented reading beside the first.
            _ticks += 1;
            return new Dictionary<string, object?>
            {
                ["ut"] = ut,
                ["ticks"] = _ticks,
            };
        }

        /// <summary>
        /// The tick's UT, or null when this Uplink cannot honestly say what it
        /// was.
        ///
        /// <para><see cref="KspSnapshot.Ut"/> is a plain <c>double</c>, and core
        /// fills it from <c>Planetarium.GetUniversalTime</c> through a try/catch
        /// that logs a warning and returns 0: that path is live before any save
        /// has loaded. So a NON-NULL snapshot can still carry a UT nobody read,
        /// and the substituted zero does not sit inert. Core's own sample cadence
        /// compares it against the last sampled UT, reads <c>0 &lt; last</c> as a
        /// BACKWARD jump, and forces the sample carrying it, so a fabricated
        /// timestamp perturbs the cadence rather than merely misreporting a
        /// clock. On a reveal-gated channel it is also older than every edge and
        /// walks straight past the signal delay.</para>
        ///
        /// <para>UT 0 is in principle the first instant of a brand-new save, so
        /// this declines one tick that might have been real. That is the cheaper
        /// of the two mistakes: nothing downstream can tell the two apart from
        /// the value alone, and the next tick publishes either way.</para>
        /// </summary>
        private static double? ReadableUt(KspSnapshot? snapshot)
        {
            if (snapshot == null)
            {
                return null;
            }
            var ut = snapshot.Ut;
            if (ut == 0.0 || double.IsNaN(ut) || double.IsInfinity(ut))
            {
                return null;
            }
            return ut;
        }
    }
}
