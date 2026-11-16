using System.Collections.Generic;
using Gonogo.KerbalismUplink;
using Xunit;

namespace GonogoKerbalismUplink.Tests
{
    /// <summary>
    /// Kerbalism is not asked anything until it has set itself up for the loaded
    /// game. Asked earlier, its parent-planet walk never ends and the game
    /// freezes while a flight loads.
    /// </summary>
    public class KerbalismReadinessTests
    {
        /// <summary>Stands in for <c>KERBALISM.Kerbalism</c>, with the two flags its scenario sets as it loads.</summary>
        private static class Scenario
        {
            public static bool IsCoreGameInitDone { get; set; }

            public static bool IsSaveGameInitDone { get; set; }
        }

        /// <summary>Stands in for <c>KERBALISM.Sim</c>, whose sun list is empty until the scenario's first load.</summary>
        private static class Sim
        {
            public static readonly List<object> suns = new();
        }

        private static class NoFlags
        {
        }

        private static void Set(bool core, bool save, int suns)
        {
            Scenario.IsCoreGameInitDone = core;
            Scenario.IsSaveGameInitDone = save;
            Sim.suns.Clear();
            for (var i = 0; i < suns; i++)
            {
                Sim.suns.Add(new object());
            }
        }

        private static KerbalismReadiness Readiness(bool sceneStands = true, bool scenarioMissing = false) =>
            new(typeof(Scenario), typeof(Sim), () => sceneStands, () => scenarioMissing);

        [Fact]
        public void NotReadyBeforeKerbalismsScenarioHasLoaded()
        {
            Set(core: false, save: false, suns: 0);

            Assert.False(Readiness().IsReady);
        }

        [Fact]
        public void NotReadyWhileNoSunIsListedEvenWithBothFlagsSet()
        {
            Set(core: true, save: true, suns: 0);

            Assert.False(Readiness().IsReady);
        }

        [Fact]
        public void NotReadyUntilTheSaveItselfIsSetUp()
        {
            Set(core: true, save: false, suns: 1);

            Assert.False(Readiness().IsReady);
        }

        [Fact]
        public void ReadyOnceKerbalismIsSetUpWhateverTheSceneSays()
        {
            Set(core: true, save: true, suns: 1);

            Assert.True(Readiness(sceneStands: false).IsReady);
        }

        [Fact]
        public void BecomesReadyOnTheSameInstanceWhenTheScenarioLoads()
        {
            Set(core: false, save: false, suns: 0);
            var readiness = Readiness();
            Assert.False(readiness.IsReady);

            Set(core: true, save: true, suns: 1);

            Assert.True(readiness.IsReady);
        }

        [Fact]
        public void LeavingTheGameMakesItNotReadyAgain()
        {
            Set(core: true, save: true, suns: 1);
            var readiness = Readiness();
            Assert.True(readiness.IsReady);

            Scenario.IsSaveGameInitDone = false;

            Assert.False(readiness.IsReady);
        }

        [Fact]
        public void AScenarioInTheGameThatHasNotLoadedYetIsNotMissing()
        {
            Set(core: false, save: false, suns: 0);
            var readiness = Readiness(sceneStands: true, scenarioMissing: false);

            Assert.False(readiness.IsReady);
            Assert.False(readiness.IsMissingFromGame);
        }

        [Fact]
        public void AGameWithoutTheScenarioIsMissingItOnceTheSceneStands()
        {
            Set(core: false, save: false, suns: 0);

            Assert.True(Readiness(sceneStands: true, scenarioMissing: true).IsMissingFromGame);
        }

        [Fact]
        public void NothingIsCalledMissingWhileTheSceneIsStillLoading()
        {
            Set(core: false, save: false, suns: 0);

            Assert.False(Readiness(sceneStands: false, scenarioMissing: true).IsMissingFromGame);
        }

        [Fact]
        public void WhatAnEarlierGameSetUpDoesNotMakeAGameWithoutTheScenarioReady()
        {
            Set(core: true, save: true, suns: 1);
            var readiness = Readiness(sceneStands: true, scenarioMissing: true);

            Assert.False(readiness.IsReady);
            Assert.Same("none", KerbalismReadiness.Usable("bound", readiness, "none"));
        }

        [Fact]
        public void AScenarioCheckThatThrowsReadsAsNotMissing()
        {
            Set(core: true, save: true, suns: 1);
            var readiness = new KerbalismReadiness(
                typeof(Scenario), typeof(Sim), () => true, () => throw new System.InvalidOperationException());

            Assert.False(readiness.IsMissingFromGame);
            Assert.True(readiness.IsReady);
        }

