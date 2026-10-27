using System;
using Kerbcast.Api;

namespace Gonogo.KerbcastUplink
{
    /// <summary>What <see cref="KerbcastAuthority"/> holds after a tick.</summary>
    public enum AuthorityState
    {
        /// <summary>No Kerbcast in this scene.</summary>
        Absent,

        /// <summary>This Kerbcast cannot take a lock with a world model, so its feeds follow the game as it is.</summary>
        Unsupported,

        /// <summary>Signal delay is off, so there is nothing to govern and no lock is held.</summary>
        DelayOff,

        /// <summary>Gonogo holds the lock and has a world model publisher.</summary>
        Governing,

        /// <summary>Another mod holds the lock.</summary>
        HeldByOther,
    }

    /// <summary>
    /// Holds Kerbcast's command lock for Gonogo while signal delay is on, so every
    /// command feed shows only what its site could know. Main thread only, driven
    /// once per capture tick.
    ///
    /// <para>The lock is taken with <see cref="LockOptions.WorldModelRequired"/>
    /// and only where Kerbcast supports both the lock and the world model: a lock
    /// with no world model behind it would leave feeds aimed by the game's truth.
    /// With delay off no lock is held and Kerbcast behaves as it does without
    /// Gonogo. Each owner call is a heartbeat; Kerbcast blanks governed feeds
    /// after five real seconds without one.</para>
    /// </summary>
    public sealed class KerbcastAuthority
    {
        /// <summary>The owner name the lock, the reservation and every aim carry.</summary>
        public const string Owner = "gonogo";

        /// <summary>Real seconds between heartbeats: well inside Kerbcast's five-second silence rule.</summary>
        public const double HeartbeatSeconds = 1.0;

        private readonly Func<IKerbcast?> _kerbcast;
        private readonly Func<ApiFeature, bool> _supports;
        private readonly string _ownerAssembly = typeof(KerbcastAuthority).Assembly.GetName().Name;
        private bool _holds;
        private bool _reserved;
        private bool _reserveRefused;
        private double? _lastBeat;
        private double? _speedSent;
        private bool _speedKnown;

        /// <param name="kerbcast">Kerbcast in this scene, normally <see cref="KerbcastApi.Instance"/>.</param>
        /// <param name="supports">Which API features this Kerbcast implements, normally <see cref="KerbcastApi.Supports"/>.</param>
        public KerbcastAuthority(Func<IKerbcast?> kerbcast, Func<ApiFeature, bool> supports)
        {
            _kerbcast = kerbcast;
            _supports = supports;
        }

        public AuthorityState State { get; private set; } = AuthorityState.Absent;

        /// <summary>The publisher for this lock tenure, null unless <see cref="State"/> is <see cref="AuthorityState.Governing"/>.</summary>
        public IWorldModelPublisher? Publisher { get; private set; }

        /// <summary>Counts lock tenures, rising each time the lock is newly taken, so a caller can tell a fresh tenure from a continuing one.</summary>
        public int Tenure { get; private set; }

        /// <param name="realSeconds">A monotonic real-time clock in seconds.</param>
        /// <param name="signalSpeed">The speed signals travel at, in metres per second; null when signal delay is off.</param>
        public AuthorityState Tick(double realSeconds, double? signalSpeed)
        {
            var kerbcast = _kerbcast();
            if (kerbcast == null)
            {
                Forget();
                return State = AuthorityState.Absent;
            }
            if (!_supports(ApiFeature.CommandLock) || !_supports(ApiFeature.WorldModel))
            {
                Forget();
                return State = AuthorityState.Unsupported;
            }

            var command = kerbcast.Command;
            if (signalSpeed == null)
            {
                if (_holds)
                {
                    command.ReleaseLock(Owner);
                }
                if (_reserved)
                {
                    command.ClearReservation(Owner);
                    _reserved = false;
                }
                Forget();
                return State = AuthorityState.DelayOff;
            }

            var tenureLost = _holds && (Publisher == null || !Publisher.Attached);
            var speedDue = _supports(ApiFeature.SignalSpeed) && (!_speedKnown || !Nullable.Equals(_speedSent, signalSpeed));
            if (_holds && !tenureLost && !speedDue && _lastBeat.HasValue && realSeconds - _lastBeat.Value < HeartbeatSeconds)
            {
                return State;
            }

            var result = command.TakeLock(Owner, LockOptions.WorldModelRequired);
            _lastBeat = realSeconds;
            if (result == LockResult.HeldByOther)
            {
                Forget();
                return State = AuthorityState.HeldByOther;
            }

            if (result == LockResult.Taken || tenureLost || !_holds)
            {
                Publisher?.Dispose();
                Publisher = command.AttachWorldModel(Owner);
                _speedKnown = false;
                _reserveRefused = false;
                Tenure++;
            }
            _holds = true;

            if (!_reserved && !_reserveRefused)
            {
                Reserve(command);
            }

            if (Publisher == null)
            {
                command.ReleaseLock(Owner);
                Forget();
                return State = AuthorityState.Unsupported;
            }

            if (_supports(ApiFeature.SignalSpeed) && (!_speedKnown || !Nullable.Equals(_speedSent, signalSpeed))
                && command.SetSignalSpeed(Owner, signalSpeed))
            {
                _speedSent = signalSpeed;
                _speedKnown = true;
            }

            return State = AuthorityState.Governing;
        }

        /*
         * Kerbcast names the reservation after the assembly that calls it, and refuses
         * one while another mod holds it. A refusal is not retried until the next
         * tenure: the lock itself still governs this scene.
         */
        private void Reserve(ICommand command)
        {
            try
            {
                command.Reserve(Owner, _ownerAssembly);
                _reserved = true;
            }
            catch (Exception e) when (e is ArgumentException || e is InvalidOperationException)
            {
                _reserveRefused = true;
            }
        }

        private void Forget()
        {
            Publisher?.Dispose();
            Publisher = null;
            _holds = false;
            _lastBeat = null;
            _speedKnown = false;
            _speedSent = null;
        }
    }
}
