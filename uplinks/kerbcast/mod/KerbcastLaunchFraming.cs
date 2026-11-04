using System;

namespace Gonogo.KerbcastUplink
{
    /// <summary>
    /// How much wider than the craft a launchpad camera frames it while a countdown to
    /// liftoff runs. It is nothing until a countdown starts, grows over the countdown to
    /// <see cref="WidestRadiusM"/> at T-0, holds there while the craft is still on the
    /// ground, and eases back to nothing once the craft is known to be off it, or at
    /// once if the countdown is called off.
    /// </summary>
    internal sealed class KerbcastLaunchFraming
    {
        /// <summary>The widest extra radius, metres: where a craft climbing at 20 m/s² for the 2.5 s a record can be old at ignition ends up.</summary>
        internal const double WidestRadiusM = 62.5;

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

        /// <summary>Whether the radius is moving or held wide, so the model keeps republishing it.</summary>
        public bool Active
        {
            get
            {
                lock (_gate)
                {
                    return _phase != Phase.Idle || _pending;
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
        public double RadiusM(double realSeconds, bool onGround)
        {
            lock (_gate)
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
                        return WidestRadiusM * Ease(Progress(realSeconds));
                    case Phase.Holding:
                        return Held(realSeconds, onGround);
                    case Phase.Easing:
                        return Eased(realSeconds);
                    default:
                        return 0.0;
                }
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
                    return WidestRadiusM * Ease(Progress(realSeconds));
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
