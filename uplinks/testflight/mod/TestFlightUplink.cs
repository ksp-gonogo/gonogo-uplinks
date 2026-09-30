// The [SitrepUplink("testflight")] uplink: the testflight.available presence gate,
// TestFlight's engine reliability on testflight.reliability and
// testflight.reliabilityParts, and its own repair on testflight.repair, all read
// and driven by reflection (TestFlightReflection).
using System.Collections.Generic;
using Sitrep.Contract;

namespace GonogoTestFlightUplink
{
    [SitrepUplink("testflight")]
    public sealed class TestFlightUplink : ISitrepUplink
    {
        /// <summary>A bare boolean, the Domain presence gate a client's augment waits on.</summary>
        private const string AvailableTopic = "testflight.available";
        private const string ReliabilityTopic = "testflight.reliability";
        private const string ReliabilityPartsTopic = "testflight.reliabilityParts";

        /// <summary>
        /// Repair one engine through TestFlight's own ForceRepair. Delayed like any
        /// vessel actuation: it acts on the craft and rides the craft's signal delay.
        /// </summary>
        private const string RepairCommand = "testflight.repair";

        private readonly TestFlightReflection _tf = new();
        private IChannelPublisher? _reliability;
        private IChannelPublisher? _reliabilityParts;

        public UplinkManifest Manifest { get; }

        public TestFlightUplink()
        {
            Manifest = new UplinkManifest
            {
                Id = "testflight",
                Version = "1.0.0",
                Channels = new List<ChannelDeclaration>
                {
                    new()
                    {
                        Topic = AvailableTopic,
                        Delivery = Delivery.LossyLatest,
                        Emission = new EmissionPolicy(keyframeIntervalUt: 30, quantum: EmissionQuantum.Absolute(0)),
                        Delay = DelayRole.TrueNow,
                    },
                    Delayed(ReliabilityTopic),
                    Delayed(ReliabilityPartsTopic),
                },
                // Presence-gated at the manifest: on an install without TestFlight
                // the command is not merely unhandled, it does not exist.
                Commands = _tf.IsAvailable
                    ? new List<CommandDeclaration>
                    {
                        new() { Command = RepairCommand, Subject = ReliabilityPartsTopic },
                    }
                    : new List<CommandDeclaration>(),
                ErrorCodes = ErrorCodeCatalog.Of(typeof(TestFlightErrorCodes)),
            };
        }

        private static ChannelDeclaration Delayed(string topic) => new()
        {
            Topic = topic,
            Delivery = Delivery.LossyLatest,
            Emission = new EmissionPolicy(keyframeIntervalUt: 30, quantum: EmissionQuantum.Absolute(0)),
            Delay = DelayRole.Delayed,
        };

        /// <summary>
        /// The capture runs on the main thread, where TestFlight's part modules can
        /// be read, and only while a client watches either topic. It returns
        /// nothing when TestFlight is absent, so the topics stay silent rather than
        /// publishing an empty craft.
        /// </summary>
        public void Register(IUplinkHost host)
        {
            // A ground-side fact, answered whether or not TestFlight is there.
            host.AddChannelSource(AvailableTopic, _ => _tf.IsAvailable);
            if (!_tf.IsAvailable) return;

            var reliability = new TestFlightReliabilityBackend(_tf, host.Kernel);
            _reliability = host.Publisher(ReliabilityTopic);
            _reliabilityParts = host.Publisher(ReliabilityPartsTopic);
            host.AddSampledSource(
                snapshot => snapshot == null || reliability.Capture() is not { } capture
                    ? null
                    : new ReliabilitySample(snapshot.Ut, capture),
                HandleOnCourier,
                ReliabilityTopic,
                ReliabilityPartsTopic);
            host.AddCommandHandler<TestFlightRepairPartArgs, CommandResult<TestFlightRepairOutcome>>(
                RepairCommand,
                args => reliability.Repair(args?.PartId ?? ""));
        }

        /// <summary>COURIER-THREAD handle: publish both payloads at the capture's UT. No KSP access.</summary>
        private void HandleOnCourier(object? captured)
        {
            if (captured is not ReliabilitySample sample) return;
            _reliability?.Publish(sample.Capture.Summary, sample.Ut);
            _reliabilityParts?.Publish(sample.Capture.Parts, sample.Ut);
        }

        public UplinkHealth Health()
        {
            if (!_tf.IsAvailable)
            {
                return new UplinkHealth(UplinkHealthState.Unavailable, "TestFlight assembly not loaded");
            }
            return UplinkHealth.Healthy;
        }

        private sealed class ReliabilitySample
        {
            public readonly double Ut;
            public readonly TestFlightReliabilityCapture Capture;

            public ReliabilitySample(double ut, TestFlightReliabilityCapture capture)
            {
                Ut = ut;
                Capture = capture;
            }
        }
    }
}
