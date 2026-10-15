using System;
using System.Collections.Generic;
using Sitrep.Contract;

namespace Gonogo.RealAntennasUplink
{
    /// <summary>What one antenna is pointed at, as the contact plan can resolve it.</summary>
    public enum RaAimKind
    {
        /// <summary>No target: a ground station, which RA serves with no pointing loss in any direction.</summary>
        Untargeted,

        /// <summary>Another craft, by its plan id.</summary>
        Vessel,

        /// <summary>A body's centre, which is where RA's default home target points.</summary>
        BodyCentre,

        /// <summary>A target the plan cannot place: a surface point, an azimuth and elevation, an orbit-relative direction.</summary>
        Unplaced,
    }

    /// <summary>
    /// One antenna as the contact plan sees it: its link-budget figures, its band,
    /// how wide it sees, and what it is aimed at. Captured on the main thread as
    /// plain data, so the model built from it runs anywhere.
    /// </summary>
    public sealed class RaPlannedAntenna
    {
        public string Id = "";

        /// <summary>
        /// The dish's id in a contact plan (see <see cref="RaDishIds"/>), or null
        /// for an antenna the plan does not name: an omni, a ground station's, or
        /// one whose part cannot be read.
        /// </summary>
        public string? DishId;

        /// <summary>False for an omni, whose beam covers every direction.</summary>
        public bool Steerable;

        /// <summary>The beamwidth in radians, for a steerable dish.</summary>
        public double? BeamwidthRadians;

        /// <summary>RA's band name; two antennas in different named bands never pair.</summary>
        public string? Band;

        public double? TxPowerDbm;
        public double? GainDbi;
        public double? FrequencyHz;
        public double? SymbolRateHz;
        public double? NoiseTemperatureKelvin;
        public double? RequiredEbN0Db;

        /// <summary>The slowest symbol rate the antenna's modulator steps down to, for the rate ladder a link's strength is read off.</summary>
        public double? MinSymbolRateHz;

        /// <summary>The most modulation bits the antenna's modulator supports.</summary>
        public int? ModulationBits;

        /// <summary>The antenna's own tech level, a fact about the hop and no part of the budget.</summary>
        public int? TechLevel;

        /// <summary>The encoder's name, tech level, coding rate and the energy per bit it needs. Two antennas talk through the lower-level encoder of the two.</summary>
        public string? EncoderName;
        public int? EncoderTechLevel;
        public double? CodingRate;
        public double? EncoderRequiredEbN0Db;

        /// <summary>The antenna's electric charge draw while transmitting, a fact about the hop.</summary>
        public double? PowerDrawEc;

        public RaAimKind Aim;

        /// <summary>What the antenna is aimed at, in RealAntennas' own words, for a card that says so.</summary>
        public string? AimLabel;

        /// <summary>The craft aimed at, as <c>"vessel:&lt;guid&gt;"</c>, when <see cref="Aim"/> is <see cref="RaAimKind.Vessel"/>.</summary>
        public string? AimNodeId;

        /// <summary>The body aimed at, when <see cref="Aim"/> is <see cref="RaAimKind.BodyCentre"/>.</summary>
        public int? AimBodyIndex;

        /// <summary>The body whose surface the antenna's station stands on, for a ground station, whose receiver sees through that body's atmosphere.</summary>
        public int? GroundBodyIndex;

        /// <summary>This antenna as it would be with its dish turned to look at whatever it is paired with.</summary>
        internal RaPlannedAntenna AimedAtAnyPeer()
        {
            var turned = (RaPlannedAntenna)MemberwiseClone();
            turned.Aim = RaAimKind.Untargeted;
            return turned;
        }
    }

    /// <summary>
    /// A pair's link under RealAntennas, over time: the best of every compatible
    /// antenna pairing, each the smaller of how far inside its beam each end's dish
    /// sees the other and how much range the pairing has to spare once both ends'
    /// pointing losses are paid.
    ///
    /// <para>Aims stay as they were captured for the whole plan. RA walks a fallback
    /// chain only on a loaded craft, so for every craft on rails that is exactly what
    /// happens; for the loaded one, a step its chain takes after losing contact is
    /// not foreseen here.</para>
    /// </summary>
    public sealed class RaContactLinkModel : IAttributedContactLinkModel
    {
        /// <summary>The margin of a pair with no pairing that can close at all.</summary>
        public const double NoPairing = -1.0;

