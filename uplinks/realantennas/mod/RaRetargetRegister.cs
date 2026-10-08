using System;
using System.Collections.Generic;
using System.Linq;

namespace Gonogo.RealAntennasUplink
{
    /// <summary>How a borrowed dish's loan ended.</summary>
    internal enum RaBorrowOutcome
    {
        /// <summary>Still borrowed.</summary>
        Open,

        /// <summary>The dish was put back as it was.</summary>
        Restored,

        /// <summary>The operator aimed the dish meanwhile; their aim was kept and nothing was written.</summary>
        Taken,

        /// <summary>The dish or its craft is gone, so there was nothing to put back.</summary>
        Gone,
    }

    /// <summary>
    /// What the Uplink owes the craft it borrowed a dish from, and the operator's
    /// standing choice of whether a craft may be borrowed from at all. KSP-free
    /// and RealAntennas-free, so its whole surface is reachable headlessly.
    ///
    /// <para><b>The record is written before the dish moves.</b> A turn that
    /// stranded a dish on a borrowed aim, because the game quit between the write
    /// and the restore, would leave a relay's main dish pointing at a peer for
    /// good. So an entry exists, and is saved with the game, before the aim is
    /// written, and it stays until a restore (or the operator, or the dish's
    /// disappearance) settles it.</para>
    ///
    /// <para>It is keyed by the dish id of the contact plan
    /// (<see cref="RaDishIds"/>), which names the part by its persistent id and so
    /// finds the same antenna loaded, on rails and after a load.</para>
    /// </summary>
    internal sealed class RaRetargetRegister
    {
        /// <summary>One dish on loan.</summary>
        internal sealed class Borrow
        {
            public string Id = "";

            /// <summary>The dish, as the plan names it.</summary>
            public string DishId = "";

            /// <summary>The craft's guid, from the dish id.</summary>
            public string VesselId = "";

            /// <summary>The node the dish was turned to.</summary>
            public string PeerId = "";

            /// <summary>The dish's name, its part's title, for words.</summary>
            public string DishName = "";

            /// <summary>What the dish was aimed at before, as the single-target command takes it. Written back exactly.</summary>
            public RealAntennasTargetStepArgs Previous = new RealAntennasTargetStepArgs();

            /// <summary>What the dish was aimed at before, in words.</summary>
            public string PreviousLabel = "";

            /// <summary>When the dish was turned.</summary>
            public double TurnedUt;

            public RaBorrowOutcome Outcome = RaBorrowOutcome.Open;

            /// <summary>When the loan ended, or NaN while it lasts.</summary>
            public double SettledUt = double.NaN;

            public bool IsOpen => Outcome == RaBorrowOutcome.Open;
        }

        private readonly Dictionary<string, Borrow> _borrows = new Dictionary<string, Borrow>(StringComparer.Ordinal);
        private readonly HashSet<string> _optedOut = new HashSet<string>(StringComparer.Ordinal);
        private readonly Dictionary<string, Borrow> _lastByVessel = new Dictionary<string, Borrow>(StringComparer.Ordinal);
        private long _nextId;

        /// <summary>Every loan that has not ended.</summary>
        public IEnumerable<Borrow> Open => _borrows.Values.Where(b => b.IsOpen);

        /// <summary>The most recent loan that ended, per craft, for display.</summary>
        public IReadOnlyDictionary<string, Borrow> LastEnded => _lastByVessel;

        /// <summary>Every craft the operator has opted out of automatic retargeting.</summary>
        public IEnumerable<string> OptedOut
        {
            get
            {
                lock (_optedOut)
                {
                    return _optedOut.ToList();
                }
            }
        }

        /// <summary>Whether a craft may have a dish turned on its own. The default is yes. Safe from any thread: the network reads it while the main thread writes it.</summary>
        public bool Allowed(string vesselGuid)
        {
            lock (_optedOut)
            {
                return !_optedOut.Contains(vesselGuid);
            }
        }

