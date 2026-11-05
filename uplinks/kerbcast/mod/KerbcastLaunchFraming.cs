using System;

namespace Gonogo.KerbcastUplink
{
    /// <summary>
    /// How much wider than the craft a launchpad camera frames it while a countdown to
    /// liftoff runs. It is nothing until a countdown starts, grows over the countdown to
    /// <see cref="WidestRadiusM"/> at T-0, holds there while the craft is still on the
    /// ground, and eases back to nothing once the craft is known to be off it, or at
    /// once if the countdown is called off. Whenever the camera reports its view blocked,
    /// whether or not a countdown is running, the radius is further widened by the
    /// occlusion extra (see <see cref="OcclusionExtraM"/>), on the same easing and over
    /// the same time, and eased back when the view clears.
    /// </summary>
    internal sealed class KerbcastLaunchFraming
    {
        /// <summary>The widest extra radius, metres: where a craft climbing at 20 m/s² for the 2.5 s a record can be old at ignition ends up.</summary>
        internal const double WidestRadiusM = 62.5;

        /// <summary>
        /// The least further radius, metres, added while the launchpad camera's view is blocked: one
        /// more widest step, so on the pad the whole allowance covers a record about 3.5 s old at
        /// ignition rather than 2.5 s. It is built from <see cref="WidestRadiusM"/> so the two move together.
        /// </summary>
        internal const double OcclusionExtraRadiusM = WidestRadiusM;

        /// <summary>
        /// The further radius as a fraction of the craft's range from the camera. The view's half-extent
        /// is 3.333 times the radius framed, so one 128th of the range frames about 3 degrees across, three
        /// times the camera's 1 degree floor, which is the narrowest it frames a craft far downrange.
        /// </summary>
        internal const double OcclusionRangeFraction = 1.0 / 128.0;

        /// <summary>The further radius at a range, metres: the larger of <see cref="OcclusionExtraRadiusM"/> and the range fraction.</summary>
        internal static double OcclusionExtraM(double rangeM) =>
            Math.Max(OcclusionExtraRadiusM, double.IsNaN(rangeM) || rangeM < 0.0 ? 0.0 : rangeM * OcclusionRangeFraction);

        /// <summary>Seconds the radius takes to fall back to nothing after liftoff or a called-off countdown.</summary>
        internal const double EaseBackSeconds = 3.0;

        /// <summary>Seconds past T-0 the radius stays wide for a craft that is still on the ground, before it eases back.</summary>
        internal const double HoldSeconds = 20.0;

        private enum Phase
        {
            Idle,
            Counting,
            Holding,
            Easing,
        }

        private readonly object _gate = new object();
        private Phase _phase = Phase.Idle;
        private bool _pending;
        private bool _pendingCancel;
        private double _pendingRemaining;
        private double _pendingLength;
        private double _length;
        private double _reachesZeroAt;
        private double _easeFrom;
        private double _easeStartedAt;
        private double _holdStartedAt;
        private double _weightFrom;
        private double _weightTo;
        private double _weightStartedAt;
        private double _weightNow;
        private double _extraSizeM = OcclusionExtraRadiusM;

        /// <summary>Whether the radius is moving or held wide, so the model keeps republishing it.</summary>
        public bool Active
        {
            get
            {
                lock (_gate)
                {
                    return _phase != Phase.Idle || _pending || _weightNow > 0.0;
                }
            }
        }

        /// <summary>Any thread: a countdown of <paramref name="lengthSeconds"/> has <paramref name="remainingSeconds"/> left.</summary>
        public void Start(double remainingSeconds, double lengthSeconds)
        {
            lock (_gate)
            {
                _pending = true;
                _pendingCancel = false;
                _pendingRemaining = remainingSeconds;
                _pendingLength = lengthSeconds;
            }
        }

        /// <summary>Any thread: the countdown was called off.</summary>
        public void Cancel()
        {
            lock (_gate)
            {
                _pending = false;
                _pendingCancel = true;
            }
        }

        /// <summary>
        /// Main thread: the extra radius for the active craft now.
        /// </summary>
        /// <param name="realSeconds">A monotonic real-time clock in seconds.</param>
        /// <param name="onGround">Whether the craft's last known place is on the ground.</param>
        /// <param name="occluded">Whether the launchpad camera reports its view blocked.</param>
        /// <param name="rangeM">The craft's range from that camera in metres, NaN or negative when unknown.</param>
        public double RadiusM(double realSeconds, bool onGround, bool occluded = false, double rangeM = double.NaN)
        {
            lock (_gate)
            {
                var radius = Base(realSeconds, onGround);
                if (occluded)
                {
                    _extraSizeM = OcclusionExtraM(rangeM);
                }
                return radius + Weight(realSeconds, occluded ? 1.0 : 0.0) * _extraSizeM;
            }
        }

