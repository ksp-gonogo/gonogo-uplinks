using System.Collections.Generic;

namespace Gonogo.RealAntennasUplink
{
    /// <summary>
    /// Builds the <c>"realantennas"</c> namespace of a <c>CommsHop</c>'s provider
    /// extension bag from the live RACommLink, via <see cref="RaReflection"/>. The
    /// provider-extension pattern (see a sibling Uplink's reliability map): a plain
    /// value tree with camelCase keys matching the generated <c>RealAntennasHopExt</c>
    /// interface field for field, which the wire writer walks like any other
    /// producer-flattened payload. Core never learns this shape.
    ///
    /// <para>Main-thread only (live antenna reads), called from
    /// <see cref="RaCommsBackend.Path"/> inside the capture-on-main sampler. Every
    /// field is a fail-soft <see cref="RaReflection"/> read, so a moved RA surface
    /// drops individual fields to null rather than throwing; when nothing at all
    /// reads (bare CommNet, or a wholly unfamiliar RA), the bag is null and the wire
    /// omits it, so the hop is byte-for-byte the shared shape.</para>
    /// </summary>
    public static class RaHopExtensions
    {
        /// <summary>
        /// The provider id keying the namespace: the same string
        /// <see cref="RaCommsBackend.Id"/> registers with the Kernel, and what the
        /// client's <c>registerProviderExtensionShape</c> names.
        /// </summary>
        public const string ProviderId = RaCommsBackend.Id;

        /// <summary>
        /// The full extension bag for one hop (<c>{ "realantennas": { ... } }</c>),
        /// or null when no RA fact reads. Band/tech-level/modulation/encoder/coding
        /// rate/beamwidth/EC draw come off the hop's transmit antenna; required
        /// Eb/N0 off the receive antenna (its encoder sets the requirement); the
        /// rate the other way off the link. "Forward" means along the hop, from its
        /// near end to its far end: RealAntennas stores a link a to b by node index,
        /// so <paramref name="fromIsForwardEnd"/> says whether the hop's near end is
        /// the link's a node. <paramref name="link"/> is the live RACommLink.
        /// </summary>
        public static Dictionary<string, object?>? ForHop(RaReflection ra, object? link, bool fromIsForwardEnd)
        {
            if (link == null)
            {
                return null;
            }

            var (tx, rx, reverseBitsPerSec) = RaLinkDirection.ForHop(
                fromIsForwardEnd,
                ra.ForwardTxAntenna(link),
                ra.ForwardRxAntenna(link),
                ra.ReverseTxAntenna(link),
                ra.ReverseRxAntenna(link),
                ra.ForwardDataRate(link),
                ra.ReverseDataRate(link));

            var band = tx != null ? ra.BandName(tx) : null;
            var techLevel = tx != null ? ra.TechLevel(tx) : null;
            var modulationBits = tx != null ? ra.ModulationBits(tx) : null;
            var encoder = tx != null ? ra.EncoderName(tx) : null;
            var codingRate = tx != null ? ra.CodingRate(tx) : null;
            var beamwidth = tx != null ? ra.Beamwidth(tx) : null;
            var powerDrawEc = tx != null ? ra.PowerDrawLinear(tx) : null;
            var requiredEbN0 = rx != null ? ra.RequiredEbN0Db(rx) : null;

            // Nothing read at all: leave the bag off so the hop is the bare shared
            // shape (the vanilla CommNet posture), rather than an empty namespace a
            // widget would read as "RA present but silent".
            if (band == null && techLevel == null && modulationBits == null && encoder == null &&
                codingRate == null && beamwidth == null && powerDrawEc == null &&
                requiredEbN0 == null && reverseBitsPerSec == null)
            {
                return null;
            }

            return new Dictionary<string, object?>
            {
                [ProviderId] = new Dictionary<string, object?>
                {
                    ["band"] = band,
                    ["techLevel"] = techLevel,
                    ["modulationBits"] = modulationBits,
                    ["encoder"] = encoder,
                    ["codingRate"] = codingRate,
                    ["requiredEbN0"] = requiredEbN0,
                    ["beamwidth"] = beamwidth,
                    ["powerDrawEc"] = powerDrawEc,
                    ["reverseBitsPerSec"] = reverseBitsPerSec,
                },
            };
        }
    }
}
