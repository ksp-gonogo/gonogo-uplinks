using System.Collections.Generic;
using System.Threading;
using Sitrep.Contract;

namespace Gonogo.ScansatUplink
{
    /// <summary>
    /// What the SCANsat Uplink remembers of what it has published: the once-per-body
    /// height/biome gate (main thread), and the change gates and the late-subscriber
    /// reseed cache (Courier thread). Free of KSP and SCANsat types so the whole
    /// lifecycle, a timeline reset included, runs in the headless test project.
    ///
    /// <para>A reset is requested from whichever thread the host calls it on and is
    /// applied lazily by each side, on its own thread, the next time that side
    /// touches its caches: the two sides never share a collection, so neither needs
    /// a lock.</para>
    /// </summary>
    internal sealed class ScanPublishState : IUplinkTimelineListener
    {
        public const double ReseedGraceSeconds = 5.0;

        private int _resetGeneration;
        private int _mainSeenGeneration;
        private int _courierSeenGeneration;

        // Main thread only.
        private readonly HashSet<string> _heightBiomeCapturedBodies = new HashSet<string>();

        // Courier thread only.
        private readonly Dictionary<string, byte[]> _lastPackedByBodyType = new Dictionary<string, byte[]>();
        private readonly Dictionary<string, ulong> _lastHashByBody = new Dictionary<string, ulong>();
        private readonly Dictionary<string, ScanPublication> _lastPublishedByTopic = new Dictionary<string, ScanPublication>();
        private readonly Dictionary<string, double> _lastReseedUtByTopic = new Dictionary<string, double>();

        // Both threads, under the gate: the Courier's last hash of each body's grid, and the reset it had applied when it took it.
        private readonly object _seenGate = new object();
        private readonly Dictionary<string, ulong> _seenHashByBody = new Dictionary<string, ulong>();
        private int _seenGeneration;

        /// <summary>Forget everything published so far. Safe from any thread.</summary>
        public void RequestReset() => Interlocked.Increment(ref _resetGeneration);

        public void OnTimelineReset(bool saveChanged) => RequestReset();

        /// <summary>MAIN THREAD: whether the body's height and biome grids still have to be built and captured.</summary>
        public bool NeedsHeightBiome(string bodyName)
        {
            ApplyResetOnMain();
            return !_heightBiomeCapturedBodies.Contains(bodyName);
        }

        /// <summary>MAIN THREAD: the body's height and biome grids were built and captured.</summary>
        public void MarkHeightBiomeCaptured(string bodyName)
        {
            ApplyResetOnMain();
            _heightBiomeCapturedBodies.Add(bodyName);
        }

        /// <summary>
        /// MAIN THREAD: whether a coverage grid of <paramref name="bodyName"/> that hashes
        /// to <paramref name="hash"/> is the grid <see cref="Compute"/> last saw for the
        /// body, so a capture of it would publish nothing and need not be taken. False
        /// after a reset until a capture has been through <see cref="Compute"/> again,
        /// which is what sends every layer again.
        /// </summary>
        public bool AlreadySeen(string bodyName, ulong hash)
        {
            lock (_seenGate)
            {
                return _seenGeneration == Volatile.Read(ref _resetGeneration)
                    && _seenHashByBody.TryGetValue(bodyName, out var seen)
                    && seen == hash;
            }
        }

        /// <summary>
        /// COURIER THREAD: the publications one capture yields, after the change gates,
        /// remembered for the late-subscriber reseed.
        /// </summary>
        public List<ScanPublication> Compute(ScanCapture capture)
        {
            ApplyResetOnCourier();
            var publications = ScanPublications.Compute(capture, _lastHashByBody, _lastPackedByBodyType);
            if (_lastHashByBody.TryGetValue(capture.BodyName, out var seen))
            {
                lock (_seenGate)
                {
                    _seenHashByBody[capture.BodyName] = seen;
                }
            }
            foreach (var publication in publications)
            {
                _lastPublishedByTopic[FullTopicFor(publication.Kind, publication.SubTopic)] = publication;
            }
            return publications;
        }

        /// <summary>
        /// COURIER THREAD: the cached publication to re-emit for a subscriber to
        /// <paramref name="fullTopic"/>, or false when nothing was published on it yet
        /// or a re-emit already happened within <see cref="ReseedGraceSeconds"/> of
        /// <paramref name="nowUt"/>.
        /// </summary>
        public bool TryTakeReseed(string fullTopic, double? nowUt, out ScanPublication publication, out double reseedUt)
        {
            ApplyResetOnCourier();
            reseedUt = 0;
            if (!_lastPublishedByTopic.TryGetValue(fullTopic, out publication))
            {
                return false;
            }
            reseedUt = nowUt ?? publication.Ut;
            if (_lastReseedUtByTopic.TryGetValue(fullTopic, out var last) && reseedUt - last < ReseedGraceSeconds)
            {
                return false;
            }
            _lastReseedUtByTopic[fullTopic] = reseedUt;
            return true;
        }

        public static string FullTopicFor(ScanChannelKind kind, string subTopic) => (kind switch
        {
            ScanChannelKind.Coverage => ScanChannels.CoveragePrefix,
            ScanChannelKind.Mask => ScanChannels.MaskPrefix,
            ScanChannelKind.Height => ScanChannels.HeightPrefix,
            ScanChannelKind.Biome => ScanChannels.BiomePrefix,
            ScanChannelKind.Anomalies => ScanChannels.AnomaliesPrefix,
            _ => "",
        }) + subTopic;

        private void ApplyResetOnMain()
        {
            var generation = Volatile.Read(ref _resetGeneration);
            if (generation == _mainSeenGeneration)
            {
                return;
            }
            _mainSeenGeneration = generation;
            _heightBiomeCapturedBodies.Clear();
        }

        private void ApplyResetOnCourier()
        {
            var generation = Volatile.Read(ref _resetGeneration);
            if (generation == _courierSeenGeneration)
            {
                return;
            }
            _courierSeenGeneration = generation;
            lock (_seenGate)
            {
                _seenHashByBody.Clear();
                _seenGeneration = generation;
            }
            _lastPackedByBodyType.Clear();
            _lastHashByBody.Clear();
            _lastPublishedByTopic.Clear();
            _lastReseedUtByTopic.Clear();
        }
    }
}
