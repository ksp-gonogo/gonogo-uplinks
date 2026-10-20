using System;
using System.Collections.Generic;
using GonogoKerbalismUplink;
using Sitrep.Contract;

namespace Gonogo.KerbalismUplink
{
    /// <summary>
    /// Registers Kerbalism's "science" and "isru" providers so they are present
    /// whether or not Kerbalism has loaded yet.
    ///
    /// <para>The host elects providers once, before it starts, and Kerbalism can
    /// load after that (a bootstrap-loaded build hands over its real assembly
    /// seconds later). A provider registered only when Kerbalism was already
    /// found would therefore be missing for the whole session. Each provider
    /// registered here is elected unconditionally and answers per call: Kerbalism's
    /// reads once <paramref name="available"/> is true, the stock backend until
    /// then, so a vanilla install keeps its stock science and ISRU.</para>
    /// </summary>
    internal static class KerbalismProviders
    {
        internal static void RegisterScience(Kernel kernel, Func<bool> available, IScienceBackend kerbalism)
        {
            kernel.RegisterProvider(new ProviderRegistration
            {
                Capability = "science",
                Id = KerbalismScienceMap.ProviderId,
                // Above the stock vanilla backend: on a Kerbalism install the
                // stock walk finds nothing (results live on Kerbalism's drives,
                // not in ModuleScienceExperiment), so losing this election would
                // mean an empty science dashboard, not a degraded one.
                Priority = 1.0,
                Factory = ctx => new AvailabilityScienceBackend(
                    available, kerbalism, ctx.Vanilla<IScienceBackend>("science")),
            });
        }

        internal static void RegisterIsru(Kernel kernel, Func<bool> available, IIsruBackend kerbalism)
        {
            kernel.RegisterProvider(new ProviderRegistration
            {
                Capability = "isru",
                Id = KerbalismIsruMap.ProviderId,
                // Above the stock vanilla backend: Kerbalism's patches delete the
                // stock harvester and converter modules, so losing this election
                // would mean an empty ISRU dashboard, not a degraded one.
                Priority = 1.0,
                Factory = ctx => new AvailabilityIsruBackend(
                    available, kerbalism, ctx.Vanilla<IIsruBackend>("isru")),
            });
        }
    }

    /// <summary>
    /// The elected science backend: Kerbalism's once Kerbalism is found, the
    /// stock backend before that. Asked per call, so the answer changes the
    /// moment Kerbalism appears.
    /// </summary>
    internal sealed class AvailabilityScienceBackend : IScienceBackend, IScienceRunBackend
    {
        private readonly Func<bool> _available;
        private readonly IScienceBackend _kerbalism;
        private readonly IScienceBackend _stock;

        internal AvailabilityScienceBackend(Func<bool> available, IScienceBackend kerbalism, IScienceBackend stock)
        {
            _available = available;
            _kerbalism = kerbalism;
            _stock = stock;
        }

        private IScienceBackend Active => _available() ? _kerbalism : _stock;

        private IScienceRunBackend? ActiveRun => Active as IScienceRunBackend;

        public string ProviderId => Active.ProviderId;

        public IReadOnlyList<ExperimentEntry>? Experiments(KspSnapshot? snapshot) => Active.Experiments(snapshot);

        public IReadOnlyList<InstrumentEntry>? Instruments(KspSnapshot? snapshot) => Active.Instruments(snapshot);

        public IReadOnlyList<SensorEntry>? Sensors(KspSnapshot? snapshot) => Active.Sensors(snapshot);

        public IReadOnlyList<LabEntry>? Lab(KspSnapshot? snapshot) => Active.Lab(snapshot);

        public IReadOnlyList<ExperimentBreakdownEntry>? ExperimentBreakdown(KspSnapshot? snapshot) =>
            Active.ExperimentBreakdown(snapshot);

        public CommandResult DeployExperiment(ExperimentActionArgs args) => Active.DeployExperiment(args);

        public CommandResult TransmitExperiment(ExperimentActionArgs args) => Active.TransmitExperiment(args);

        public CommandResult StartExperiment(ExperimentActionArgs args) =>
            ActiveRun?.StartExperiment(args) ?? CommandResult.Fail(KerbalismErrorCodes.ScienceNotModelled);

        public CommandResult StopExperiment(ExperimentActionArgs args) =>
            ActiveRun?.StopExperiment(args) ?? CommandResult.Fail(KerbalismErrorCodes.ScienceNotModelled);

        public CommandResult StartLab(ExperimentActionArgs args) =>
            ActiveRun?.StartLab(args) ?? CommandResult.Fail(KerbalismErrorCodes.ScienceNotModelled);

        public CommandResult StopLab(ExperimentActionArgs args) =>
            ActiveRun?.StopLab(args) ?? CommandResult.Fail(KerbalismErrorCodes.ScienceNotModelled);
    }

    /// <summary>
    /// The elected ISRU backend: Kerbalism's once Kerbalism is found, the stock
    /// backend before that.
    /// </summary>
    internal sealed class AvailabilityIsruBackend : IIsruBackend
    {
        private readonly Func<bool> _available;
        private readonly IIsruBackend _kerbalism;
        private readonly IIsruBackend _stock;

        internal AvailabilityIsruBackend(Func<bool> available, IIsruBackend kerbalism, IIsruBackend stock)
        {
            _available = available;
            _kerbalism = kerbalism;
            _stock = stock;
        }

        private IIsruBackend Active => _available() ? _kerbalism : _stock;

        public string ProviderId => Active.ProviderId;

        public IReadOnlyList<IsruDrillEntry> Drills() => Active.Drills();

        public IReadOnlyList<IsruConverterEntry> Converters() => Active.Converters();
    }
}
