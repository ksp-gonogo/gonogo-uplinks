using System.Collections.Generic;
using System.Linq;
using Gonogo.ScansatUplink;
using Sitrep.Contract;
using Xunit;

namespace GonogoScansatUplink.Tests
{
    public class ScanTypeGateTests
    {
        private const int AltimetryLoRes = 1;
        private const int AltimetryHiRes = 2;
        private const int Biome = 8;
        private const int ResourceHiRes = 256;

        private static readonly Dictionary<string, ScanTechDescription> Tree = new Dictionary<string, ScanTechDescription>
        {
            ["basicScience"] = new ScanTechDescription("Basic Science", 45),
            ["advElectrics"] = new ScanTechDescription("Advanced Electrics", 160),
            ["scienceTech"] = new ScanTechDescription("Scanning Tech", 300),
        };

        /// <summary>The rig's own placement: a low-res altimeter at Basic Science, a high-res one at Advanced Electrics, an M700 at Scanning Tech.</summary>
        private static List<ScannerCarrier> Parts(params string[] researched) => new List<ScannerCarrier>
        {
            new ScannerCarrier(AltimetryLoRes, "basicScience", researched.Contains("basicScience")),
            new ScannerCarrier(AltimetryHiRes, "advElectrics", researched.Contains("advElectrics")),
            new ScannerCarrier(ResourceHiRes, "scienceTech", researched.Contains("scienceTech")),
            new ScannerCarrier(Biome, "Unresearcheable", false),
        };

        private sealed class FakeReads : IScanTypeReads
        {
            public bool? Research = true;
            public List<ScannerCarrier> Installed = Parts();

            public bool? CareerResearch() => Research;
            public IReadOnlyList<ScannerCarrier> Carriers() => Installed;
            public ScanTechDescription Describe(string techId) => Tree[techId];
        }

        private sealed class SubTopic : IGateArguments
        {
            private readonly string _value;

            public SubTopic(string value) => _value = value;

            public bool TryGet(string path, out object value)
            {
                value = _value;
                return path == ChannelArguments.SubTopic;
            }
        }

        private static GateVerdict Ask(FakeReads reads, string subTopic) =>
            new ScanTypeGate(() => null, reads).Evaluate(ScanTypeGate.PerTopic(), new SubTopic(subTopic));

        [Fact]
        public void AScanTypeNoResearchedPartReads_IsLocked_NamingTheCheapestNodeThatDoes()
        {
            var verdict = Ask(new FakeReads(), "Kerbin.2");

            Assert.Equal(GateOutcome.Fail, verdict.Outcome);
            Assert.Equal(CommandErrorCode.NotUnlocked, verdict.ErrorCode);
            var missing = Assert.Single(verdict.Missing!);
            Assert.Equal("advElectrics", missing.Id);
            Assert.Equal("Advanced Electrics", missing.Name);
            Assert.Equal(160, missing.ScienceCost);
        }

        [Fact]
        public void EachTopicIsJudgedOnItsOwnScanType()
        {
            var reads = new FakeReads { Installed = Parts("basicScience") };

            Assert.Equal(GateOutcome.Pass, Ask(reads, "Kerbin.1").Outcome);
            Assert.Equal(GateOutcome.Fail, Ask(reads, "Kerbin.2").Outcome);
            Assert.Equal(GateOutcome.Fail, Ask(reads, "Mun.256").Outcome);
        }

        [Fact]
        public void AFixedMask_UnlocksOnAnyOfItsTypes()
        {
            var gate = new ScanTypeGate(() => null, new FakeReads { Installed = Parts("advElectrics") });

            Assert.Equal(GateOutcome.Pass, gate.Evaluate(ScanTypeGate.For(AltimetryLoRes | AltimetryHiRes), null!).Outcome);
        }

        [Fact]
        public void AScanTypeOnlyAnUnresearchablePartReads_IsUnknown_NeverALockNamingANodeNobodyCanResearch()
        {
            Assert.Equal(GateOutcome.Unknown, Ask(new FakeReads(), "Kerbin.8").Outcome);
        }

        [Fact]
        public void AScanTypeNoInstalledPartReads_IsUnknown()
        {
            Assert.Equal(GateOutcome.Unknown, Ask(new FakeReads(), "Kerbin.16").Outcome);
        }

        [Fact]
        public void Sandbox_Passes_AndNoResearchScenario_IsUnknown()
        {
            Assert.Equal(GateOutcome.Pass, Ask(new FakeReads { Research = false }, "Kerbin.2").Outcome);
            Assert.Equal(GateOutcome.Unknown, Ask(new FakeReads { Research = null }, "Kerbin.2").Outcome);
        }

        [Fact]
        public void AnUnusableScansat_AnswersUnknownWithItsReason()
        {
            var verdict = new ScanTypeGate(() => "SCANsat API drifted", new FakeReads())
                .Evaluate(ScanTypeGate.PerTopic(), new SubTopic("Kerbin.2"));

            Assert.Equal(GateOutcome.Unknown, verdict.Outcome);
            Assert.Equal("SCANsat API drifted", verdict.Detail);
        }

        [Fact]
        public void EveryGridNamespace_DeclaresTheScanTypeThatRevealsIt()
        {
            foreach (var prefix in new[] { ScanChannels.CoveragePrefix, ScanChannels.MaskPrefix })
            {
                var requirement = Assert.Single(ScanChannels.RequiresFor(prefix));
                Assert.Equal(new[] { ChannelArguments.SubTopic }, requirement.Needs);
            }
            Assert.Equal("3", Assert.Single(ScanChannels.RequiresFor(ScanChannels.HeightPrefix)).Quantity);
            Assert.Equal("8", Assert.Single(ScanChannels.RequiresFor(ScanChannels.BiomePrefix)).Quantity);
            Assert.Equal("16", Assert.Single(ScanChannels.RequiresFor(ScanChannels.AnomaliesPrefix)).Quantity);
        }
    }
}
