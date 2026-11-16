using System;
using System.Collections.Generic;
using Gonogo.KosUplink;
using Sitrep.Contract;
using Xunit;

namespace GonogoKosUplink.Tests
{
    /// <summary>
    /// Headless tests for <see cref="KosRunManager"/>: the pure per-CPU
    /// arm/complete/cancel bookkeeping behind the <c>kos.run</c> command. No
    /// KosExtension, no kOS/Unity:
    /// this class stands entirely on its own, exactly like
    /// <c>KosTerminalManagerTests</c> stands alone from
    /// <c>KosProcessorScreen</c>.
    /// </summary>
    public class KosRunManagerTests
    {
        [Fact]
        public void TryArm_FirstRequestForACpu_Succeeds()
        {
            var mgr = new KosRunManager();

            Assert.True(mgr.TryArm(7, "req-1"));
            Assert.True(mgr.IsArmed(7));
        }

        [Fact]
        public void TryArm_SecondRequestForTheSameCpuWhileArmed_Fails()
        {
            var mgr = new KosRunManager();
            Assert.True(mgr.TryArm(7, "req-1"));

            // A second kos.run for the same CPU before the first resolves
            // must be rejected, never silently clobber the first request's
            // correlation.
            Assert.False(mgr.TryArm(7, "req-2"));
            Assert.True(mgr.IsArmed(7));
        }

        [Fact]
        public void TryArm_DifferentCpus_AreIndependent()
        {
            var mgr = new KosRunManager();

            Assert.True(mgr.TryArm(7, "req-1"));
            Assert.True(mgr.TryArm(9, "req-2"));
            Assert.True(mgr.IsArmed(7));
            Assert.True(mgr.IsArmed(9));
        }

        [Fact]
        public void TryArm_EmptyRequestId_Fails()
        {
            var mgr = new KosRunManager();

            Assert.False(mgr.TryArm(7, ""));
            Assert.False(mgr.IsArmed(7));
        }

        [Fact]
        public void Complete_WhenArmed_PublishesFieldsAndDisarms()
        {
            var mgr = new KosRunManager();
            var published = new List<(int coreId, KosRunResult result)>();
            mgr.SetPublisher((coreId, result) => published.Add((coreId, result)));
            mgr.TryArm(7, "req-1");

            Assert.True(mgr.Complete(7, new Dictionary<string, object?> { ["v"] = 1.0 }));

            var (coreId, result) = Assert.Single(published);
            Assert.Equal(7, coreId);
            Assert.Equal("req-1", result.RequestId);
            Assert.Equal(1.0, result.Fields!["v"]);
            Assert.Null(result.Error);
            Assert.False(result.Ended);
            Assert.False(mgr.IsArmed(7));
        }

        [Fact]
        public void Complete_WhenNotArmed_IsANoOp()
        {
            var mgr = new KosRunManager();
            var published = new List<KosRunResult>();
            mgr.SetPublisher((_, result) => published.Add(result));

            Assert.False(mgr.Complete(7, new Dictionary<string, object?> { ["v"] = 1.0 }));

            Assert.Empty(published);
        }

        [Fact]
        public void Cancel_DisarmsWithoutPublishing()
        {
            var mgr = new KosRunManager();
            var published = new List<KosRunResult>();
            mgr.SetPublisher((_, result) => published.Add(result));
            mgr.TryArm(7, "req-1");

            mgr.Cancel(7);

            Assert.False(mgr.IsArmed(7));
            Assert.Empty(published);
            // A stray return landing after cancellation is not mis-attributed.
            mgr.Complete(7, new Dictionary<string, object?>());
            Assert.Empty(published);
        }

        [Fact]
        public void ArmAndStart_WhenTheStartSucceeds_AcksAndStaysArmedForTheResult()
        {
            var mgr = new KosRunManager();

            var result = mgr.ArmAndStart(7, "req-1", () => null);

            Assert.True(result.Success);
            Assert.True(mgr.IsArmed(7));
        }

        [Fact]
        public void ArmAndStart_WhenTheStartIsRefused_AnswersWithThatRefusal()
        {
            var mgr = new KosRunManager();

            var result = mgr.ArmAndStart(7, "req-1", () => CommandResult.Fail(KosErrorCodes.ScriptNotFound));

            Assert.False(result.Success);
            Assert.Equal(KosErrorCodes.ScriptNotFound, result.ErrorCode);
        }