        /*
         * How much of the occlusion extra applies, from 0 to 1. It eases toward its target on
         * the curve and over the time the rest of the framing uses, from wherever it had got,
         * so a view that flickers at an edge turns the radius around smoothly rather than
         * snapping it. The size is kept apart from the weight, so a range that changes every
         * tick moves the extra without restarting the ease.
         */
        private double Weight(double realSeconds, double target)
        {
            if (target != _weightTo)
            {
                _weightFrom = _weightNow;
                _weightTo = target;
                _weightStartedAt = realSeconds;
            }
            var done = (realSeconds - _weightStartedAt) / EaseBackSeconds;
            _weightNow = done >= 1.0 ? _weightTo : _weightFrom + (_weightTo - _weightFrom) * Ease(done);
            return _weightNow;
        }

        private double Base(double realSeconds, bool onGround)
        {
            Take(realSeconds);
            switch (_phase)
            {
                case Phase.Counting:
                    if (realSeconds >= _reachesZeroAt)
                    {
                        _phase = Phase.Holding;
                        _holdStartedAt = _reachesZeroAt;
                        return Held(realSeconds, onGround);
                    }
                    return Widened(Progress(realSeconds));
                case Phase.Holding:
                    return Held(realSeconds, onGround);
                case Phase.Easing:
                    return Eased(realSeconds);
                default:
                    return 0.0;
            }
        }

        private double Held(double realSeconds, bool onGround)
        {
            if (!onGround || realSeconds - _holdStartedAt >= HoldSeconds)
            {
                BeginEase(realSeconds, WidestRadiusM);
                return WidestRadiusM;
            }
            return WidestRadiusM;
        }

        private void Take(double realSeconds)
        {
            if (_pendingCancel)
            {
                _pendingCancel = false;
                if (_phase != Phase.Idle && _phase != Phase.Easing)
                {
                    BeginEase(realSeconds, CurrentRadius(realSeconds));
                }
            }
            if (!_pending)
            {
                return;
            }
            _pending = false;
            var length = Math.Max(_pendingLength, 0.001);
            var remaining = Math.Max(0.0, Math.Min(_pendingRemaining, length));
            _length = length;
            _reachesZeroAt = realSeconds + remaining;
            _phase = remaining > 0.0 ? Phase.Counting : Phase.Holding;
            _holdStartedAt = realSeconds;
        }

        private double CurrentRadius(double realSeconds)
        {
            switch (_phase)
            {
                case Phase.Counting:
                    return Widened(Progress(realSeconds));
                case Phase.Holding:
                    return WidestRadiusM;
                case Phase.Easing:
                    return Eased(realSeconds);
                default:
                    return 0.0;
            }
        }

        private void BeginEase(double realSeconds, double from)
        {
            _phase = Phase.Easing;
            _easeFrom = from;
            _easeStartedAt = realSeconds;
        }

        private double Eased(double realSeconds)
        {
            var done = (realSeconds - _easeStartedAt) / EaseBackSeconds;
            if (done >= 1.0)
            {
                _phase = Phase.Idle;
                return 0.0;
            }
            return _easeFrom * (1.0 - Ease(done));
        }

        /// <summary>The radius of a craft's nominal size, metres, that the widening is measured against.</summary>
        internal const double NominalCraftRadiusM = 10.0;

        /// <summary>The fraction of the countdown at which the camera has finished widening; it holds the full width for the rest.</summary>
        internal const double WidenedByFraction = 0.95;

        /*
         * The extra radius at a progress through the countdown. What the operator sees
         * is the craft shrink, in proportion to one over the radius being framed, so the
         * widening is eased in that apparent size and not in metres: metres would put
         * most of the visible change in the first part of the countdown. The apparent
         * size follows smoothstep to its smallest at WidenedByFraction of the countdown,
         * with no change in speed at either end, and stays there.
         */
        internal static double Widened(double progress)
        {
            var q = Math.Max(0.0, Math.Min(1.0, progress / WidenedByFraction));
            var eased = q * q * (3.0 - 2.0 * q);
            var largest = 1.0 / NominalCraftRadiusM;
            var smallest = 1.0 / (NominalCraftRadiusM + WidestRadiusM);
            return 1.0 / (largest + (smallest - largest) * eased) - NominalCraftRadiusM;
        }

        private double Progress(double realSeconds) => Math.Max(0.0, Math.Min(1.0, 1.0 - (_reachesZeroAt - realSeconds) / _length));

        /*
         * The curve both moves follow, from 0 to 1 over a progress of 0 to 1. It has no
         * change in speed at either end, and it spends longer settling than starting: the
         * progress is warped so the fastest part falls before the middle, then run through
         * smoothstep.
         */
        internal static double Ease(double progress)
        {
            var p = Math.Max(0.0, Math.Min(1.0, progress));
            var warped = 1.0 - Math.Pow(1.0 - p, 1.5);
            return warped * warped * (3.0 - 2.0 * warped);
        }
    }
}