        private readonly IReadOnlyList<RaPlannedAntenna> _from;
        private readonly IReadOnlyList<RaPlannedAntenna> _to;
        private readonly int _minRelayTechLevel;
        private readonly bool _fromIsHome;
        private readonly bool _toIsHome;
        private readonly IReadOnlyList<RaOccluder> _occluders;

        /// <param name="minRelayTechLevel">
        /// RealAntennas' relay gate: a craft carries another's traffic only through an
        /// antenna of at least this tech level. Zero applies no gate.
        /// </param>
        /// <param name="fromIsHome">A ground station is a destination and is never gated.</param>
        /// <param name="toIsHome">As <paramref name="fromIsHome"/>, for the other end.</param>
        /// <param name="occluders">The bodies whose warm discs add noise to a dish that sees them; none adds no body noise.</param>
        public RaContactLinkModel(
            IReadOnlyList<RaPlannedAntenna> from,
            IReadOnlyList<RaPlannedAntenna> to,
            int minRelayTechLevel = 0,
            bool fromIsHome = false,
            bool toIsHome = false,
            IReadOnlyList<RaOccluder>? occluders = null)
        {
            _occluders = occluders ?? new RaOccluder[0];
            _from = from ?? throw new ArgumentNullException(nameof(from));
            _to = to ?? throw new ArgumentNullException(nameof(to));
            _minRelayTechLevel = minRelayTechLevel;
            _fromIsHome = fromIsHome;
            _toIsHome = toIsHome;
        }

        public double MarginAt(double ut, Sitrep.Contract.Vector3d from, Sitrep.Contract.Vector3d to, IContactPositions positions)
        {
            var best = Best(ut, from, to, positions, out _, out _);
            if (double.IsNegativeInfinity(best))
            {
                return NoPairing;
            }
            // Omnis at both ends with no solvable budget leave nothing to constrain.
            return double.IsPositiveInfinity(best) ? 1.0 : best;
        }

        /// <summary>
        /// The dishes of the pairing that gives <see cref="MarginAt"/> its margin.
        /// On a tie the first pairing wins, so the answer is the same however many
        /// times, and in whatever order, it is asked.
        /// </summary>
        public DishPair DishesAt(double ut, Sitrep.Contract.Vector3d from, Sitrep.Contract.Vector3d to, IContactPositions positions)
        {
            Best(ut, from, to, positions, out var a, out var b);
            return new DishPair(a?.Steerable == true ? a.DishId : null, b?.Steerable == true ? b.DishId : null);
        }

        private double Best(
            double ut, Sitrep.Contract.Vector3d from, Sitrep.Contract.Vector3d to, IContactPositions positions,
            out RaPlannedAntenna? bestFrom, out RaPlannedAntenna? bestTo)
        {
            var best = double.NegativeInfinity;
            bestFrom = null;
            bestTo = null;
            foreach (var a in _from)
            {
                foreach (var b in _to)
                {
                    if (!Compatible(a, b) || !ClearsRelayGate(a, b))
                    {
                        continue;
                    }
                    var angleA = OffAxis(a, from, to, ut, positions);
                    var angleB = OffAxis(b, to, from, ut, positions);
                    if (Unplaceable(a, angleA) || Unplaceable(b, angleB))
                    {
                        continue;
                    }
                    var margin = Math.Min(
                        Math.Min(Cliff(a, angleA), Cliff(b, angleB)),
                        RangeMargin(
                            a, b, (to - from).Magnitude(), LossDb(a, angleA), LossDb(b, angleB),
                            ExtraNoiseKelvin(a, from, to, ut, positions, _occluders),
                            ExtraNoiseKelvin(b, to, from, ut, positions, _occluders)));
                    if (margin > best)
                    {
                        best = margin;
                        bestFrom = a;
                        bestTo = b;
                    }
                }
            }
            return best;
        }

        /// <summary>
        /// RealAntennas admits a craft to a route only through a receiving antenna at or
        /// above the relay minimum, unless the craft is the destination. A pairing
        /// between two craft therefore carries traffic when either end's antenna clears
        /// it, toward that end; a ground station end is the destination and passes. An
        /// antenna whose tech level will not read is not gated.
        /// </summary>
        private bool ClearsRelayGate(RaPlannedAntenna a, RaPlannedAntenna b)
        {
            if (_minRelayTechLevel <= 0 || _fromIsHome || _toIsHome || a.TechLevel == null || b.TechLevel == null)
            {
                return true;
            }
            return Math.Max(a.TechLevel.Value, b.TechLevel.Value) >= _minRelayTechLevel;
        }

