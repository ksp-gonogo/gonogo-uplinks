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
        public void PublishesNothingForASnapshotCarryingAUtNobodyRead()
        {
            // Core's NowUt() catches a Planetarium throw, logs a warning and
            // returns 0, which is the live path before any save has loaded. So
            // the snapshot arrives NON-NULL with a UT that was never read, and
            // the zero is not inert: core's sample cadence reads
            // 0 < lastSampledUt as a backward jump and forces the sample
            // carrying it, so the fabricated timestamp perturbs the cadence.
            Assert.Null(new ExampleUplink().Sample(new KspSnapshot { Ut = 0.0 }));
        }

        [Fact]
        public void PublishesNothingForANonFiniteUt()
        {
            Assert.Null(new ExampleUplink().Sample(new KspSnapshot { Ut = double.NaN }));
            Assert.Null(new ExampleUplink().Sample(
                new KspSnapshot { Ut = double.PositiveInfinity }));
        }

        [Fact]
        public void ADeclinedTickDoesNotAdvanceTheCount()
        {
            // A `ticks` that counted declined ticks would be a second invented
            // reading beside the UT: a heartbeat claiming more beats than it
            // ever published.
            var uplink = new ExampleUplink();

            Assert.Null(uplink.Sample(new KspSnapshot { Ut = 0.0 }));
            var first = Assert.IsType<Dictionary<string, object?>>(
                uplink.Sample(new KspSnapshot { Ut = 1234.5 }));
            Assert.Equal(1.0, first["ticks"]);
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
