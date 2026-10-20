using System.Collections.Generic;
using Sitrep.Contract;

namespace Gonogo.KerbcastUplink
{
    /// <summary>
    /// Where Kerbcast's camera feeds listen: the address and port its video
    /// sidecar was launched with, and whether that address is this computer only.
    /// Shown on the Uplink's health report so an operator whose dashboard on
    /// another computer gets no feeds can see why. Used by
    /// <see cref="KerbcastHealth"/>.
    /// </summary>
    public sealed class KerbcastReach
    {
        /// <summary>What Kerbcast could not be asked: no fact is reported rather than a guess.</summary>
        public static readonly KerbcastReach Unknown = new KerbcastReach(null, 0, false);

        private readonly string? _address;
        private readonly int _port;
        private readonly bool _loopback;

        public KerbcastReach(string? address, int port, bool isLoopback)
        {
            _address = address;
            _port = port;
            _loopback = isLoopback;
        }

        /// <summary>The labelled health facts: who can reach the feeds, and for a loopback bind how to open them to other computers.</summary>
        public IReadOnlyList<UplinkHealthFact> Facts()
        {
            if (_address == null)
            {
                return new UplinkHealthFact[0];
            }

            if (!_loopback)
            {
                return new[] { new UplinkHealthFact("camera feeds reachable from", _address + ":" + _port) };
            }

            return new[]
            {
                new UplinkHealthFact("camera feeds reachable from", "this computer only"),
                new UplinkHealthFact(
                    "to allow other computers",
                    "set BindAddress in GameData/Kerbcast/PluginData/settings.cfg; it takes effect on the next KSP start"),
            };
        }
    }
}