        /// <summary>Sets whether a craft may have a dish turned on its own.</summary>
        public void SetAllowed(string vesselGuid, bool allowed)
        {
            lock (_optedOut)
            {
                if (allowed)
                {
                    _optedOut.Remove(vesselGuid);
                }
                else
                {
                    _optedOut.Add(vesselGuid);
                }
            }
        }

        public Borrow? Find(string? recordId) =>
            recordId != null && _borrows.TryGetValue(recordId, out var borrow) ? borrow : null;

        /// <summary>The open loan of a dish, or null.</summary>
        public Borrow? OpenOn(string dishId) =>
            _borrows.Values.FirstOrDefault(b => b.IsOpen && string.Equals(b.DishId, dishId, StringComparison.Ordinal));

        /// <summary>The open loan of any dish on the same antenna of the same part, whichever craft each was last seen on.</summary>
        public Borrow? OpenOnPart(uint partPersistentId, int ordinal) =>
            _borrows.Values.FirstOrDefault(b =>
                b.IsOpen && RaDishIds.TryParse(b.DishId, out _, out var part, out var number) && part == partPersistentId && number == ordinal);

        /// <summary>
        /// Opens a loan. Null when the dish is already on loan, which is how two
        /// events can never hold one dish. The record exists from here, before
        /// anything is written to the game.
        /// </summary>
        public Borrow? Begin(string dishId, string peerId, RealAntennasTargetStepArgs previous, string previousLabel, double turnedUt, string dishName = "")
        {
            if (!RaDishIds.TryParse(dishId, out var nodeId, out _, out _) || OpenOn(dishId) != null)
            {
                return null;
            }
            var borrow = new Borrow
            {
                Id = "borrow-" + (++_nextId),
                DishId = dishId,
                VesselId = RaDishIds.VesselGuid(nodeId) ?? nodeId,
                PeerId = peerId,
                DishName = dishName,
                Previous = previous,
                PreviousLabel = previousLabel,
                TurnedUt = turnedUt,
            };
            _borrows[borrow.Id] = borrow;
            return borrow;
        }

        /// <summary>Ends a loan. False when it was already over or never existed.</summary>
        public bool Settle(string recordId, RaBorrowOutcome outcome, double ut)
        {
            var borrow = Find(recordId);
            if (borrow == null || !borrow.IsOpen || outcome == RaBorrowOutcome.Open)
            {
                return false;
            }
            borrow.Outcome = outcome;
            borrow.SettledUt = ut;
            _lastByVessel[borrow.VesselId] = borrow;
            Forget();
            return true;
        }

        /// <summary>
        /// Restores one saved loan as it was, still open or already over. A loan
        /// over is kept only as its craft's last, for display.
        /// </summary>
        public void Restore(Borrow borrow)
        {
            if (string.IsNullOrEmpty(borrow.Id))
            {
                return;
            }
            _borrows[borrow.Id] = borrow;
            if (!borrow.IsOpen)
            {
                if (!_lastByVessel.TryGetValue(borrow.VesselId, out var last) || last.SettledUt < borrow.SettledUt)
                {
                    _lastByVessel[borrow.VesselId] = borrow;
                }
                Forget();
            }
            var number = borrow.Id.StartsWith("borrow-", StringComparison.Ordinal) && long.TryParse(borrow.Id.Substring(7), out var n) ? n : 0;
            _nextId = Math.Max(_nextId, number);
        }

        public void Clear()
        {
            _borrows.Clear();
            lock (_optedOut)
            {
                _optedOut.Clear();
            }
            _lastByVessel.Clear();
            _nextId = 0;
        }

        /// <summary>Ended loans are kept only as each craft's last: the rest are dropped so the save does not grow.</summary>
        private void Forget()
        {
            var keep = new HashSet<string>(_lastByVessel.Values.Select(b => b.Id), StringComparer.Ordinal);
            foreach (var id in _borrows.Where(p => !p.Value.IsOpen && !keep.Contains(p.Key)).Select(p => p.Key).ToList())
            {
                _borrows.Remove(id);
            }
        }
    }
}
