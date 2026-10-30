using System;
using Sitrep.Contract;
using Xunit;

namespace Gonogo.ContractConfiguratorUplink.Tests
{
    public class ContractConfiguratorUplinkTests
    {
        private static ContractConfiguratorUplink Uplink(
            bool loaded,
            Func<ObjectiveLineAccess, string?>? install = null,
            Func<ObjectiveChange, Action?>? restore = null) =>
            new ContractConfiguratorUplink(loaded ? () => true : () => false, install ?? (_ => null), restore ?? (_ => null));

        [Fact]
        public void Goes_inert_and_unavailable_when_contract_configurator_is_not_loaded()
        {
            var installed = false;
            var host = new RecordingUplinkHost(new RecordingObjectiveLine());
            var uplink = Uplink(false, _ =>
            {
                installed = true;
                return null;
            });

            uplink.Register(host);

            Assert.False(installed);
            Assert.Empty(host.Samplers);
            Assert.False(host.Availability!.Value.IsAvailable);
            Assert.Equal(UplinkHealthState.Unavailable, uplink.Health().State);
        }

        [Fact]
        public void Installs_its_hooks_and_binds_as_the_contract_configurator_owner_once_the_line_resolves()
        {
            var line = new RecordingObjectiveLine();
            var host = new RecordingUplinkHost(line);
            Func<ObjectiveChange, Action?> restore = _ => () => { };
            var installed = false;
            var uplink = Uplink(true, _ =>
            {
                installed = true;
                return null;
            }, restore);

            uplink.Register(host);
            host.Tick();
            Assert.Empty(line.Rebound);

            host.Resolve();
            host.Tick();
            host.Tick();

            Assert.True(installed);
            Assert.Equal(new[] { ObjectiveDelayCapability.ContractConfiguratorOwner }, line.Rebound);
            Assert.Same(restore, line.Resolver);
            Assert.Equal(UplinkHealthState.Healthy, uplink.Health().State);
        }

        [Fact]
        public void Reports_degraded_when_the_engine_has_ticked_and_there_is_still_no_line()
        {
            var host = new RecordingUplinkHost(null);
            var uplink = Uplink(true);

            uplink.Register(host);
            Assert.Equal(UplinkHealthState.Healthy, uplink.Health().State);

            host.Resolve();
            host.Tick();

            Assert.Equal(UplinkHealthState.Degraded, uplink.Health().State);
        }

        [Fact]
        public void Reports_degraded_with_the_reason_when_the_hooks_could_not_be_installed()
        {
            var host = new RecordingUplinkHost(new RecordingObjectiveLine());
            var uplink = Uplink(true, _ => "the method moved");

            uplink.Register(host);

            var health = uplink.Health();
            Assert.Equal(UplinkHealthState.Degraded, health.State);
            Assert.Contains("the method moved", health.Detail);
        }

        [Fact]
        public void Declares_the_uplink_id_the_discovery_scan_reads()
        {
            var attribute = (SitrepUplinkAttribute)Attribute.GetCustomAttribute(typeof(ContractConfiguratorUplink), typeof(SitrepUplinkAttribute))!;
            Assert.Equal("contractConfigurator", attribute.Id);
            Assert.Equal("contractConfigurator", Uplink(true).Manifest.Id);
        }
    }
}