        /// <summary>
        /// A dish that points at something yet has no angle to its peer, because the aim
        /// cannot be placed or the craft aimed at is not in the plan. It cannot be shown
        /// to see the peer, so it does not pair.
        /// </summary>
        private static bool Unplaceable(RaPlannedAntenna antenna, double? offAxis) =>
            offAxis == null && antenna.Steerable && antenna.Aim != RaAimKind.Untargeted && antenna.BeamwidthRadians != null;

        /// <summary>Two antennas pair unless both name a band and the bands differ.</summary>
        public static bool Compatible(RaPlannedAntenna a, RaPlannedAntenna b) =>
            a.Band == null || b.Band == null || string.Equals(a.Band, b.Band, StringComparison.Ordinal);

        /// <summary>
        /// How far off its aim the dish at <paramref name="self"/> sees
        /// <paramref name="peer"/>, in radians, or null for an omni or an untargeted
        /// antenna, which take no pointing loss in any direction, and for a dish whose
        /// aim cannot be placed, which <see cref="Best"/> then refuses to pair.
        /// </summary>
        public static double? OffAxis(RaPlannedAntenna antenna, Sitrep.Contract.Vector3d self, Sitrep.Contract.Vector3d peer, double ut, IContactPositions positions)
        {
            if (!antenna.Steerable || antenna.Aim == RaAimKind.Untargeted || antenna.BeamwidthRadians == null)
            {
                return null;
            }
            Sitrep.Contract.Vector3d? aim = antenna.Aim == RaAimKind.Vessel && antenna.AimNodeId != null
                ? positions.NodeAt(antenna.AimNodeId, ut)
                : antenna.Aim == RaAimKind.BodyCentre && antenna.AimBodyIndex != null
                    ? positions.BodyAt(antenna.AimBodyIndex.Value, ut)
                    : (Sitrep.Contract.Vector3d?)null;
            return aim == null ? (double?)null : AngleBetween(aim.Value - self, peer - self);
        }

        /// <summary>How far inside the beamwidth the peer sits, in radians; RA's loss is a cliff beyond it.</summary>
        public static double Cliff(RaPlannedAntenna antenna, double? offAxis) =>
            offAxis == null ? double.PositiveInfinity : antenna.BeamwidthRadians!.Value - offAxis.Value;

        /// <summary>
        /// The pointing loss inside the beam, in dB, from RealAntennas' own curve:
        /// 3 dB at half the beamwidth and 10 dB at the beam's edge. Beyond the
        /// edge RA loses the link outright, which <see cref="Cliff"/> carries.
        /// </summary>
        public static double LossDb(RaPlannedAntenna antenna, double? offAxis)
        {
            if (offAxis == null)
            {
                return 0.0;
            }
            var width = antenna.BeamwidthRadians!.Value;
            return RaLinkBudget.PointingLossDb(Math.Min(offAxis.Value, width), width);
        }

        /// <summary>
        /// The pairing's spare range as a fraction of its reach, the shorter of the
        /// two directions as RA requires both. Unbounded when the budget cannot be
        /// solved, which applies no range term, as <see cref="RaReach"/> does.
        /// </summary>
        public static double RangeMargin(
            RaPlannedAntenna a, RaPlannedAntenna b, double separation, double lossA = 0.0, double lossB = 0.0,
            double extraNoiseA = 0.0, double extraNoiseB = 0.0)
        {
            var forward = Reach(a, b, lossA + lossB, extraNoiseB);
            var reverse = Reach(b, a, lossA + lossB, extraNoiseA);
            if (forward == null || reverse == null || !(Math.Min(forward.Value, reverse.Value) > 0.0))
            {
                return double.PositiveInfinity;
            }
            var reach = Math.Min(forward.Value, reverse.Value);
            return (reach - separation) / reach;
        }

        private static double? Reach(RaPlannedAntenna tx, RaPlannedAntenna rx, double pointingLossDb, double extraNoiseKelvin)
        {
            if (tx.TxPowerDbm == null || tx.GainDbi == null || tx.FrequencyHz == null || tx.SymbolRateHz == null || rx.GainDbi == null)
            {
                return null;
            }
            // The link is lost where the slowest rate both ends can run stops closing, not where the fastest does.
            // A receiver whose rates were not read is taken to run at the transmitter's.
            var slowest = RaRateLadder.SlowestCommonSymbolRate(
                tx.SymbolRateHz, tx.MinSymbolRateHz, rx.SymbolRateHz ?? tx.SymbolRateHz, rx.SymbolRateHz == null ? tx.MinSymbolRateHz : rx.MinSymbolRateHz);
            if (slowest == null)
            {
                return null;
            }
            return RaLinkBudget.MaxRangeMeters(
                tx.TxPowerDbm.Value,
                tx.GainDbi.Value - pointingLossDb,
                rx.GainDbi.Value,
                tx.FrequencyHz.Value,
                (rx.NoiseTemperatureKelvin ?? DefaultReceiverNoiseTempKelvin) + extraNoiseKelvin,
                slowest.Value,
                MatchedEbN0Db(tx, rx));
        }

