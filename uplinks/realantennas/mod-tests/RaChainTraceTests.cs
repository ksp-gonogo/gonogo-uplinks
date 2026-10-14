using Gonogo.RealAntennasUplink;
using Xunit;

namespace GonogoRealAntennasUplink.Tests
{
    /// <summary>
    /// The walk's log line for a craft the channel does not describe. An unloaded
    /// craft's chain is not on the wire, so the log is the only place its link
    /// reading and its decision can be seen, and it must say each change once.
    /// </summary>
    public class RaChainTraceTests
    {
        [Fact]
        public void ACraftIsDescribedOnItsFirstTickAndAgainOnlyWhenSomethingChanges()
        {
            var trace = new RaChainTrace();

            Assert.NotNull(trace.Note("1/0", false, true, RaChainPolicy.Move.Hold, 0));
            Assert.Null(trace.Note("1/0", false, true, RaChainPolicy.Move.Hold, 0));
            Assert.NotNull(trace.Note("1/0", false, false, RaChainPolicy.Move.Settle, 0));
            Assert.NotNull(trace.Note("1/0", false, false, RaChainPolicy.Move.Apply, 1));
        }

        [Fact]
        public void TheLineNamesTheLoadStateAndTheLinkReading()
        {
            var line = new RaChainTrace().Note("1/0", false, null, RaChainPolicy.Move.Hold, 0)!;

            Assert.Contains("unloaded", line);
            Assert.Contains("link unreadable", line);
        }

        [Fact]
        public void EachChainIsTrackedSeparately()
        {
            var trace = new RaChainTrace();
            trace.Note("1/0", true, true, RaChainPolicy.Move.Hold, 0);

            Assert.NotNull(trace.Note("2/0", true, true, RaChainPolicy.Move.Hold, 0));
        }

        [Fact]
        public void AHeldChainOnAConnectedCraftLeavesATraceEntry()
        {
            var trace = new RaChainTrace();
            var walk = new RaChainPolicy.Walk { Laps = 2 };

            var decision = RaChainPolicy.Advance(walk, 3, true, 100.0, 30.0);
            var line = trace.Note("1/0", true, true, decision.Move, decision.Step);

            Assert.Equal(0, walk.Laps);
            Assert.NotNull(line);
            Assert.Contains("linked", line);
            Assert.Contains("hold", line);
        }

        [Fact]
        public void AnApplyTheAntennaCannotCarryOutSaysItWasHeld()
        {
            var line = new RaChainTrace().Note("1/0", true, false, RaChainPolicy.Move.Apply, 0, true)!;

            Assert.Contains("cannot be aimed", line);
        }
    }
}