        /// <summary>
        /// Arming happens before the start, so a run that never started has to
        /// be unarmed again, or every later <c>kos.run</c> to that CPU is
        /// rejected forever.
        /// </summary>
        [Fact]
        public void ArmAndStart_WhenTheStartIsRefused_LeavesTheCpuRunnable()
        {
            var mgr = new KosRunManager();

            mgr.ArmAndStart(7, "req-1", () => CommandResult.Fail(KosErrorCodes.NoRoom));

            Assert.False(mgr.IsArmed(7));
            Assert.True(mgr.ArmAndStart(7, "req-2", () => null).Success);
        }

        [Fact]
        public void ArmAndStart_WhenTheStartThrows_LeavesTheCpuRunnable()
        {
            var mgr = new KosRunManager();

            Assert.Throws<InvalidOperationException>(() =>
                mgr.ArmAndStart(7, "req-1", () => throw new InvalidOperationException("kOS")));

            Assert.False(mgr.IsArmed(7));
        }

        /// <summary>A script can return before the start call itself returns, and that result stands.</summary>
        [Fact]
        public void ArmAndStart_AResultDuringTheStart_IsPublished()
        {
            var mgr = new KosRunManager();
            var published = new List<KosRunResult>();
            mgr.SetPublisher((_, result) => published.Add(result));

            var result = mgr.ArmAndStart(7, "req-1", () =>
            {
                mgr.Complete(7, new Dictionary<string, object?> { ["v"] = 1.0 });
                return null;
            });

            Assert.True(result.Success);
            Assert.Equal("req-1", Assert.Single(published).RequestId);
        }

        [Fact]
        public void ArmAndStart_WhenAnotherRunIsInFlight_IsRejectedWithoutStarting()
        {
            var mgr = new KosRunManager();
            Assert.True(mgr.ArmAndStart(7, "req-1", () => null).Success);

            var started = false;
            var result = mgr.ArmAndStart(7, "req-2", () => { started = true; return null; });

            Assert.False(result.Success);
            Assert.Equal(KosErrorCodes.CpuBusy, result.ErrorCode);
            Assert.False(started);
            // The first request's correlation survives the rejection.
            Assert.True(mgr.IsArmed(7));
        }

        [Fact]
        public void Reset_DisarmsEveryCpuSoTheNextRunGetsThrough()
        {
            var mgr = new KosRunManager();
            Assert.True(mgr.ArmAndStart(7, "a", () => null).Success);
            Assert.True(mgr.TryArm(8, "b"));

            mgr.Reset();

            Assert.False(mgr.IsArmed(7));
            Assert.False(mgr.IsArmed(8));
            Assert.True(mgr.ArmAndStart(7, "c", () => null).Success);
        }

        private static void Idle(KosRunManager mgr, Func<int, bool> isIdle, int polls)
        {
            for (var i = 0; i < polls; i++)
            {
                mgr.PollIdle(isIdle);
            }
        }

        [Fact]
        public void PollIdle_RunThatReturnsNothing_PublishesAnEndedResultAndFreesTheCpu()
        {
            var mgr = new KosRunManager();
            var published = new List<(int coreId, KosRunResult result)>();
            mgr.SetPublisher((coreId, result) => published.Add((coreId, result)));
            Assert.True(mgr.ArmAndStart(7, "req-1", () => null).Success);

            Idle(mgr, _ => true, KosRunManager.IdlePollsToEnd);

            var (coreId, result) = Assert.Single(published);
            Assert.Equal(7, coreId);
            Assert.Equal("req-1", result.RequestId);
            Assert.True(result.Ended);
            Assert.Null(result.Fields);
            Assert.Null(result.Error);
            Assert.False(mgr.IsArmed(7));
            Assert.True(mgr.ArmAndStart(7, "req-2", () => null).Success);
        }

        [Fact]
        public void PollIdle_BusyCpu_StaysArmed()
        {
            var mgr = new KosRunManager();
            var published = new List<KosRunResult>();
            mgr.SetPublisher((_, result) => published.Add(result));
            mgr.TryArm(7, "req-1");

            Idle(mgr, _ => false, KosRunManager.IdlePollsToEnd * 3);

            Assert.Empty(published);
            Assert.True(mgr.IsArmed(7));
        }

        [Fact]
        public void PollIdle_AnIdleReadingBetweenBusyOnesDoesNotEndTheRun()
        {
            var mgr = new KosRunManager();
            var published = new List<KosRunResult>();
            mgr.SetPublisher((_, result) => published.Add(result));
            mgr.TryArm(7, "req-1");

            // The typed command is still in kOS's queue for a poll or two.
            mgr.PollIdle(_ => true);
            mgr.PollIdle(_ => false);
            mgr.PollIdle(_ => true);
            mgr.PollIdle(_ => true);

            Assert.Empty(published);
            Assert.True(mgr.IsArmed(7));
        }

