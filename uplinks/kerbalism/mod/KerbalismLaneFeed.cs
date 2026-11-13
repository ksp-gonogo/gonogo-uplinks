using System;
using System.Collections.Generic;
using System.Linq;
using Sitrep.Contract;

namespace Gonogo.KerbalismUplink
{
    /// <summary>
    /// Keeps every craft Kerbalism simulates, other than the active one, reporting
    /// its life support, crew and transmission into its own record, so a switch to
    /// it shows what it last sent instead of nothing. One craft per sample, each at
    /// most every <see cref="KerbalismLaneScope.IntervalUt"/>, through the same
    /// read as the active craft. Each reading carries when Kerbalism last
    /// simulated that craft, so its age stays visible.
    ///
    /// <para>Needs a host that keeps a record per craft (one whose publishers are
    /// <see cref="ICraftReadingPublisher"/>); with any other host it registers
    /// nothing.</para>
    /// </summary>
    internal sealed class KerbalismLaneFeed
    {
        private static readonly PerfBudget ReadBudget = new PerfBudget(
            "KerbalismLaneFeed craft read", threshold: 5, windowSec: 1.0, unit: "craft");

        private readonly KerbalismReflection _k;
        private readonly Func<Vessel, double, KerbalismUplink.KerbalismCaptured?> _capture;

        private ICraftReadingPublisher? _lifeSupport;
        private ICraftReadingPublisher? _crew;
        private ICraftReadingPublisher? _transmission;

        // Main-thread-only.
        private readonly Dictionary<string, double> _lastReadUt = new Dictionary<string, double>(StringComparer.Ordinal);
        private int _cursor = -1;

        internal KerbalismLaneFeed(KerbalismReflection k, Func<Vessel, double, KerbalismUplink.KerbalismCaptured?> capture)
        {
            _k = k;
            _capture = capture;
        }

        public void RegisterInto(IUplinkHost host, IChannelPublisher lifeSupport, IChannelPublisher crew, IChannelPublisher transmission)
        {
            _lifeSupport = lifeSupport as ICraftReadingPublisher;
            _crew = crew as ICraftReadingPublisher;
            _transmission = transmission as ICraftReadingPublisher;
            if (_lifeSupport == null || _crew == null || _transmission == null)
            {
                return;
            }
            host.AddSampledSource(CaptureOnMain, HandleOnCourier);
        }

        /// <summary>MAIN-THREAD: the next craft due a read, read whole, or null.</summary>
        internal object? CaptureOnMain(KspSnapshot? snapshot)
        {
            var all = FlightGlobals.Vessels;
            if (snapshot == null || all == null || !_k.IsAvailable || !HighLogic.LoadedSceneIsFlight)
            {
                return null;
            }
            var active = FlightGlobals.ActiveVessel;
            var simulated = all.Where(v => v != null && v != active && _k.IsSimulated(v) == true).ToList();
            var ids = simulated.Select(v => v.id.ToString()).ToList();
            var next = KerbalismLaneScope.NextDue(ids, _lastReadUt, ref _cursor, snapshot.Ut);
            if (next == null)
            {
                return null;
            }
            ReadBudget.Record(1, snapshot.Ut);
            var captured = _capture(simulated[ids.IndexOf(next)], snapshot.Ut);
            return captured == null ? null : new CraftRead(next, captured);
        }

        /// <summary>COURIER-THREAD: publish one craft's readings into its record. No KSP access.</summary>
        internal void HandleOnCourier(object? captured)
        {
            if (captured is not CraftRead read)
            {
                return;
            }
            var c = read.Captured;
            _lifeSupport!.PublishFor(
                read.Id,
                KerbalismCapture.BuildLifeSupport(c.Snapshot, c.Processes, c.Snapshot.Rates, c.RuleEnvModifiers, c.AsOfUt),
                c.Ut);
            _crew!.PublishFor(read.Id, KerbalismCapture.BuildCrew(c.Crew, c.RuleConstants, c.AsOfUt, c.DeathClocks()), c.Ut);
            if (c.Transmission != null)
            {
                _transmission!.PublishFor(read.Id, KerbalismCapture.BuildTransmission(c.Transmission), c.Ut);
            }
        }

        private sealed class CraftRead
        {
            public CraftRead(string id, KerbalismUplink.KerbalismCaptured captured)
            {
                Id = id;
                Captured = captured;
            }

            public string Id { get; }
            public KerbalismUplink.KerbalismCaptured Captured { get; }
        }
    }
}
