using System;
using System.Collections.Generic;
using System.Linq;
using Gonogo.KerbalismUplink;
using GonogoKerbalismUplink;
using Sitrep.Contract;
using Xunit;

namespace GonogoKerbalismUplink.Tests
{
    /// <summary>
    /// A Kerbalism that loads after the Uplink registers must still end with its
    /// commands declared and its providers answering: the host takes both once,
    /// before it starts, so neither can wait for Kerbalism to be found.
    /// </summary>
    public class KerbalismLateLoadTests
    {
        private sealed class FakeScience : IScienceBackend, IScienceRunBackend
        {
            private readonly string _id;
            public FakeScience(string id) => _id = id;
            public string ProviderId => _id;
            public IReadOnlyList<ExperimentEntry>? Experiments(KspSnapshot? s) => new List<ExperimentEntry> { new() { PartName = _id } };
            public IReadOnlyList<InstrumentEntry>? Instruments(KspSnapshot? s) => null;
            public IReadOnlyList<SensorEntry>? Sensors(KspSnapshot? s) => null;
            public IReadOnlyList<LabEntry>? Lab(KspSnapshot? s) => null;
            public IReadOnlyList<ExperimentBreakdownEntry>? ExperimentBreakdown(KspSnapshot? s) => null;
            public CommandResult DeployExperiment(ExperimentActionArgs a) => CommandResult.Ok();
            public CommandResult TransmitExperiment(ExperimentActionArgs a) => CommandResult.Ok();
            public CommandResult StartExperiment(ExperimentActionArgs a) => CommandResult.Ok();
            public CommandResult StopExperiment(ExperimentActionArgs a) => CommandResult.Ok();
            public CommandResult StartLab(ExperimentActionArgs a) =>
                _id == "kerbalism" ? CommandResult.Ok() : CommandResult.Fail(CommandErrorCode.ModeUnavailable);
            public CommandResult StopLab(ExperimentActionArgs a) => CommandResult.Ok();
        }

        private sealed class FakeIsru : IIsruBackend
        {
            private readonly string _id;
            public FakeIsru(string id) => _id = id;
            public string ProviderId => _id;
            public IReadOnlyList<IsruDrillEntry> Drills() => new List<IsruDrillEntry> { new() { PartId = _id } };
            public IReadOnlyList<IsruConverterEntry> Converters() => new List<IsruConverterEntry>();
        }

        private static Kernel KernelWith(string capability, Func<ProviderContext, object?> vanilla)
        {
            var kernel = new Kernel();
            kernel.RegisterCapability(new CapabilityDescriptor
            {
                Id = capability,
                Exclusive = true,
                Vanilla = vanilla,
            });
            return kernel;
        }

        private static void Resolve(Kernel kernel) =>
            kernel.Resolve(new ResolveOptions { KernelVersion = "1.0.0" });

        [Fact]
        public void ScienceProviderStartedBeforeKerbalismAnswersFromItOnceItAppears()
        {
            var kernel = KernelWith("science", _ => new FakeScience("stock"));
            var present = false;
            KerbalismProviders.RegisterScience(kernel, () => present, new FakeScience("kerbalism"));
            Resolve(kernel);

            var elected = kernel.Query<IScienceBackend>("science");
            Assert.Equal("stock", elected.Experiments(null)!.Single().PartName);

            present = true;

            Assert.Equal("kerbalism", elected.Experiments(null)!.Single().PartName);
            Assert.Equal("kerbalism", elected.ProviderId);
        }

        [Fact]
        public void ScienceRunCommandsFollowTheSameSwitch()
        {
            var kernel = KernelWith("science", _ => new FakeScience("stock"));
            var present = false;
            var kerbalism = new FakeScience("kerbalism");
            KerbalismProviders.RegisterScience(kernel, () => present, kerbalism);
            Resolve(kernel);

            var run = Assert.IsAssignableFrom<IScienceRunBackend>(kernel.Query<IScienceBackend>("science"));
            Assert.False(run.StartLab(new ExperimentActionArgs()).Success);

            present = true;

            Assert.True(run.StartLab(new ExperimentActionArgs()).Success);
        }

        [Fact]
        public void IsruProviderStartedBeforeKerbalismAnswersFromItOnceItAppears()
        {
            var kernel = KernelWith("isru", _ => new FakeIsru("stock"));
            var present = false;
            KerbalismProviders.RegisterIsru(kernel, () => present, new FakeIsru("kerbalism"));
            Resolve(kernel);

            var elected = kernel.Query<IIsruBackend>("isru");
            Assert.Equal("stock", elected.Drills().Single().PartId);

            present = true;

            Assert.Equal("kerbalism", elected.Drills().Single().PartId);
        }

        [Fact]
        public void TheManifestDeclaresEveryCommandWithNoKerbalismAnywhere()
        {
            var declared = KerbalismCommandCatalog.All().Select(c => c.Command).ToList();

            Assert.Equal(8, declared.Count);
            Assert.Contains(KerbalismCommandCatalog.RepairCommand, declared);
            Assert.Contains(KerbalismDeviceCommandProvider.DeviceSetCommand, declared);
            Assert.Contains(KerbalismDeviceCommandProvider.ScriptSetCommand, declared);
            Assert.Contains(KerbalismFileCommandProvider.MoveToLabCommand, declared);
        }

        [Fact]
        public void TheUplinkDoesNotGateItsRegistrationsOnKerbalismBeingFound()
        {
            var source = UplinkSource.Read("KerbalismUplink.cs");

            Assert.DoesNotContain("Commands = _k.IsAvailable", source);
            Assert.DoesNotContain("if (_k.IsAvailable)\n            {\n                RegisterScience", source.Replace("\r\n", "\n"));
        }
    }
}
