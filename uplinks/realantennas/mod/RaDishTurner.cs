using System;
using System.Collections.Generic;
using System.Globalization;
using CommNet;

namespace Gonogo.RealAntennasUplink
{
    /// <summary>
    /// Turns another craft's idle dish to a peer and puts it back: the game-touching
    /// half of a dish turn. MAIN THREAD ONLY, as every write to an antenna is.
    ///
    /// <para><b>Any craft, loaded or on rails.</b> The dish is found by the craft's
    /// id and the part's persistent id and ordinal (see <see cref="RaDishIds"/>),
    /// read off a loaded part or off the saved snapshot alike, and the aim is
    /// written through the same ungated path whether the craft is loaded or not.
    /// A write to an unloaded craft's antenna lands in its saved part and the live
    /// link follows within one network refresh (measured at 1x and at about 1000x),
    /// so a turn on rails does what a turn on a loaded craft does.</para>
    ///
    /// <para><b>The record comes first.</b> What the dish was aimed at is saved in
    /// the register before anything is written, so a game that quits between the
    /// turn and the restore finds the loan on the next load. <see cref="Evaluate"/>
    /// puts back any dish that has been borrowed longer than a turn ever lasts, so
    /// no loan, however it was lost track of, keeps a relay's main dish pointed at a
    /// peer.</para>
    ///
    /// <para><b>Restore writes only to a dish still aimed where the turn put it.</b>
    /// If the operator aimed it meanwhile, their aim stands and nothing is written.
    /// It goes through its own ungated path, because the operator-facing one
    /// re-runs tech gates and a target lookup either of which can refuse, and a
    /// restore that can be refused can strand the dish.</para>
    /// </summary>
    internal sealed class RaDishTurner
    {
        /// <summary>The longest a dish may stay on loan before the Uplink puts it back on its own, whatever the network thinks. Well past any turn's cap.</summary>
        internal const double OrphanSeconds = 600.0;

        private readonly RaReflection _ra;
        private readonly RaTargeting _targeting;
        private readonly RaRetargetRegister _register;
        private readonly RaChainRegister _chains;

        internal RaDishTurner(RaReflection ra, RaTargeting targeting, RaRetargetRegister register, RaChainRegister chains)
        {
            _ra = ra;
            _targeting = targeting;
            _register = register;
            _chains = chains;
        }

        /// <summary>
        /// Aims <paramref name="dishId"/> at <paramref name="peerId"/> and returns the
        /// restore record's id, or null when the dish would not turn: it is not found,
        /// not steerable, already on loan, holds no target to come back to, or the peer
        /// cannot be aimed at.
        /// </summary>
        internal string? Turn(string nodeId, string dishId, string peerId, double ut)
        {
            var site = Find(dishId);
            if (site == null || _ra.Steerable(site.Value.Antenna) != true || _register.OpenOn(dishId) != null)
            {
                return null;
            }
            var previous = _targeting.DescribeStep(site.Value.Antenna);
            var borrowed = AimAt(peerId);
            if (previous == null || borrowed == null)
            {
                return null;
            }
            var loan = _register.Begin(dishId, peerId, previous, _targeting.AimLabel(site.Value.Antenna), ut, _ra.AntennaName(site.Value.Antenna) ?? "");
            if (loan == null)
            {
                return null;
            }
            var refused = _targeting.WriteStep(site.Value.Vessel, site.Value.Antenna, borrowed);
            if (refused != null)
            {
                _register.Settle(loan.Id, RaBorrowOutcome.Gone, ut);
                return null;
            }
            return loan.Id;
        }

        /// <summary>
        /// Puts a loan's dish back. True once the loan is settled: restored, taken
        /// by the operator, or gone with its craft. False only when the write itself
        /// failed, so it is tried again.
        /// </summary>
        internal bool Restore(string recordId, double ut)
        {
            var loan = _register.Find(recordId);
            if (loan == null || !loan.IsOpen)
            {
                return true;
            }
            var site = Find(loan.DishId);
            if (site == null)
            {
                _register.Settle(loan.Id, RaBorrowOutcome.Gone, ut);
                return true;
            }
            var now = _targeting.DescribeStep(site.Value.Antenna);
            var borrowed = AimAt(loan.PeerId);
            if (now == null || borrowed == null || !SameAim(now, borrowed))
            {
                _register.Settle(loan.Id, RaBorrowOutcome.Taken, ut);
                return true;
            }
            if (_targeting.WriteStep(site.Value.Vessel, site.Value.Antenna, loan.Previous) != null)
            {
                return false;
            }
            _register.Settle(loan.Id, RaBorrowOutcome.Restored, ut);
            EndLease(site.Value.Part, site.Value.Ordinal, ut);
            return true;
        }

        /// <summary>
        /// MAIN THREAD, every tick: puts back any dish borrowed longer than a turn
        /// lasts. A loan survives a quit, a rewind or a network event that was lost,
        /// and this is what stops any of them leaving a dish on a borrowed aim.
        /// </summary>
        internal void Evaluate(double ut)
        {
            foreach (var loan in new List<RaRetargetRegister.Borrow>(_register.Open))
            {
                if (ut - loan.TurnedUt > OrphanSeconds || ut < loan.TurnedUt)
                {
                    try
                    {
                        Restore(loan.Id, ut);
                    }
                    catch (Exception ex)
                    {
                        UnityEngine.Debug.LogError("[GonogoRealAntennasUplink] could not put back dish " + loan.DishId + ": " + ex);
                    }
                }
            }
        }

