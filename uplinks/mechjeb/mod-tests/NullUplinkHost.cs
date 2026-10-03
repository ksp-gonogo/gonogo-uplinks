using System;
using System.Collections.Generic;
using Sitrep.Contract;

namespace GonogoMechJebUplink.Tests
{
    /// <summary>
    /// A minimal <see cref="IUplinkHost"/> that throws on every real call but
    /// one: used to prove <see cref="MechJebUplink.Register"/> is safe in the
    /// headless test build (the MechJeb2-touching half that would actually
    /// call these is excluded, see
    /// <see cref="MechJebUplinkTests.Register_WithNoKspHalfCompiled_IsASafeNoOp"/>).
    /// If any of these throw, the test would fail loudly rather than
    /// silently passing for the wrong reason.
    ///
    /// <para>The exception is <see cref="AddGateEvaluator"/>, which records:
    /// Register adds the unlock gate before anything MechJeb-specific, so a
    /// test can see it is there whatever MechJeb's state.</para>
    /// </summary>
    internal sealed class NullUplinkHost : IUplinkHost
    {

        public void SetPathBreakSource(Func<KspSnapshot?, double, IReadOnlyList<PathBreak>?> computeOnMainThread) { }
        public IDisposable RegisterDelayModifier(double factor, string reason) => throw NotExpected();
        private static NotSupportedException NotExpected() =>
            new NotSupportedException("MechJebUplink.Register should not call the host in a headless test build");

        public double NowUt() => throw NotExpected();
        public void AddSampler(ISnapshotSampler sampler) => throw NotExpected();
        public void AddChannelSource(string topic, Func<KspSnapshot?, object?> map) => throw NotExpected();
        public IChannelPublisher Publisher(string topic) => throw NotExpected();
        public void AddSampledSource(Func<KspSnapshot?, object?> captureOnMainThread, Action<object?> handleOnCourier) => throw NotExpected();
        public void AddSampledSource(Func<KspSnapshot?, object?> captureOnMainThread, Action<object?> handleOnCourier, params string[] subscriptionTopicPrefixes) => throw NotExpected();
        public bool IsAnyTopicSubscribed(string topicPrefix) => throw NotExpected();
        public IDynamicChannelSource RegisterDynamicNamespace(string prefix, ChannelDeclaration template) => throw NotExpected();
        public void AddCommandHandler<TArgs, TResult>(string command, Func<TArgs, TResult> handler) => throw NotExpected();
        public void AddVantageCommandHandler<TArgs, TResult>(string command, Func<TArgs, string, TResult> handler) => throw NotExpected();
        public List<ICommandGateEvaluator> GateEvaluators { get; } = new List<ICommandGateEvaluator>();
        public void AddGateEvaluator(ICommandGateEvaluator evaluator) => GateEvaluators.Add(evaluator);
        public void AddCommandRequirement(string command, CommandRequirement requirement) => throw NotExpected();
        public void SetSignalDelaySource(Func<KspSnapshot?, CommsDelay?> computeOnMainThread) => throw NotExpected();
        public void SetVesselDelay(string vesselId, double oneWaySeconds) => throw NotExpected();
        public void SetCentreDelay(string fromCentreId, string toCentreId, double oneWaySeconds) => throw NotExpected();
        public void SetHomeCommandDelay(string centreId, double oneWaySeconds) => throw NotExpected();
        public void SetActiveVesselDelays(IReadOnlyDictionary<string, double> oneWaySecondsByCentre) => throw NotExpected();
        public void SetVesselConnectivity(string vesselId, bool connected) => throw NotExpected();
        public void SetConnectivitySource(Func<KspSnapshot?, bool?> computeOnMainThread) => throw NotExpected();
        public Kernel Kernel => throw NotExpected();
        public void SetAvailability(Availability availability) => throw NotExpected();
        public void ForceKeyframe(string topic) => throw NotExpected();
        public void ResetChannelBirth(IEnumerable<string> topics) => throw NotExpected();
    }
}
