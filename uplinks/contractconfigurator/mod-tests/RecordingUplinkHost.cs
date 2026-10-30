using System;
using System.Collections.Generic;
using Sitrep.Contract;

namespace Gonogo.ContractConfiguratorUplink.Tests
{
    /// <summary>
    /// A host this Uplink can be registered into and ticked, with a real kernel
    /// that declares the objective delay capability the way core does and offers
    /// a recording line as its vanilla. Everything else the host can do throws,
    /// so the recording is the whole of what the Uplink asks for.
    /// </summary>
    internal sealed class RecordingUplinkHost : IUplinkHost
    {
        public RecordingUplinkHost(RecordingObjectiveLine? line)
        {
            Kernel = new Kernel();
            if (line != null)
            {
                Kernel.RegisterCapability(new CapabilityDescriptor
                {
                    Id = ObjectiveDelayCapability.CapabilityId,
                    Exclusive = true,
                    SpineCritical = false,
                    Vanilla = ctx => line,
                });
            }
        }

        public Kernel Kernel { get; }

        public Availability? Availability { get; private set; }

        public List<ISnapshotSampler> Samplers { get; } = new List<ISnapshotSampler>();

        public void Resolve() => Kernel.Resolve(new ResolveOptions { KernelVersion = "1.0.0" });

        public void Tick()
        {
            var snapshot = new KspSnapshot();
            foreach (var sampler in Samplers)
            {
                sampler.Sample(snapshot);
            }
        }

        public void Log(UplinkLogLevel level, string tag, string message)
        {
        }

        public void AddSampler(ISnapshotSampler sampler) => Samplers.Add(sampler);

        public void SetAvailability(Availability availability) => Availability = availability;

        /// <summary>
        /// Everything below throws rather than answering.
        ///
        /// <para>A host that quietly accepted every call would pass its callers'
        /// assertions while the Uplink did something else entirely on the way past.
        /// Throwing means the recorded set is the whole set: this uplink declares no
        /// channels, no commands and no delay of its own, and if that stops being
        /// true the tests fail and say which seam it started using.</para>
        /// </summary>
        private static NotSupportedException NotExpected(string what) =>
            new NotSupportedException(
                "ContractConfiguratorUplink.Register is not expected to call " + what
                + "; if that changed, the recording above no longer describes what it does");

        public double NowUt() => throw NotExpected("NowUt");

        public void AddSampledSource(Func<KspSnapshot?, object?> captureOnMainThread, Action<object?> handleOffMainThread) =>
            throw NotExpected("AddSampledSource");

        public void AddSampledSource(
            Func<KspSnapshot?, object?> captureOnMainThread,
            Action<object?> handleOffMainThread,
            params string[] subscriptionTopicPrefixes) =>
            throw NotExpected("AddSampledSource");

        public bool IsAnyTopicSubscribed(string topicPrefix) => throw NotExpected("IsAnyTopicSubscribed");

        public void AddCommandHandler<TArgs, TResult>(string command, Func<TArgs, TResult> handler) =>
            throw NotExpected("AddCommandHandler");

        public void AddVantageCommandHandler<TArgs, TResult>(
            string command, Func<TArgs, string, TResult> handler) =>
            throw NotExpected("AddVantageCommandHandler");

        public IChannelPublisher Publisher(string topic) => throw NotExpected("Publisher");

        public void AddChannelSource(string topic, Func<KspSnapshot?, object?> map) =>
            throw NotExpected("AddChannelSource");

        public IDynamicChannelSource RegisterDynamicNamespace(
            string prefix, ChannelDeclaration template) =>
            throw NotExpected("RegisterDynamicNamespace");

        public void AddGateEvaluator(ICommandGateEvaluator evaluator) =>
            throw NotExpected("AddGateEvaluator");

        public void AddCommandRequirement(string command, CommandRequirement requirement) =>
            throw NotExpected("AddCommandRequirement");

        public void SetSignalDelaySource(Func<KspSnapshot?, CommsDelay?> computeOnMainThread) =>
            throw NotExpected("SetSignalDelaySource");

        public void SetVesselDelay(string vesselId, double oneWaySeconds) =>
            throw NotExpected("SetVesselDelay");

        public void SetCentreDelay(string fromCentreId, string toCentreId, double oneWaySeconds) =>
            throw NotExpected("SetCentreDelay");

        public void SetHomeCommandDelays(IReadOnlyDictionary<string, double> oneWaySecondsByCentre) =>
            throw NotExpected("SetHomeCommandDelays");

        public void SetActiveVesselDelays(IReadOnlyDictionary<string, double> oneWaySecondsByCentre) =>
            throw NotExpected("SetActiveVesselDelays");

        public void SetVesselConnectivity(string vesselId, bool connected) =>
            throw NotExpected("SetVesselConnectivity");

        public void SetConnectivitySource(Func<KspSnapshot?, bool?> computeOnMainThread) =>
            throw NotExpected("SetConnectivitySource");

        public void SetPathBreakSource(Func<KspSnapshot?, double, IReadOnlyList<PathBreak>?> computeOnMainThread) =>
            throw NotExpected("SetPathBreakSource");

        public IDisposable RegisterDelayModifier(double factor, string reason) =>
            throw NotExpected("RegisterDelayModifier");

        public void ForceKeyframe(string topic) => throw NotExpected("ForceKeyframe");

        public void ResetChannelBirth(IEnumerable<string> topics) =>
            throw NotExpected("ResetChannelBirth");
    }
}
