using System;
using System.Collections.Generic;
using Sitrep.Contract;

namespace Gonogo.RealAntennasUplink
{
    /// <summary>
    /// RealAntennas' own reach rule: how far apart two nodes can be and still
    /// close a link budget, which is a different question from stock's and
    /// answered in a different currency (dB, not antenna power against a range
    /// curve). The model <see cref="RaCommsBackend.ReachModel"/> hands back.
    ///
    /// <para><b>Why RA has to answer this itself.</b> RA zeroes both
    /// <c>antennaTransmit.power</c> and <c>antennaRelay.power</c> on every
    /// vessel, unconditionally, in <c>RACommNetVessel.UpdateComm</c>. Stock's
    /// rule read off those fields therefore reports a maximum range of zero for
    /// every craft in the game on an RA install: a permanent, plausible,
    /// catastrophic "nothing reaches" that would darken every contact
    /// prediction. Ground stations keep non-zero relay power, so the failure is
    /// not even uniform enough to notice as obviously broken. This is the same
    /// shape of trap as the routing one <c>RaRouting</c> exists for: the stock
    /// member is still there and still readable, it just no longer means what it
    /// says.</para>
    ///
    /// <para><b>The shorter of two directions.</b> RA carries a link only when
    /// the data rate is positive both ways (its <c>Precompute</c> gate), so the
    /// pair's reach is the smaller of its two directional maxima rather than
    /// either one. An asymmetric pair, a big dish talking to a whip, closes
    /// outbound long after it has stopped closing inbound, and the generous
    /// direction is the wrong answer.</para>
    ///
    /// <para><b>The best antenna on each node.</b> A node carries a list of
    /// them and RA picks per link; unlinked, the honest bound is the pairing
    /// that reaches furthest, since the craft would use it if it could. That is
    /// deliberately the optimistic choice within the pair, for the same reason
    /// the reach fallback asserts nothing: this rule may only ever shorten a
    /// prediction the geometry already allowed, so an over-tight bound invents
    /// blackouts that the game does not have.</para>
    ///
    /// <para>Best-effort, on exactly the terms <see cref="RaLinkBudget"/>
    /// already states: it re-derives RA's public formulas and does not reproduce
    /// RA's negotiated-modulation tie-break, so the number is an estimate of RA's
    /// own rather than a bit-for-bit match. Absent rather than wrong whenever an
    /// input will not read.</para>
    /// </summary>
    internal static class RaReach
    {
        public const string ModelId = "realantennas-link-budget";

        public const string ModelName = "RealAntennas (link budget closes in dB)";

        public const string UnpoweredModelId = "realantennas-unpowered";

        public const string UnpoweredModelName = "RealAntennas (no electric charge aboard)";

        /// <summary>
        /// <paramref name="reach"/>, or no reach at all when either end holds no
        /// electric charge: a craft that cannot power its antennas carries no
        /// link whatever the budget says, so a plan must not promise it a window.
        /// An end whose charge could not be read (null) is never taken as empty.
        /// </summary>
        internal static ICommsReachModel WithPower(ICommsReachModel reach, bool? fromHasCharge, bool? toHasCharge) =>
            AnEndIsUnpowered(fromHasCharge, toHasCharge)
                ? new MaxRangeReachModel(UnpoweredModelId, UnpoweredModelName, 0.0, CommsNoReachReasons.Unpowered)
                : reach;

        /// <summary>Whether either end is known to hold no electric charge; an end whose charge is unknown is not.</summary>
        internal static bool AnEndIsUnpowered(bool? fromHasCharge, bool? toHasCharge) =>
            fromHasCharge == false || toHasCharge == false;

