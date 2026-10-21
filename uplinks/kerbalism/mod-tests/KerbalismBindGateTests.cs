using System;
using System.Collections.Generic;
using System.Reflection;
using System.Threading;
using System.Threading.Tasks;
using Gonogo.KerbalismUplink;
using Xunit;

namespace GonogoKerbalismUplink.Tests
{
    public class KerbalismBindGateTests
    {
        private sealed class HandleSet
        {
            public readonly string First;
            public readonly string Last;
            public HandleSet(string first, string last) { First = first; Last = last; }
        }

        private static KerbalismAssemblyLocator Locator(Func<long> now) =>
            new(() => new[] { FakeKerbalism.Assembly }, now, 2000);

        [Fact]
        public void ReaderNeverSeesAHandleSetThatIsPartlyBuilt()
        {
            using var inBuild = new ManualResetEventSlim();
            using var release = new ManualResetEventSlim();
            var gate = new KerbalismBindGate<HandleSet>(Locator(() => 0), _ =>
            {
                var first = "bound";
                inBuild.Set();
                release.Wait();
                return new HandleSet(first, "bound");
            });

            var binder = Task.Run(() => gate.Resolve());
            inBuild.Wait();

            Assert.Null(gate.Peek);

            release.Set();
            var published = binder.Result;
            Assert.NotNull(published);
            Assert.Equal("bound", published!.Last);
            Assert.Same(published, gate.Peek);
        }

        [Fact]
        public void FailedBindPublishesNothingAndKeepsTheRetryInterval()
        {
            long now = 0;
            var builds = 0;
            var gate = new KerbalismBindGate<HandleSet>(Locator(() => now), _ =>
            {
                builds++;
                throw new InvalidOperationException();
            });

            Assert.Null(gate.Resolve());
            Assert.Null(gate.Resolve());
            now += 500;
            Assert.Null(gate.Resolve());
            Assert.Equal(1, builds);

            now += 2000;
            Assert.Null(gate.Resolve());
            Assert.Equal(2, builds);
            Assert.Null(gate.Peek);
        }

        [Fact]
        public void BindThatSucceedsAfterAFailureIsPublished()
        {
            long now = 0;
            var fail = true;
            var gate = new KerbalismBindGate<HandleSet>(Locator(() => now), _ =>
                fail ? throw new InvalidOperationException() : new HandleSet("a", "b"));

            Assert.Null(gate.Resolve());
            fail = false;
            now += 2000;

            Assert.NotNull(gate.Resolve());
            Assert.NotNull(gate.Peek);
        }

        [Fact]
        public void PublishedSetIsBuiltOnceAcrossConcurrentCallers()
        {
            var builds = 0;
            var gate = new KerbalismBindGate<HandleSet>(Locator(() => 0), _ =>
            {
                Interlocked.Increment(ref builds);
                Thread.Sleep(20);
                return new HandleSet("a", "b");
            });

            var results = new HandleSet?[8];
            Parallel.For(0, results.Length, i => results[i] = gate.Resolve());

            Assert.Equal(1, builds);
            Assert.All(results, r => Assert.Same(results[0], r));
        }
    }
}
