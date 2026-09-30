using System;

namespace GonogoRp1Uplink
{
    /// <summary>
    /// Switches signal delay off for the length of an RP-1 simulation, by holding
    /// a zero delay modifier for as long as RP-1 says the flight on screen is one
    /// and the operator has not asked for delay during simulations.
    ///
    /// <para>A rehearsal has no spacecraft, so by default it has no light-time,
    /// and modelling a distance to a craft that is not there would put a
    /// fictional delay on every command. An operator rehearsing the delayed
    /// procedure itself turns <c>delayInSimulation</c> on, and the modifier is
    /// never taken. A flight RP-1 cannot classify (<c>null</c>: RP-1 not live,
    /// or not enabled for this save) is treated as a real one, so delay stays on
    /// whenever the answer is anything but a positive yes.</para>
    ///
    /// <para>KSP-free: the host's registration is handed in, so the holding rule
    /// is testable without a game.</para>
    /// </summary>
    public sealed class Rp1SimulationDelay
    {
        /// <summary>The reason the modifier is logged under.</summary>
        public const string Reason = "RP-1 simulation";

        private readonly Func<double, string, IDisposable> _register;
        private IDisposable? _held;

        /// <param name="register">The host's <c>RegisterDelayModifier</c>.</param>
        public Rp1SimulationDelay(Func<double, string, IDisposable> register)
        {
            _register = register;
        }

        /// <summary>Whether delay is currently switched off by a simulation.</summary>
        public bool Holding => _held != null;

        /// <summary>
        /// Takes RP-1's latest answer and the operator's setting, and holds or
        /// releases the modifier to match. Called every main-thread tick; a tick
        /// whose inputs match the current state does nothing, and a tick where
        /// either one has changed releases the modifier on that tick.
        /// </summary>
        /// <param name="simulated">RP-1's answer: whether the flight on screen is a simulation, or null when it cannot say.</param>
        /// <param name="delayInSimulation">The operator's <c>delayInSimulation</c> setting.</param>
        public void Observe(bool? simulated, bool delayInSimulation)
        {
            if (simulated == true && !delayInSimulation)
            {
                _held ??= _register(0.0, Reason);
            }
            else if (_held != null)
            {
                _held.Dispose();
                _held = null;
            }
        }
    }
}