        /// <summary>
        /// The energy per bit over noise density a pair needs, in decibels: that of
        /// the lower-level encoder of the two, as RealAntennas' matched encoder is,
        /// not the receiver's own. Where either level is not known the transmitter's
        /// encoder is taken, then the receiver's own figure, then the default.
        /// </summary>
        internal static double MatchedEbN0Db(RaPlannedAntenna tx, RaPlannedAntenna rx)
        {
            var encoder = tx.EncoderTechLevel != null && rx.EncoderTechLevel != null && rx.EncoderTechLevel.Value < tx.EncoderTechLevel.Value ? rx : tx;
            return encoder.EncoderRequiredEbN0Db ?? rx.RequiredEbN0Db ?? DefaultRequiredEbN0Db;
        }

        /// <summary>
        /// The noise, in kelvin, a receiving antenna at <paramref name="self"/> adds
        /// to its own and the cosmic background's while hearing the antenna at
        /// <paramref name="peer"/>: the warm disc of every body in its beam, and
        /// the atmosphere over a ground station. A dish with no target tracks its
        /// peer; one with a target looks along it. An omni sees no body.
        /// </summary>
        public static double ExtraNoiseKelvin(
            RaPlannedAntenna antenna,
            Sitrep.Contract.Vector3d self,
            Sitrep.Contract.Vector3d peer,
            double ut,
            IContactPositions positions,
            IReadOnlyList<RaOccluder> occluders)
        {
            if (antenna.FrequencyHz == null)
            {
                return 0.0;
            }
            var frequency = antenna.FrequencyHz.Value;
            var total = 0.0;
            if (antenna.GroundBodyIndex != null)
            {
                var ground = positions.BodyAt(antenna.GroundBodyIndex.Value, ut);
                var elevation = Math.Max(0.0, 90.0 - RaSkyNoise.AngleDegrees(self - ground, peer - self));
                total += RaSkyNoise.AtmosphereNoiseTempKelvin(elevation, frequency);
            }
            if (antenna.GainDbi == null || antenna.GainDbi.Value <= RaSkyNoise.OmniGainDbi || antenna.BeamwidthRadians == null)
            {
                return total;
            }
            Sitrep.Contract.Vector3d? aim = antenna.Aim == RaAimKind.Untargeted
                ? peer
                : antenna.Aim == RaAimKind.Vessel && antenna.AimNodeId != null
                    ? positions.NodeAt(antenna.AimNodeId, ut)
                    : antenna.Aim == RaAimKind.BodyCentre && antenna.AimBodyIndex != null
                        ? positions.BodyAt(antenna.AimBodyIndex.Value, ut)
                        : (Sitrep.Contract.Vector3d?)null;
            if (aim == null)
            {
                return total;
            }
            var beamwidthDegrees = antenna.BeamwidthRadians.Value * (180.0 / Math.PI);
            foreach (var body in occluders)
            {
                var centre = positions.BodyAt(body.BodyIndex, ut);
                var temperature = body.IsStar ? RaSkyNoise.StarRadioTempKelvin(body.TemperatureKelvin, frequency) : body.TemperatureKelvin;
                total += RaSkyNoise.BodyNoiseTempKelvin(
                    self, antenna.GainDbi.Value, aim.Value - self, centre, body.RadiusMeters, temperature, beamwidthDegrees);
            }
            return total;
        }

        private static double AngleBetween(Sitrep.Contract.Vector3d u, Sitrep.Contract.Vector3d v)
        {
            var lengths = u.Magnitude() * v.Magnitude();
            if (!(lengths > 0.0))
            {
                return 0.0;
            }
            var cos = Sitrep.Contract.Vector3d.Dot(u, v) / lengths;
            return Math.Acos(Math.Max(-1.0, Math.Min(1.0, cos)));
        }

        /// <summary>Fallback receiver noise temperature, matching <see cref="RaReach"/>'s.</summary>
        internal const double DefaultReceiverNoiseTempKelvin = 200.0;

        /// <summary>Fallback required Eb/N0, matching <see cref="RaReach"/>'s.</summary>
        internal const double DefaultRequiredEbN0Db = 2.5;
    }
}
