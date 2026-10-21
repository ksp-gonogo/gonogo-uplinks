using System;
using System.Collections.Generic;
using Gonogo.KerbalismUplink;
using Sitrep.Contract;
using Xunit;

namespace GonogoKerbalismUplink.Tests
{
    public class KerbalismScannerSwitchTests
    {
        private sealed class Scanner
        {
            public bool Scanning;
            public string? Name;
            public int? Sensor;
        }

        /// <summary>The bridge a given Kerbalism build offers, over one scanner module.</summary>
        private sealed class Bridge
        {
            public readonly Scanner Module = new Scanner();
            public bool HasFind;
            public bool HasStart = true;
            public bool HasStop = true;
            public readonly List<string> Calls = new List<string>();

            public RunSwitchRaw Run(bool run, bool moduleOnPart = true) =>
                KerbalismScannerSwitch.Run(
                    () =>
                    {
                        if (HasFind) Calls.Add("find");
                        return moduleOnPart ? Module : null;
                    },
                    HasStart ? (Action<object>)(s => { Calls.Add("start"); ((Scanner)s).Scanning = true; }) : null,
                    HasStop ? (Action<object>)(s => { Calls.Add("stop"); ((Scanner)s).Scanning = false; }) : null,
                    s => ((Scanner)s).Scanning,
                    run);
        }

        [Theory]
        [InlineData(false)]
        [InlineData(true)]
        public void StartAndStopWorkOnEitherApiShape(bool hasFind)
        {
            var api = new Bridge { HasFind = hasFind };

            var started = api.Run(true);
            Assert.Equal(RunSwitchOutcome.Switched, started.Outcome);
            Assert.True(started.Running);

            var stopped = api.Run(false);
            Assert.Equal(RunSwitchOutcome.Switched, stopped.Outcome);
            Assert.False(stopped.Running);
        }

        [Fact]
        public void ASwitchToTheStateItIsInCallsNothing()
        {
            var api = new Bridge();

            Assert.Equal(RunSwitchOutcome.AlreadyThere, api.Run(false).Outcome);
            Assert.DoesNotContain("start", api.Calls);
            Assert.DoesNotContain("stop", api.Calls);
        }

        [Fact]
        public void AScannerThatDidNotChangeIsNotReportedSwitched()
        {
            var raw = KerbalismScannerSwitch.Run(() => new Scanner(), s => { }, s => { }, s => ((Scanner)s).Scanning, true);

            Assert.Equal(RunSwitchOutcome.NotSwitched, raw.Outcome);
            Assert.False(raw.Running);
        }

        [Fact]
        public void AScanStateThatCannotBeReadStillSwitches()
        {
            var called = 0;
            var raw = KerbalismScannerSwitch.Run(() => new Scanner(), s => called++, s => called++, s => null, true);

            Assert.Equal(RunSwitchOutcome.Switched, raw.Outcome);
            Assert.True(raw.Running);
            Assert.Equal(1, called);
        }

        [Theory]
        [InlineData(true)]
        [InlineData(false)]
        public void ABuildWithoutTheNeededDirectionRefusesWithItsReason(bool run)
        {
            var api = new Bridge { HasStart = !run, HasStop = run };

            var raw = api.Run(run);
            Assert.Equal(RunSwitchOutcome.Unavailable, raw.Outcome);
            Assert.Equal(KerbalismScannerSwitch.NoSwitchBridge, raw.Reason);
            Assert.Empty(api.Calls);

            var answer = KerbalismRunAnswer.From(raw);
            Assert.False(answer.Success);
            Assert.Equal(CommandErrorCode.CapabilityMismatch, answer.ErrorCode);
        }

        [Fact]
        public void APartWithNoScannerModuleRefusesRatherThanAnsweringNotFound()
        {
            var raw = new Bridge().Run(true, moduleOnPart: false);

            Assert.Equal(RunSwitchOutcome.Unavailable, raw.Outcome);
            Assert.Equal(KerbalismScannerSwitch.NoScannerModule, raw.Reason);
        }

        [Fact]
        public void AThrowingBridgeLeavesTheScannerNotSwitched()
        {
            var raw = KerbalismScannerSwitch.Run(() => new Scanner(), s => throw new InvalidOperationException(), s => { }, s => false, true);

            Assert.Equal(RunSwitchOutcome.NotSwitched, raw.Outcome);
        }

        [Fact]
        public void TheModuleWalkPrefersTheMatchingSensorAndSkipsOtherModules()
        {
            var a = new Scanner { Name = "SCANsat", Sensor = 1 };
            var b = new Scanner { Name = "SCANsat", Sensor = 4 };
            var other = new Scanner { Name = "ModuleEngines", Sensor = 4 };
            var modules = new[] { other, a, b };

            Assert.Same(b, KerbalismScannerSwitch.Choose(modules, m => m.Name, m => m.Sensor, 4));
            Assert.Same(a, KerbalismScannerSwitch.Choose(modules, m => m.Name, m => m.Sensor, 8));
            Assert.Null(KerbalismScannerSwitch.Choose(new[] { other }, m => m.Name, m => m.Sensor, 4));
        }
    }
}
