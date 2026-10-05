using System;
using System.Collections.Generic;

namespace Gonogo.RealAntennasUplink
{
    /// <summary>
    /// What a link between two nodes is worth under RealAntennas at a given
    /// separation, worked out from the two ends' antennas as they were captured:
    /// the same strength RealAntennas gives the link in the game, the lesser of
    /// the two directions' rate-ladder metrics (<see cref="RaRateLadder"/>).
    ///
    /// <para>Each direction takes the pairing of one end's transmitter and the
    /// other's receiver that carries the most data, as RealAntennas does, and
    /// two antennas talk through whichever of their encoders has the lower tech
    /// level.</para>
    ///
    /// <para>Two things RealAntennas folds in are left out. Pointing loss: this
    /// is asked only of a hop the plan already holds to be inside both beams.
    /// Noise picked up from a body behind the other end: the receiver's own
    /// noise temperature is used as it was read.</para>
    ///
    /// <para>Pure and KSP-free.</para>
    /// </summary>
    public static class RaLinkWorth
    {
        /// <summary>One link at one separation.</summary>
        public readonly struct Worth
        {
            public Worth(double strength, RaPlannedAntenna? forwardTx, RaPlannedAntenna? forwardRx, RaRateLadder.Rate forward, RaRateLadder.Rate reverse)
            {
                Strength = strength;
                ForwardTx = forwardTx;
                ForwardRx = forwardRx;
                Forward = forward;
                Reverse = reverse;
            }

            /// <summary>From 0 to 1: the lesser of the two directions' metrics, and 0 when either does not close.</summary>
            public double Strength { get; }

            /// <summary>The transmitting antenna of the forward direction's best pairing, or null when none closes.</summary>
            public RaPlannedAntenna? ForwardTx { get; }

            /// <summary>The receiving antenna of that pairing.</summary>
            public RaPlannedAntenna? ForwardRx { get; }

            public RaRateLadder.Rate Forward { get; }

            public RaRateLadder.Rate Reverse { get; }
        }

        /// <param name="from">The antennas at the end the hop leaves.</param>
        /// <param name="to">The antennas at the end it arrives at.</param>
        /// <param name="separationMeters">How far apart the two ends are.</param>
        public static Worth At(IReadOnlyList<RaPlannedAntenna> from, IReadOnlyList<RaPlannedAntenna> to, double separationMeters)
        {
            var forward = Best(from, to, separationMeters, out var tx, out var rx);
            var reverse = Best(to, from, separationMeters, out _, out _);
            var closes = forward.BitsPerSecond > 0.0 && reverse.BitsPerSecond > 0.0;
            return new Worth(closes ? Math.Min(forward.Metric, reverse.Metric) : 0.0, closes ? tx : null, closes ? rx : null, forward, reverse);
        }

        /// <summary>The key the hop's facts go under, the comms provider's own id (<c>RaCommsBackend.Id</c>, which cannot be named from a file that builds without the game).</summary>
        public const string ProviderId = "realantennas";

        /// <summary>
        /// The hop's facts in the bag <c>comms.path</c> carries under
        /// <see cref="ProviderId"/>, with the same keys the measured bag has,
        /// or null when the link does not close.
        /// </summary>
        public static Dictionary<string, object?>? Extensions(Worth worth)
        {
            var tx = worth.ForwardTx;
            if (tx == null)
            {
                return null;
            }
            return new Dictionary<string, object?>
            {
                [ProviderId] = new Dictionary<string, object?>
                {
                    ["band"] = tx.Band,
                    ["techLevel"] = tx.TechLevel,
                    ["modulationBits"] = tx.ModulationBits,
                    ["encoder"] = tx.EncoderName,
                    ["codingRate"] = tx.CodingRate,
                    ["requiredEbN0"] = worth.ForwardRx?.RequiredEbN0Db,
                    ["beamwidth"] = tx.BeamwidthRadians == null ? (double?)null : tx.BeamwidthRadians.Value * (180.0 / Math.PI),
                    ["powerDrawEc"] = tx.PowerDrawEc,
                    ["reverseBitsPerSec"] = worth.Reverse.BitsPerSecond,
                },
            };
        }

        private static RaRateLadder.Rate Best(
            IReadOnlyList<RaPlannedAntenna> transmitters,
            IReadOnlyList<RaPlannedAntenna> receivers,
            double separationMeters,
            out RaPlannedAntenna? bestTx,
            out RaPlannedAntenna? bestRx)
        {
            var best = new RaRateLadder.Rate(0.0, 0, 0.0);
            bestTx = null;
            bestRx = null;
            foreach (var tx in transmitters)
            {
                foreach (var rx in receivers)
                {
                    if (!RaContactLinkModel.Compatible(tx, rx))
                    {
                        continue;
                    }
                    var rate = OneWay(tx, rx, separationMeters);
                    if (rate.BitsPerSecond > best.BitsPerSecond)
                    {
                        best = rate;
                        bestTx = tx;
                        bestRx = rx;
                    }
                }
            }
            return best;
        }

        private static RaRateLadder.Rate OneWay(RaPlannedAntenna tx, RaPlannedAntenna rx, double separationMeters)
        {
            if (tx.TxPowerDbm == null || tx.GainDbi == null || tx.FrequencyHz == null || rx.GainDbi == null
                || tx.SymbolRateHz == null || rx.SymbolRateHz == null
                || tx.MinSymbolRateHz == null || rx.MinSymbolRateHz == null
                || tx.ModulationBits == null || rx.ModulationBits == null)
            {
                return new RaRateLadder.Rate(0.0, 0, 0.0);
            }
            // The lower-level encoder of the two; where either level is not known, the transmitter's.
            var encoder = tx.EncoderTechLevel != null && rx.EncoderTechLevel != null && rx.EncoderTechLevel.Value < tx.EncoderTechLevel.Value ? rx : tx;
            var received = RaLinkBudget.ReceivedPowerDbm(
                tx.TxPowerDbm.Value, tx.GainDbi.Value, rx.GainDbi.Value, separationMeters, tx.FrequencyHz.Value);
            var noise = RaLinkBudget.NoiseSpectralDensityDbm(rx.NoiseTemperatureKelvin ?? RaContactLinkModel.DefaultReceiverNoiseTempKelvin);
            return RaRateLadder.Select(
                received,
                noise + (encoder.EncoderRequiredEbN0Db ?? RaContactLinkModel.DefaultRequiredEbN0Db),
                Math.Min(tx.SymbolRateHz.Value, rx.SymbolRateHz.Value),
                Math.Max(tx.MinSymbolRateHz.Value, rx.MinSymbolRateHz.Value),
                Math.Min(tx.ModulationBits.Value, rx.ModulationBits.Value),
                encoder.CodingRate ?? 1.0);
        }
    }
}
