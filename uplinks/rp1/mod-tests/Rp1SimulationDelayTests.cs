using System;
using System.Collections.Generic;
using Xunit;

namespace GonogoRp1Uplink.Tests
{
    public class Rp1SimulationDelayTests
    {
        private sealed class Handle : IDisposable
        {
            public int Disposals;
            public void Dispose() => Disposals++;
        }

        private readonly List<(double Factor, string Reason, Handle Handle)> _registered =
            new List<(double, string, Handle)>();

        private Rp1SimulationDelay New() => new Rp1SimulationDelay((factor, reason) =>
        {
            var handle = new Handle();
            _registered.Add((factor, reason, handle));
            return handle;
        });

        [Fact]
        public void A_simulation_switches_delay_off_once_for_as_long_as_it_lasts()
        {
            var delay = New();

            delay.Observe(true, false);
            delay.Observe(true, false);

            var only = Assert.Single(_registered);
            Assert.Equal(0.0, only.Factor);
            Assert.Equal(Rp1SimulationDelay.Reason, only.Reason);
            Assert.True(delay.Holding);
            Assert.Equal(0, only.Handle.Disposals);
        }

        [Fact]
        public void The_end_of_a_simulation_gives_the_delay_back()
        {
            var delay = New();
            delay.Observe(true, false);

            delay.Observe(false, false);
            delay.Observe(false, false);

            Assert.Equal(1, _registered[0].Handle.Disposals);
            Assert.False(delay.Holding);
        }

        /// <summary>
        /// A flight RP-1 cannot classify is treated as real: switching delay off
        /// on no evidence would land every command at once on a mission.
        /// </summary>
        [Fact]
        public void An_unclassified_flight_keeps_its_delay()
        {
            var delay = New();

            delay.Observe(null, false);
            Assert.Empty(_registered);

            delay.Observe(true, false);
            delay.Observe(null, false);
            Assert.Equal(1, _registered[0].Handle.Disposals);
        }

        /// <summary>
        /// An operator rehearsing the delayed procedure asked for delay in
        /// simulations, so a simulation never takes the modifier.
        /// </summary>
        [Fact]
        public void The_setting_keeps_delay_on_through_a_simulation()
        {
            var delay = New();

            delay.Observe(true, true);

            Assert.Empty(_registered);
            Assert.False(delay.Holding);
        }

        /// <summary>
        /// Turning the setting on mid-simulation gives the delay back on that tick,
        /// and turning it off again takes a fresh modifier.
        /// </summary>
        [Fact]
        public void The_setting_changing_mid_simulation_releases_and_retakes_the_modifier()
        {
            var delay = New();
            delay.Observe(true, false);

            delay.Observe(true, true);
            Assert.Equal(1, _registered[0].Handle.Disposals);
            Assert.False(delay.Holding);

            delay.Observe(true, false);
            Assert.Equal(2, _registered.Count);
            Assert.True(delay.Holding);
        }

        [Fact]
        public void A_second_simulation_takes_a_fresh_modifier()
        {
            var delay = New();

            delay.Observe(true, false);
            delay.Observe(false, false);
            delay.Observe(true, false);

            Assert.Equal(2, _registered.Count);
            Assert.Equal(0, _registered[1].Handle.Disposals);
        }
    }
}
