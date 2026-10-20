using System.Collections.Generic;
using System.Reflection;
using System.Reflection.Emit;
using Gonogo.KerbalismUplink;
using Xunit;

namespace GonogoKerbalismUplink.Tests
{
    internal static class FakeKerbalism
    {
        internal static readonly Assembly Assembly = AssemblyBuilder.DefineDynamicAssembly(
            new AssemblyName("Kerbalism"), AssemblyBuilderAccess.Run);
    }

    public class KerbalismAssemblyLocatorTests
    {
        private static readonly Assembly Other = typeof(object).Assembly;

        [Fact]
        public void AssemblyThatAppearsAfterConstructionIsFound()
        {
            var loaded = new List<Assembly> { Other };
            long now = 0;
            var locator = new KerbalismAssemblyLocator(() => loaded, () => now);

            Assert.Null(locator.Probe());

            now += 10_000;
            loaded.Add(FakeKerbalism.Assembly);

            Assert.NotNull(locator.Probe());
            Assert.Equal("Kerbalism", locator.Found!.GetName().Name);
        }

        [Fact]
        public void AbsentAssemblyIsProbedOncePerInterval()
        {
            var scans = 0;
            long now = 0;
            var locator = new KerbalismAssemblyLocator(() => { scans++; return new[] { Other }; }, () => now, 2000);

            locator.Probe();
            now += 500;
            locator.Probe();
            now += 2000;
            locator.Probe();

            Assert.Equal(2, scans);
        }

        [Fact]
        public void SourceThatThrowsDegradesToNotFound()
        {
            var locator = new KerbalismAssemblyLocator(() => throw new System.InvalidOperationException());

            Assert.Null(locator.Probe());
        }

        [Fact]
        public void FoundAssemblyIsNotScannedForAgain()
        {
            var scans = 0;
            var locator = new KerbalismAssemblyLocator(() => { scans++; return new[] { FakeKerbalism.Assembly }; });

            locator.Probe();
            locator.Probe();

            Assert.Equal(1, scans);
        }
    }
}
