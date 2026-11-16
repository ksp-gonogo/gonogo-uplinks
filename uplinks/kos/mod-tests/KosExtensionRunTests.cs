using System.Collections.Generic;
using Gonogo.KosUplink;
using Xunit;

namespace GonogoKosUplink.Tests
{
    /// <summary>
    /// The KSP-free half of a <c>kos.run</c> as <see cref="KosExtension"/> drives
    /// it: a script handing its result back, the idle backstop, and a load
    /// disarming everything. The KSP-touching start is covered on a live game.
    /// </summary>
    public class KosExtensionRunTests
    {
        private static (KosExtension ext, List<(int coreId, KosRunResult result)> results) NewExtension()
        {
            var ext = new KosExtension(new MainThreadDispatcher(), _ => { });
            var results = new List<(int coreId, KosRunResult result)>();
            ext.WireRunForTests((coreId, result) => results.Add((coreId, result)));
            return (ext, results);
        }

        [Fact]
        public void OnScriptReturn_ArmedRun_EndsItWithTheReturnedFields()
        {
            var (ext, results) = NewExtension();
            Assert.True(ext.ArmRunForTests(42, "req-1"));

            Assert.True(ext.OnScriptReturn(42, new Dictionary<string, object?> { ["dv"] = 1200.0, ["ok"] = true }));

            var (coreId, result) = Assert.Single(results);
            Assert.Equal(42, coreId);
            Assert.Equal("req-1", result.RequestId);
            Assert.Equal(1200.0, result.Fields!["dv"]);
            Assert.Equal(true, result.Fields["ok"]);
            Assert.Null(result.Error);
            Assert.False(result.Ended);
        }

        [Fact]
        public void OnScriptReturn_NothingArmed_GoesNowhere()
        {
            var (ext, results) = NewExtension();

            Assert.False(ext.OnScriptReturn(42, new Dictionary<string, object?> { ["v"] = 1.0 }));

            Assert.Empty(results);
        }

        [Fact]
        public void OnScriptReturn_AfterTheRunEnded_DoesNotCompleteTheNextRequest()
        {
            var (ext, results) = NewExtension();
            ext.CpuIsIdle = _ => true;
            ext.ArmRunForTests(42, "req-1");
            for (var i = 0; i < KosRunManager.IdlePollsToEnd; i++)
            {
                ext.PollRuns();
            }
            results.Clear();

            Assert.False(ext.OnScriptReturn(42, new Dictionary<string, object?> { ["v"] = 1.0 }));

            Assert.Empty(results);
        }

        [Fact]
        public void PollRuns_RunThatReturnsNothing_EndsOnceTheCpuIsIdle()
        {
            var (ext, results) = NewExtension();
            ext.CpuIsIdle = _ => true;
            Assert.True(ext.ArmRunForTests(42, "req-1"));

            for (var i = 0; i < KosRunManager.IdlePollsToEnd; i++)
            {
                ext.PollRuns();
            }

            var (coreId, result) = Assert.Single(results);
            Assert.Equal(42, coreId);
            Assert.True(result.Ended);
            Assert.True(ext.ArmRunForTests(42, "req-2"));
        }

        [Fact]
        public void OnTimelineReset_DisarmsARunWhoseCpuWasDestroyed()
        {
            var (ext, _) = NewExtension();
            Assert.True(ext.ArmRunForTests(42, "req-1"));

            ext.OnTimelineReset(saveChanged: false);

            Assert.True(ext.ArmRunForTests(42, "req-2"));
        }
    }
}