        [Fact]
        public void PollIdle_OnlyEndsTheCpuThatIsIdle()
        {
            var mgr = new KosRunManager();
            var published = new List<(int coreId, KosRunResult result)>();
            mgr.SetPublisher((coreId, result) => published.Add((coreId, result)));
            mgr.TryArm(7, "req-1");
            mgr.TryArm(9, "req-2");

            Idle(mgr, core => core == 9, KosRunManager.IdlePollsToEnd);

            Assert.Equal(9, Assert.Single(published).coreId);
            Assert.True(mgr.IsArmed(7));
            Assert.False(mgr.IsArmed(9));
        }

        [Fact]
        public void CancelRun_DisarmsTheNamedRunWithoutPublishing()
        {
            var mgr = new KosRunManager();
            var published = new List<KosRunResult>();
            mgr.SetPublisher((_, result) => published.Add(result));
            mgr.TryArm(7, "req-1");

            Assert.True(mgr.CancelRun(7, "req-1"));

            Assert.False(mgr.IsArmed(7));
            Assert.Empty(published);
            Assert.True(mgr.TryArm(7, "req-2"));
        }

        [Fact]
        public void CancelRun_ForARunThatIsNotTheArmedOne_ChangesNothing()
        {
            var mgr = new KosRunManager();
            mgr.TryArm(7, "req-2");

            Assert.False(mgr.CancelRun(7, "req-1"));
            Assert.False(mgr.CancelRun(8, "req-2"));

            Assert.True(mgr.IsArmed(7));
        }

        [Fact]
        public void CancelRun_AfterTheRunAlreadyEnded_ReportsNothingToStop()
        {
            var mgr = new KosRunManager();
            mgr.SetPublisher((_, _) => { });
            mgr.TryArm(7, "req-1");
            Idle(mgr, _ => true, KosRunManager.IdlePollsToEnd);

            Assert.False(mgr.CancelRun(7, "req-1"));
        }

        [Fact]
        public void StrayReturn_WithNothingArmed_CompletesNothing()
        {
            var mgr = new KosRunManager();
            var published = new List<KosRunResult>();
            mgr.SetPublisher((_, result) => published.Add(result));
            mgr.TryArm(7, "req-1");
            Idle(mgr, _ => true, KosRunManager.IdlePollsToEnd);
            published.Clear();

            mgr.Complete(7, new Dictionary<string, object?> { ["v"] = 1.0 });

            Assert.Empty(published);
            Assert.False(mgr.IsArmed(7));
        }

        [Fact]
        public void StrayReturn_AfterACancel_DoesNotCompleteTheNextRequestEarly()
        {
            var mgr = new KosRunManager();
            var published = new List<KosRunResult>();
            mgr.SetPublisher((_, result) => published.Add(result));
            mgr.TryArm(7, "req-1");
            mgr.CancelRun(7, "req-1");

            mgr.Complete(7, new Dictionary<string, object?> { ["v"] = 1.0 });
            mgr.TryArm(7, "req-2");

            Assert.Empty(published);
            Assert.True(mgr.IsArmed(7));
        }

        [Fact]
        public void Fail_WhileArmed_PublishesTheErrorAndDisarms()
        {
            var mgr = new KosRunManager();
            var published = new List<KosRunResult>();
            mgr.SetPublisher((_, result) => published.Add(result));
            mgr.TryArm(7, "req-1");

            mgr.Fail(7, "Undefined Variable Name 'x'.");

            var result = Assert.Single(published);
            Assert.Equal("req-1", result.RequestId);
            Assert.Equal("Undefined Variable Name 'x'.", result.Error);
            Assert.Null(result.Fields);
            Assert.False(result.Ended);
            Assert.False(mgr.IsArmed(7));
        }

        [Fact]
        public void Fail_WithNothingArmed_PublishesNothing()
        {
            var mgr = new KosRunManager();
            var published = new List<KosRunResult>();
            mgr.SetPublisher((_, result) => published.Add(result));

            mgr.Fail(7, "Syntax error");

            Assert.Empty(published);
        }

        [Fact]
        public void Fail_ThenIdle_DoesNotPublishASecondResult()
        {
            var mgr = new KosRunManager();
            var published = new List<KosRunResult>();
            mgr.SetPublisher((_, result) => published.Add(result));
            mgr.TryArm(7, "req-1");

            mgr.Fail(7, "boom");
            Idle(mgr, _ => true, KosRunManager.IdlePollsToEnd);

            Assert.Single(published);
        }
    }
}
