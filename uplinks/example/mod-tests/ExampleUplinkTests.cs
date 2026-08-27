using System.Collections.Generic;
using GonogoExampleUplink;
using Sitrep.Contract;
using Xunit;

namespace GonogoExampleUplink.Tests
{
    /// <summary>
    /// What an Uplink's own tests can prove without a running game, which is more
    /// than it first looks: the manifest it declares, the channels it registers,
    /// and what its sampler returns for a given snapshot.
    /// </summary>
    public class ExampleUplinkTests
    {
        [Fact]
        public void DeclaresOneTrueNowChannel()
        {
            var manifest = new ExampleUplink().Manifest;

            Assert.Equal("example", manifest.Id);
            var channel = Assert.Single(manifest.Channels);
            Assert.Equal(ExampleUplink.HeartbeatTopic, channel.Topic);
            // TrueNow rather than Delayed, because a heartbeat describes the
            // connection and not a vessel. Getting this wrong on a vessel fact
            // leaks information past the reveal-gate, which is why it is asserted
            // rather than assumed.
            Assert.Equal(DelayRole.TrueNow, channel.Delay);
        }

        [Fact]
        public void PublishesNothingWithoutASnapshot()
        {
            // Null, not a zero-filled payload. A substituted zero is
            // indistinguishable from a real reading once it is on the wire.
            Assert.Null(new ExampleUplink().Sample(null));
        }

        [Fact]
        public void CarriesTheSnapshotUtAndACountThatAdvances()
        {
            var uplink = new ExampleUplink();

            var first = Assert.IsType<Dictionary<string, object?>>(
                uplink.Sample(new KspSnapshot { Ut = 1234.5 }));
            Assert.Equal(1234.5, first["ut"]);
            Assert.Equal(1.0, first["ticks"]);

            var second = Assert.IsType<Dictionary<string, object?>>(
                uplink.Sample(new KspSnapshot { Ut = 1235.5 }));
            Assert.Equal(2.0, second["ticks"]);
        }
    }
}
