// The KSP-free half of the avionics walk: what a vessel's per-part avionics
// readings reduce to. Carved out of AvionicsReflection so a headless test can
// enter it, the same discipline TestFlightRepairScope and
// KerbcastCameraEntryBuilder follow. AvionicsReflection takes a Vessel, so
// nothing in mod-tests could reach this arithmetic while it lived there, and
// the partial-sum defect below was invisible to every gate.
//
// The reduction mirrors RP0.ControlLockerUtils.ShouldLock: sum CurrentMassLimit
// per PART, then take the MAX across parts (a second smaller unit elsewhere
// does not add to the best part's rating).
using System;

namespace GonogoAvionicsUplink
{
    /// <summary>
    /// Accumulates one vessel's avionics readings, one module at a time, into
    /// the <see cref="AvionicsRaw"/> the wire carries. Feed every avionics
    /// module on a part through <see cref="AddModule"/>, call
    /// <see cref="EndPart"/> at the end of each part, then <see cref="Build"/>.
    ///
    /// <para><b>Every reading is three-valued and stays that way.</b> A member
    /// that did not bind, or a read that threw, arrives here as
    /// <c>null</c>, and folding one into a number or a bool is the whole class
    /// of defect this type exists to prevent: a mass limit that could not be
    /// read contributed zero to the sum and the vessel's total went out under a
    /// total's name, short. The widget then drew NO-GO in alert tone with
    /// "Controllable 0 t", off a limit nobody read.</para>
    /// </summary>
    public sealed class AvionicsFold
    {
        private double _partSum;
        private bool _partHasAvionics;

        private double? _maxAcrossParts;
        private bool _anyDefinitelyOn;
        private bool _anySwitchUnreadable;
        private bool _anyLimitUnreadable;

        /// <summary>
        /// One avionics module's two readings, both possibly unread.
        /// <paramref name="currentMassLimit"/> is RP-1's live
        /// <c>CurrentMassLimit</c> (already 0 for a dead / powered-off /
        /// tech-locked unit, which is a READING of zero and not an absence);
        /// <paramref name="systemEnabled"/> is its on/off switch.
        /// </summary>
        public void AddModule(double? currentMassLimit, bool? systemEnabled)
        {
            _partHasAvionics = true;

            if (currentMassLimit is double limit)
            {
                _partSum += limit;
            }
            else
            {
                _anyLimitUnreadable = true;
            }

            if (systemEnabled == true)
            {
                _anyDefinitelyOn = true;
            }
            else if (systemEnabled == null)
            {
                _anySwitchUnreadable = true;
            }
        }

        /// <summary>
        /// Closes the current part and folds its summed limit into the
        /// max-across-parts. Call it once per part walked, whether or not that
        /// part carried an avionics module: a part with none folds nothing.
        /// </summary>
        public void EndPart()
        {
            if (_partHasAvionics)
            {
                _maxAcrossParts = _maxAcrossParts == null
                    ? _partSum
                    : Math.Max(_maxAcrossParts.Value, _partSum);
            }
            _partSum = 0.0;
            _partHasAvionics = false;
        }

        /// <summary>
        /// The reduced reading, or <c>null</c> when no part carried an avionics
        /// module at all.
        /// </summary>
        public AvionicsRaw? Build()
        {
            if (_maxAcrossParts == null)
            {
                return null;
            }

            // A definite "on" anywhere settles the switch. Otherwise an
            // unreadable one leaves the answer unknown rather than off: this
            // vessel HAS avionics, so "off" would be a claim about the switch
            // and "no avionics" would be a claim about the hardware.
            bool? active = _anyDefinitelyOn ? true : _anySwitchUnreadable ? (bool?)null : false;

            // The same rule for the limit, and it is the one the max hides. The
            // maximum of a set holding an unknown is a LOWER BOUND, not the
            // maximum: an unreadable limit could have been the largest. So the
            // total is unknown, never the known part of it.
            double? controllableMassTons = _anyLimitUnreadable ? (double?)null : _maxAcrossParts.Value;

            return new AvionicsRaw
            {
                ControllableMassTons = controllableMassTons,
                AvionicsActive = active,
            };
        }
    }
}
