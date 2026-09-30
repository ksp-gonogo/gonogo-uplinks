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

            delay.Observe(true);
            delay.Observe(true);

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
            delay.Observe(true);

            delay.Observe(false);
            delay.Observe(false);

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

            delay.Observe(null);
            Assert.Empty(_registered);

            delay.Observe(true);
            delay.Observe(null);
            Assert.Equal(1, _registered[0].Handle.Disposals);
        }

        [Fact]
        public void A_second_simulation_takes_a_fresh_modifier()
        {
            var delay = New();

            delay.Observe(true);
            delay.Observe(false);
            delay.Observe(true);

            Assert.Equal(2, _registered.Count);
            Assert.Equal(0, _registered[1].Handle.Disposals);
        }
    }
}
