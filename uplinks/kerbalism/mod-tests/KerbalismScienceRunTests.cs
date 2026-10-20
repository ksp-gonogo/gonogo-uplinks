using System.Collections.Generic;
using Gonogo.KerbalismUplink;
using Sitrep.Contract;
using Sitrep.Contract.TestSupport;
using Xunit;

namespace GonogoKerbalismUplink.Tests
{
    /// <summary>
    /// Kerbalism's side of continuous science: the run fields its instruments and
    /// lab report, and the four start and stop commands on its elected backend.
    /// The live module switch is the KSP-touching half and is left to the rig;
    /// what is held here is everything up to it, including the shared
    /// <see cref="ScienceRunConformance"/> assertions.
    /// </summary>
    public class KerbalismScienceRunTests
    {
        private const string SinglePart = "101";
        private const string SeveralPart = "102";
        private const string LabPart = "300";

        private static ScienceRaw Capture() => new ScienceRaw
        {
            Modeled = true,
            Experiments =
            {
                new ScienceExperimentRaw { PartId = SinglePart, ExperimentId = "radiationScan", RunningState = "Stopped", ExpStatus = "Stopped" },
                new ScienceExperimentRaw { PartId = SeveralPart, ExperimentId = "temperatureScan", RunningState = "Stopped", ExpStatus = "Stopped" },
                new ScienceExperimentRaw { PartId = SeveralPart, ExperimentId = "seismicScan", RunningState = "Stopped", ExpStatus = "Stopped" },
            },
            Labs = { new ScienceLabRaw { PartId = LabPart, Status = "DISABLED", Running = false } },
            Scanners = { new ScienceScannerRaw { PartId = "500", ExperimentId = "SCANsatAltimetryHiRes", Scanning = false } },
        };

        private static (KerbalismScienceBackend Backend, FakeKerbalismRunActuator Actuator) Rigged()
        {
            var backend = new KerbalismScienceBackend();
            var actuator = new FakeKerbalismRunActuator();
            backend.UseRunActuator(actuator);
            backend.Stash(Capture());
            return (backend, actuator);
        }

        private static RunStateChange Change(CommandResult result)
        {
            Assert.True(result.Success, "refused: " + result.ErrorCode);
            return Assert.IsAssignableFrom<CommandResult<RunStateChange>>(result).Payload!;
        }

        private static ExperimentActionArgs Args(string partId, string? experimentId = null) =>
            new ExperimentActionArgs { PartId = partId, ExperimentId = experimentId };

        [Fact]
        public void StartingAStoppedExperimentReportsAChange()
        {
            var (backend, _) = Rigged();

            var change = Change(backend.StartExperiment(Args(SinglePart)));

            Assert.True(change.Changed);
            Assert.True(change.Running);
        }

        [Fact]
        public void StartingARunningExperimentReportsNoChange()
        {
            var (backend, actuator) = Rigged();
            actuator.Set(SinglePart, "radiationScan", true);

            var change = Change(backend.StartExperiment(Args(SinglePart)));

            Assert.False(change.Changed);
            Assert.True(change.Running);
        }

        [Fact]
        public void AnExperimentThatNamesItsIdIsSwitchedWhenThePartCarriesSeveral()
        {
            var (backend, actuator) = Rigged();

            Change(backend.StartExperiment(Args(SeveralPart, "seismicScan")));

            Assert.True(actuator.IsOn(SeveralPart, "seismicScan"));
            Assert.False(actuator.IsOn(SeveralPart, "temperatureScan"));
        }

        [Fact]
        public void AnIdTheScannerCarriesSwitchesTheScanner()
        {
            var (backend, actuator) = Rigged();

            Change(backend.StartExperiment(Args("500")));

            Assert.Equal(new[] { "start 500/SCANsatAltimetryHiRes" }, actuator.Calls);
        }

        [Fact]
        public void AnIdThePartDoesNotCarryIsNotFoundAndSwitchesNothing()
        {
            var (backend, actuator) = Rigged();

            var result = backend.StartExperiment(Args(SeveralPart, "geigerCounter"));

            Assert.False(result.Success);
            Assert.Equal(CommandErrorCode.NotFound, result.ErrorCode);
            Assert.Empty(actuator.Calls);
        }

        [Fact]
        public void AnUnknownPartIsNotFound()
        {
            var (backend, _) = Rigged();

            Assert.Equal(CommandErrorCode.NotFound, backend.StopExperiment(Args("999")).ErrorCode);
            Assert.Equal(CommandErrorCode.NotFound, backend.StartLab(Args("999")).ErrorCode);
        }

        [Fact]
        public void WithoutAModelledCaptureEveryCommandRefusesAsNotModelled()
        {
            var backend = new KerbalismScienceBackend();
            backend.UseRunActuator(new FakeKerbalismRunActuator());

            Assert.Equal(KerbalismErrorCodes.ScienceNotModelled, backend.StartExperiment(Args(SinglePart)).ErrorCode);
            Assert.Equal(KerbalismErrorCodes.ScienceNotModelled, backend.StopLab(Args(LabPart)).ErrorCode);
        }

