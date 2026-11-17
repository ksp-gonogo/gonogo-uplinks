using System.Collections.Generic;
using Gonogo.KosUplink;
using Sitrep.Contract;
using Xunit;

namespace GonogoKosUplink.Tests
{
    /// <summary>
    /// <c>ADDONS:GONOGO:LOG</c> as <see cref="KosRunManager"/> sees it: entries
    /// tagged and counted per run, ordered with the run's result, and rate limited.
    /// </summary>
    public class KosRunLogTests
    {
        private sealed class Rig
        {
            public readonly KosRunManager Mgr = new KosRunManager();
            public readonly List<KosLogEntry> Logs = new List<KosLogEntry>();
            public readonly List<KosRunResult> Results = new List<KosRunResult>();
            public long Now;

            public Rig()
            {
                Mgr.SetLogPublisher((_, e) => Logs.Add(e));
                Mgr.SetPublisher((_, r) => Results.Add(r));
                Mgr.ClockMs = () => Now;
            }
        }

        [Fact]
        public void ALogEntry_CarriesTheArmedRequestAndCountsUpFromZero()
        {
            var rig = new Rig();
            rig.Mgr.TryArm(7, "req-1");

            Assert.True(rig.Mgr.Log(7, 1.0));
            Assert.True(rig.Mgr.Log(7, "two"));

            Assert.Equal(new[] { 0, 1 }, new[] { rig.Logs[0].Seq, rig.Logs[1].Seq });
            Assert.All(rig.Logs, e => Assert.Equal("req-1", e.RequestId));
            Assert.Equal("two", rig.Logs[1].Value);
            Assert.True(rig.Mgr.IsArmed(7));
        }

        [Fact]
        public void ALogEntryWithNoRunArmed_GoesNowhere()
        {
            var rig = new Rig();

            Assert.False(rig.Mgr.Log(7, 1.0));
            Assert.Empty(rig.Logs);
        }

        [Fact]
        public void TheResultReportsHowManyEntriesPrecededIt()
        {
            var rig = new Rig();
            rig.Mgr.TryArm(7, "req-1");
            rig.Mgr.Log(7, 1.0);
            rig.Mgr.Log(7, 2.0);

            rig.Mgr.Complete(7, new Dictionary<string, object?> { ["done"] = true });

            Assert.Equal(2, rig.Results[0].Logged);
            Assert.Equal(0, rig.Results[0].Dropped);
        }

        [Fact]
        public void AFailedAndAnEndedRun_ReportTheirEntriesToo()
        {
            var rig = new Rig();
            rig.Mgr.TryArm(7, "a");
            rig.Mgr.Log(7, 1.0);
            rig.Mgr.Fail(7, "boom");
            rig.Mgr.TryArm(8, "b");
            rig.Mgr.Log(8, 1.0);
            rig.Mgr.Log(8, 2.0);
            for (var i = 0; i < KosRunManager.IdlePollsToEnd; i++)
            {
                rig.Mgr.PollIdle(id => id == 8);
            }

            Assert.Equal(1, rig.Results[0].Logged);
            Assert.Equal(2, rig.Results[1].Logged);
            Assert.True(rig.Results[1].Ended);
        }

        [Fact]
        public void ANewRunStartsItsSequenceAtZeroAgain()
        {
            var rig = new Rig();
            rig.Mgr.TryArm(7, "a");
            rig.Mgr.Log(7, 1.0);
            rig.Mgr.Complete(7, new Dictionary<string, object?>());
            rig.Mgr.TryArm(7, "b");

            rig.Mgr.Log(7, 1.0);

            Assert.Equal(0, rig.Logs[1].Seq);
            Assert.Equal("b", rig.Logs[1].RequestId);
        }

        [Fact]
        public void ABurstPastTheLimit_IsDroppedAndCounted()
        {
            var rig = new Rig();
            rig.Mgr.TryArm(7, "a");

            var accepted = 0;
            for (var i = 0; i < KosRunManager.LogBurst + 5; i++)
            {
                if (rig.Mgr.Log(7, (double)i)) accepted++;
            }
            rig.Mgr.Complete(7, new Dictionary<string, object?>());

            Assert.Equal(KosRunManager.LogBurst, accepted);
            Assert.Equal(KosRunManager.LogBurst, rig.Results[0].Logged);
            Assert.Equal(5, rig.Results[0].Dropped);
        }

        [Fact]
        public void TheBucketRefillsAtTheSustainedRate()
        {
            var rig = new Rig();
            rig.Mgr.TryArm(7, "a");
            for (var i = 0; i < KosRunManager.LogBurst; i++) rig.Mgr.Log(7, 0.0);
            Assert.False(rig.Mgr.Log(7, 0.0));

            rig.Now += 1000;

            var accepted = 0;
            for (var i = 0; i < 15; i++)
            {
                if (rig.Mgr.Log(7, 0.0)) accepted++;
            }
            Assert.Equal((int)KosRunManager.LogPerSecond, accepted);
        }

        [Fact]
        public void ACancelledRunKeepsNoCountForTheNext()
        {
            var rig = new Rig();
            rig.Mgr.TryArm(7, "a");
            rig.Mgr.Log(7, 1.0);
            rig.Mgr.CancelRun(7, "a");
            rig.Mgr.TryArm(7, "b");

            rig.Mgr.Complete(7, new Dictionary<string, object?>());

            Assert.Equal(0, rig.Results[0].Logged);
        }

        [Fact]
        public void TheWireShapesCarryTheNewFields()
        {
            var result = KosRunResultBuilder.Build(7, "r", null, null, ended: true, logged: 3, dropped: 1);
            var log = KosRunResultBuilder.BuildLog(7, "r", 2, "v");

            Assert.Equal(3, result["logged"]);
            Assert.Equal(1, result["dropped"]);
            Assert.Equal(2, log["seq"]);
            Assert.Equal("v", log["value"]);
        }
    }
}