        [Theory]
        [InlineData(true)]
        [InlineData(false)]
        public void ABuildWithoutTheFlagsIsAskedOnlyOnceTheSceneStands(bool sceneStands)
        {
            var readiness = new KerbalismReadiness(typeof(NoFlags), typeof(NoFlags), () => sceneStands);

            Assert.Equal(sceneStands, readiness.IsReady);
        }

        [Fact]
        public void AReadyKerbalismIsAnsweredFromTheVeryHandlesThatWereBound()
        {
            Set(core: true, save: true, suns: 1);
            var bound = new object();
            var none = new object();

            Assert.Same(bound, KerbalismReadiness.Usable(bound, Readiness(), none));
        }

        [Fact]
        public void AKerbalismNotYetSetUpReadsAsNotBound()
        {
            Set(core: false, save: false, suns: 0);
            var bound = new object();
            var none = new object();

            Assert.Same(none, KerbalismReadiness.Usable(bound, Readiness(), none));
            Assert.Same(none, KerbalismReadiness.Usable<object>(null, Readiness(), none));
        }

        private sealed class Clock
        {
            public double Now { get; set; }
        }

        private static KerbalismReadiness Timed(Clock clock, bool sceneStands = true, bool sceneRuns = true, bool scenarioMissing = false) =>
            new(typeof(Scenario), typeof(Sim), () => sceneStands, () => scenarioMissing, () => sceneRuns, () => clock.Now);

        [Fact]
        public void NotStalledBeforeTheLimit()
        {
            Set(core: false, save: false, suns: 0);
            var clock = new Clock();
            var readiness = Timed(clock);

            Assert.False(readiness.IsStalled);
            clock.Now = KerbalismReadiness.StallLimitSeconds - 1;

            Assert.False(readiness.IsStalled);
        }

        [Fact]
        public void StalledOnceTheSceneHasStoodForTheLimitWithoutSetup()
        {
            Set(core: false, save: false, suns: 0);
            var clock = new Clock();
            var readiness = Timed(clock);

            Assert.False(readiness.IsStalled);
            clock.Now = KerbalismReadiness.StallLimitSeconds;

            Assert.True(readiness.IsStalled);
        }

        [Fact]
        public void RecoversWhenKerbalismFinishesLate()
        {
            Set(core: false, save: false, suns: 0);
            var clock = new Clock();
            var readiness = Timed(clock);
            Assert.False(readiness.IsStalled);
            clock.Now = 120;
            Assert.True(readiness.IsStalled);

            Set(core: true, save: true, suns: 1);

            Assert.False(readiness.IsStalled);
            Assert.True(readiness.IsReady);
        }

        [Fact]
        public void TheCountDoesNotStartUntilTheSceneStands()
        {
            Set(core: false, save: false, suns: 0);
            var clock = new Clock();
            var stands = false;
            var readiness = new KerbalismReadiness(
                typeof(Scenario), typeof(Sim), () => stands, null, () => true, () => clock.Now);

            Assert.False(readiness.IsStalled);
            clock.Now = 100;
            Assert.False(readiness.IsStalled);
            stands = true;
            Assert.False(readiness.IsStalled);
            clock.Now = 100 + KerbalismReadiness.StallLimitSeconds;

            Assert.True(readiness.IsStalled);
        }

        [Fact]
        public void LeavingForASceneKerbalismDoesNotRunInRestartsTheCount()
        {
            Set(core: false, save: false, suns: 0);
            var clock = new Clock();
            var runs = true;
            var readiness = new KerbalismReadiness(
                typeof(Scenario), typeof(Sim), () => true, null, () => runs, () => clock.Now);

            Assert.False(readiness.IsStalled);
            clock.Now = 25;
            runs = false;
            Assert.False(readiness.IsStalled);
            runs = true;
            clock.Now = 40;
            Assert.False(readiness.IsStalled);
            clock.Now = 40 + KerbalismReadiness.StallLimitSeconds;

            Assert.True(readiness.IsStalled);
        }

        [Fact]
        public void NeverStalledInAGameThatDoesNotRunKerbalism()
        {
            Set(core: false, save: false, suns: 0);
            var clock = new Clock();
            var readiness = Timed(clock, scenarioMissing: true);

            Assert.False(readiness.IsStalled);
            clock.Now = 1000;

            Assert.False(readiness.IsStalled);
        }
    }
}
