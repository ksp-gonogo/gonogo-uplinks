// The [SitrepUplink("testflight")] uplink: reports whether TestFlight is loaded
// through system.uplinks health. It declares no channels and no commands yet;
// TestFlightReliabilityBackend reads TestFlight's engines and drives its repair,
// and is not wired to any Topic or command.
using System.Collections.Generic;
using Sitrep.Contract;

namespace GonogoTestFlightUplink
{
    [SitrepUplink("testflight")]
    public sealed class TestFlightUplink : ISitrepUplink
    {
        private readonly TestFlightReflection _tf = new();

        public UplinkManifest Manifest { get; } = new UplinkManifest
        {
            Id = "testflight",
            Version = "1.0.0",
            Channels = new List<ChannelDeclaration>(),
        };

        public void Register(IUplinkHost host)
        {
        }

        public UplinkHealth Health()
        {
            if (!_tf.IsAvailable)
            {
                return new UplinkHealth(UplinkHealthState.Unavailable, "TestFlight assembly not loaded");
            }
            return UplinkHealth.Healthy;
        }
    }
}
