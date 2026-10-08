using System;
using System.Collections.Generic;
using System.Linq;
using Sitrep.Contract;

namespace Gonogo.RealAntennasUplink
{
    /// <summary>
    /// What turning one craft's dishes could do, as the contact plan asks it: which
    /// dishes the craft has and what each is aimed at, whether a dish aimed at a
    /// peer would close the link, and whether this craft could receive from a peer
    /// with nothing turned.
    ///
    /// <para>Captured as plain data on the main thread and evaluated anywhere. The
    /// peer's antennas are read through a lookup the backend fills in the same
    /// capture pass and does not touch again, so a question about a peer is
    /// answered from the figures the capture saw.</para>
    /// </summary>
    public sealed class RaRetargetModel : IRetargetModel
    {
        private readonly string _nodeId;
        private readonly IReadOnlyList<RaPlannedAntenna> _antennas;
        private readonly Func<string, IReadOnlyList<RaPlannedAntenna>?> _antennasOf;
        private readonly Func<string, bool> _allowed;
        private readonly Func<RaPlannedAntenna, string> _aimLabel;

        /// <param name="nodeId">The craft this model answers for, as <c>"vessel:&lt;guid&gt;"</c>.</param>
        /// <param name="antennas">The craft's antennas as captured.</param>
        /// <param name="antennasOf">Any node's captured antennas by id, or null for a node the capture did not see.</param>
        /// <param name="allowed">Whether a node may turn a dish on its own, read when asked so an opt-out takes effect at once.</param>
        /// <param name="aimLabel">What an antenna's aim is called, in words.</param>
        public RaRetargetModel(
            string nodeId,
            IReadOnlyList<RaPlannedAntenna> antennas,
            Func<string, IReadOnlyList<RaPlannedAntenna>?> antennasOf,
            Func<string, bool> allowed,
            Func<RaPlannedAntenna, string>? aimLabel = null)
        {
            _nodeId = nodeId ?? throw new ArgumentNullException(nameof(nodeId));
            _antennas = antennas ?? throw new ArgumentNullException(nameof(antennas));
            _antennasOf = antennasOf ?? throw new ArgumentNullException(nameof(antennasOf));
            _allowed = allowed ?? throw new ArgumentNullException(nameof(allowed));
            _aimLabel = aimLabel ?? DefaultLabel;
        }

        public bool AutoRetargetAllowed(string nodeId) =>
            string.Equals(nodeId, _nodeId, StringComparison.Ordinal) && _allowed(nodeId);

        public IReadOnlyList<DishAim> DishesOf(string nodeId)
        {
            if (!string.Equals(nodeId, _nodeId, StringComparison.Ordinal))
            {
                return new DishAim[0];
            }
            return _antennas
                .Where(a => a.Steerable && a.DishId != null)
                .Select(a => new DishAim(a.DishId!, _aimLabel(a)))
                .ToList();
        }

        /// <summary>
        /// The dish aimed exactly at the peer sees it dead centre, so the beam gives
        /// the full beamwidth of margin; what can still fail is the peer's own
        /// antenna not covering this craft, and the range once both ends' gains and
        /// the peer's pointing loss are paid. The best compatible peer antenna decides.
        /// </summary>
        public double MarginIfAimedAt(string dishId, string peerId, double ut, Sitrep.Contract.Vector3d dish, Sitrep.Contract.Vector3d peer, IContactPositions positions)
        {
            var mine = _antennas.FirstOrDefault(a => string.Equals(a.DishId, dishId, StringComparison.Ordinal));
            var theirs = _antennasOf(peerId);
            if (mine == null || !mine.Steerable || mine.BeamwidthRadians == null || theirs == null || theirs.Count == 0)
            {
                return RaContactLinkModel.NoPairing;
            }
            var best = double.NegativeInfinity;
            foreach (var b in theirs)
            {
                if (!RaContactLinkModel.Compatible(mine, b))
                {
                    continue;
                }
                var angleB = RaContactLinkModel.OffAxis(b, peer, dish, ut, positions);
                var margin = Math.Min(
                    Math.Min(mine.BeamwidthRadians.Value, RaContactLinkModel.Cliff(b, angleB)),
                    RaContactLinkModel.RangeMargin(mine, b, (peer - dish).Magnitude(), 0.0, RaContactLinkModel.LossDb(b, angleB)));
                if (margin > best)
                {
                    best = margin;
                }
            }
            if (double.IsNegativeInfinity(best))
            {
                return RaContactLinkModel.NoPairing;
            }
            return double.IsPositiveInfinity(best) ? 1.0 : best;
        }

        /// <summary>
        /// Whether this craft, as the peer, has an antenna whose beam already covers
        /// the node: an omni always does, a dish only when its aim places the node
        /// inside its cone. Asked of the peer's own model.
        /// </summary>
        public double PeerReceiveMargin(string peerId, string nodeId, double ut, Sitrep.Contract.Vector3d peer, Sitrep.Contract.Vector3d node, IContactPositions positions)
        {
            if (!string.Equals(peerId, _nodeId, StringComparison.Ordinal))
            {
                return RaContactLinkModel.NoPairing;
            }
            var best = RaContactLinkModel.NoPairing;
            foreach (var b in _antennas)
            {
                var cliff = RaContactLinkModel.Cliff(b, RaContactLinkModel.OffAxis(b, peer, node, ut, positions));
                var margin = double.IsPositiveInfinity(cliff) ? 1.0 : cliff;
                if (margin > best)
                {
                    best = margin;
                }
            }
            return best;
        }

        private static string DefaultLabel(RaPlannedAntenna antenna) => antenna.AimLabel ?? antenna.Aim switch
        {
            RaAimKind.Vessel => antenna.AimNodeId ?? "a craft",
            RaAimKind.BodyCentre => antenna.AimBodyIndex == null ? "a body" : "body " + antenna.AimBodyIndex.Value,
            _ => "no target",
        };
    }
}