        /// <summary>A chain that was held while its dish was lent gets its full settle time before it walks on.</summary>
        private void EndLease(uint part, int ordinal, double ut)
        {
            foreach (var entry in _chains.Entries)
            {
                if (RaChainKey.IsStable(entry.Key) && RaChainKey.PartAndOrdinal(entry.Key) == (part, ordinal))
                {
                    entry.Value.Walk.LastAppliedUt = ut;
                }
            }
        }

        private struct Site
        {
            public Vessel Vessel;
            public object Antenna;
            public uint Part;
            public int Ordinal;
        }

        /// <summary>The dish a plan id names, on the craft that carries it now.</summary>
        private Site? Find(string dishId)
        {
            if (!RaDishIds.TryParse(dishId, out var nodeId, out var part, out var ordinal))
            {
                return null;
            }
            var guid = RaDishIds.VesselGuid(nodeId);
            var vessels = FlightGlobals.Vessels;
            if (guid == null || vessels == null)
            {
                return null;
            }
            foreach (var vessel in vessels)
            {
                if (vessel == null || !string.Equals(vessel.id.ToString(), guid, StringComparison.OrdinalIgnoreCase))
                {
                    continue;
                }
                var antennas = _targeting.Antennas(vessel);
                var ids = RaPartIds.Of(_ra, vessel, antennas);
                for (var i = 0; i < antennas.Count; i++)
                {
                    if (ids[i] != null && ids[i]!.Value.Part == part && ids[i]!.Value.Ordinal == ordinal)
                    {
                        return new Site { Vessel = vessel, Antenna = antennas[i], Part = part, Ordinal = ordinal };
                    }
                }
            }
            return null;
        }

        /// <summary>
        /// What aiming at <paramref name="peerId"/> means: a craft is aimed at by id, a
        /// ground station by the point on its body it stands at. Null for a node that
        /// cannot be aimed at.
        /// </summary>
        private RealAntennasTargetStepArgs? AimAt(string peerId)
        {
            var guid = RaDishIds.VesselGuid(peerId);
            if (guid != null)
            {
                return new RealAntennasTargetStepArgs { Mode = RaTargetPlan.ModeVessel, VesselId = guid };
            }
            if (!peerId.StartsWith("ground:", StringComparison.Ordinal))
            {
                return null;
            }
            var name = peerId.Substring("ground:".Length);
            var network = CommNetNetwork.Instance?.CommNet;
            if (network == null)
            {
                return null;
            }
            for (var i = 0; i < network.Count; i++)
            {
                var node = network[i];
                if (node == null || !node.isHome || !string.Equals(node.displayName, name, StringComparison.Ordinal))
                {
                    continue;
                }
                var body = BodyOfHome(node);
                if (body == null)
                {
                    return null;
                }
                var position = node.precisePosition;
                return new RealAntennasTargetStepArgs
                {
                    Mode = RaTargetPlan.ModeBodyLatLonAlt,
                    BodyName = body.name,
                    Latitude = body.GetLatitude(position),
                    Longitude = Normalised(body.GetLongitude(position)),
                    Altitude = body.GetAltitude(position),
                };
            }
            return null;
        }

        /// <summary>The body a ground station stands on: the one whose surface it is closest to, since a CommNet home node names none.</summary>
        private static CelestialBody? BodyOfHome(CommNode node)
        {
            CelestialBody? nearest = null;
            var best = double.MaxValue;
            foreach (var body in FlightGlobals.Bodies)
            {
                if (body == null)
                {
                    continue;
                }
                var gap = Math.Abs((node.precisePosition - body.position).magnitude - body.Radius);
                if (gap < best)
                {
                    best = gap;
                    nearest = body;
                }
            }
            return nearest;
        }

        private static double Normalised(double longitude) => longitude < -180.0 ? longitude + 360.0 : longitude > 180.0 ? longitude - 360.0 : longitude;

        /// <summary>Whether two aims are the same place, to the precision a target is saved at.</summary>
        internal static bool SameAim(RealAntennasTargetStepArgs a, RealAntennasTargetStepArgs b)
        {
            if (!string.Equals(a.Mode, b.Mode, StringComparison.Ordinal))
            {
                return false;
            }
            if (a.Mode == RaTargetPlan.ModeVessel)
            {
                return string.Equals(a.VesselId, b.VesselId, StringComparison.OrdinalIgnoreCase);
            }
            return Close(a.Latitude, b.Latitude) && Close(a.Longitude, b.Longitude) && Close(a.Altitude, b.Altitude)
                && string.Equals(a.BodyName, b.BodyName, StringComparison.Ordinal);
        }

        private static bool Close(double? a, double? b) =>
            a != null && b != null && Math.Abs(a.Value - b.Value) <= 1e-3 * Math.Max(1.0, Math.Abs(b.Value));
    }
}