        /// <summary>
        /// The reach model for a pair of nodes, or
        /// <see cref="CommsReachModels.Unknown"/> when RA will not say: an
        /// unreadable handle, a node with no antennas, or a budget that resolves
        /// in neither direction.
        ///
        /// <para><b>Unknown, not zero, when nothing reads.</b> A zero would
        /// assert that RA carries this pair nowhere, and a reflection surface
        /// that has moved must degrade the prediction's fidelity rather than
        /// blacking it out. A pair RA genuinely cannot close at any distance is
        /// reported the same way, absent, because this rule cannot tell that
        /// case apart from a failed read: both come back as no solvable budget.
        /// Saying so is honest; guessing which one it was is not.</para>
        /// </summary>
        /// <param name="from">One end's antennas as the plan read them, or null when they would not read.</param>
        /// <param name="to">The other end's.</param>
        internal static ICommsReachModel Between(
            IReadOnlyList<RaPlannedAntenna>? from, IReadOnlyList<RaPlannedAntenna>? to, bool? fromHasCharge, bool? toHasCharge) =>
            WithPower(BudgetReach(from, to), fromHasCharge, toHasCharge);

        /// <summary>
        /// The pair's reach from its antennas alone, whatever charge either end
        /// holds: a function of the two lists and nothing else, so it stands for
        /// as long as both lists do.
        /// </summary>
        internal static ICommsReachModel BudgetReach(IReadOnlyList<RaPlannedAntenna>? from, IReadOnlyList<RaPlannedAntenna>? to)
        {
            if (from == null || to == null || from.Count == 0 || to.Count == 0)
            {
                return CommsReachModels.Unknown;
            }

            var forward = BestDirection(from, to);
            var reverse = BestDirection(to, from);
            if (forward == null || reverse == null)
            {
                return CommsReachModels.Unknown;
            }

            var limiting = Math.Min(forward.Value, reverse.Value);
            return new MaxRangeReachModel(ModelId, ModelName, limiting);
        }

        /// <summary>
        /// The furthest-reaching transmit/receive antenna pairing in one
        /// direction, or null when no pairing yields a solvable budget.
        /// </summary>
        private static double? BestDirection(IReadOnlyList<RaPlannedAntenna> transmitters, IReadOnlyList<RaPlannedAntenna> receivers)
        {
            double? best = null;
            foreach (var tx in transmitters)
            {
                if (tx.TxPowerDbm == null || tx.GainDbi == null || tx.FrequencyHz == null || tx.SymbolRateHz == null)
                {
                    continue;
                }

                foreach (var rx in receivers)
                {
                    if (rx.GainDbi == null)
                    {
                        continue;
                    }

                    // Same fail-soft constants the live margin already uses, so
                    // a moved RA surface degrades this number's fidelity rather
                    // than removing the rule.
                    // RealAntennas keeps a link by stepping its symbol rate down, so the
                    // pair reaches as far as the slowest rate both ends can run closes.
                    var slowest = RaRateLadder.SlowestCommonSymbolRate(
                        tx.SymbolRateHz,
                        tx.MinSymbolRateHz,
                        rx.SymbolRateHz ?? tx.SymbolRateHz,
                        rx.SymbolRateHz == null ? tx.MinSymbolRateHz : rx.MinSymbolRateHz);
                    if (slowest == null)
                    {
                        continue;
                    }
                    // The pair talks through the lower-level encoder of the two.
                    var encoderEnd = tx.EncoderTechLevel != null && rx.EncoderTechLevel != null && rx.EncoderTechLevel.Value < tx.EncoderTechLevel.Value
                        ? rx
                        : tx;
                    var range = RaLinkBudget.MaxRangeMeters(
                        tx.TxPowerDbm.Value,
                        tx.GainDbi.Value,
                        rx.GainDbi.Value,
                        tx.FrequencyHz.Value,
                        rx.NoiseTemperatureKelvin ?? DefaultReceiverNoiseTempKelvin,
                        slowest.Value,
                        encoderEnd.EncoderRequiredEbN0Db ?? rx.RequiredEbN0Db ?? DefaultRequiredEbN0Db);

                    if (range != null && (best == null || range.Value > best.Value))
                    {
                        best = range;
                    }
                }
            }
            return best;
        }

        /// <summary>Fallback receiver noise temperature, matching <c>RealAntennasUplink</c>'s.</summary>
        private const double DefaultReceiverNoiseTempKelvin = 200.0;

        /// <summary>Fallback required Eb/N0, matching <c>RealAntennasUplink</c>'s.</summary>
        private const double DefaultRequiredEbN0Db = 2.5;
    }
}