        [Fact]
        public void TheLabIsStartedAndStoppedThroughItsOwnCommands()
        {
            var (backend, actuator) = Rigged();

            Assert.True(Change(backend.StartLab(Args(LabPart))).Changed);
            Assert.False(Change(backend.StartLab(Args(LabPart))).Changed);
            Assert.True(Change(backend.StopLab(Args(LabPart))).Changed);
            Assert.Equal(new[] { "start lab 300", "start lab 300", "stop lab 300" }, actuator.Calls);
        }

        [Fact]
        public void TheBackendHonoursTheSharedRunConformance()
        {
            var (backend, actuator) = Rigged();

            ScienceRunConformance.AssertRunBackendContract(backend);
            ScienceRunConformance.AssertSeveralExperimentsNeedAnExperimentId(backend, SeveralPart);
            Assert.Empty(actuator.Calls);

            ScienceRunConformance.AssertStartAndStopAreIdempotent(
                () => backend.StartExperiment(Args(SinglePart)),
                () => backend.StopExperiment(Args(SinglePart)));
            ScienceRunConformance.AssertStartAndStopAreIdempotent(
                () => backend.StartLab(Args(LabPart)),
                () => backend.StopLab(Args(LabPart)));
        }

        [Fact]
        public void AnUncontrollableCraftIsRefusedAsACapabilityMismatch()
        {
            var answer = KerbalismRunAnswer.From(new RunSwitchRaw { Outcome = RunSwitchOutcome.NotControllable });

            Assert.False(answer.Success);
            Assert.Equal(CommandErrorCode.CapabilityMismatch, answer.ErrorCode);
        }

        [Fact]
        public void AnExperimentKerbalismLeftAsItWasIsRefusedWithItsOwnCode()
        {
            var answer = KerbalismRunAnswer.From(new RunSwitchRaw { Outcome = RunSwitchOutcome.NotSwitched });

            Assert.Equal(KerbalismErrorCodes.ExperimentNotSwitched, answer.ErrorCode);
        }

        private static InstrumentEntry Instrument(ScienceExperimentRaw raw) =>
            KerbalismScienceMap.Instruments(new ScienceRaw { Modeled = true, Experiments = { raw } })![0];

        [Fact]
        public void AWaitingExperimentReadsRunningAndNotProducing()
        {
            var row = Instrument(new ScienceExperimentRaw { PartId = "1", RunningState = "Running", ExpStatus = "Waiting" });

            Assert.True(row.Continuous);
            Assert.True(row.Running);
            Assert.False(row.Producing);
            Assert.Null(row.RunIssue);
            Assert.Null(row.Deployed);
        }

        [Theory]
        [InlineData("Running", "Running", true, true)]
        [InlineData("Forced", "Forced", true, true)]
        [InlineData("Stopped", "Stopped", false, false)]
        [InlineData("Broken", "Broken", false, false)]
        public void EachExperimentStateFillsRunningAndProducing(string state, string status, bool running, bool producing)
        {
            var row = Instrument(new ScienceExperimentRaw { PartId = "1", RunningState = state, ExpStatus = status });

            Assert.Equal(running, row.Running);
            Assert.Equal(producing, row.Producing);
        }

        [Fact]
        public void AnExperimentWithAnIssueIsRunningNotProducingAndCarriesKerbalismsText()
        {
            var row = Instrument(new ScienceExperimentRaw
            {
                PartId = "1", RunningState = "Running", ExpStatus = "Issue", Issue = "no electric charge",
            });

            Assert.True(row.Running);
            Assert.False(row.Producing);
            Assert.Equal("no electric charge", row.RunIssue);
        }

        [Fact]
        public void AnExperimentWhoseStateWasNotReadClaimsNeitherAnswer()
        {
            var row = Instrument(new ScienceExperimentRaw { PartId = "1" });

            Assert.Null(row.Running);
            Assert.Null(row.Producing);
        }

        [Fact]
        public void ALabReportsWhetherItIsOnAndWhetherItIsWorking()
        {
            List<LabEntry> labs(string status, bool? running) => KerbalismScienceMap.Lab(new ScienceRaw
            {
                Modeled = true,
                Labs = { new ScienceLabRaw { PartId = "300", Status = status, Running = running } },
            })!;

            var working = labs("RUNNING", true)[0];
            Assert.True(working.Running);
            Assert.True(working.Producing);
            Assert.Null(working.RunIssue);

            var starved = labs("NO_SAMPLE", true)[0];
            Assert.True(starved.Running);
            Assert.False(starved.Producing);
            Assert.Equal("no sample to analyse", starved.RunIssue);

            var off = labs("DISABLED", false)[0];
            Assert.False(off.Running);
            Assert.False(off.Producing);
            Assert.Null(off.RunIssue);
        }
    }
}
