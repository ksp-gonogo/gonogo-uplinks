using GonogoTestFlightUplink;
using Sitrep.Contract;
using Sitrep.Contract.TestSupport;
using Xunit;

/// <summary>
/// The slice's own guards: every scalar wire property declares its unit, every
/// type is reached by that sweep, and every refusal is a refinement under this
/// Uplink's id, which the host checks before it lets any of them onto the wire.
/// </summary>
public class TestFlightContractTests
{
    [Fact]
    public void EveryScalarWirePropertyDeclaresAUnit() =>
        UnitCoverageAssertion.AssertExhaustive(
            typeof(TestFlightReliabilitySummary).Assembly,
            "Units.Seconds/Units.Ratio");

    [Fact]
    public void EveryContractTypeIsReachedByTheCoverageScan() =>
        UnitCoverageAssertion.AssertContractTypesAreExactly(
            typeof(TestFlightReliabilitySummary).Assembly,
            nameof(TestFlightReliabilitySummary), nameof(TestFlightReliabilityPart),
            nameof(TestFlightReliabilityBudget), nameof(TestFlightRepairPartArgs),
            nameof(TestFlightRepairOutcome));

    [Fact]
    public void EveryRefusalIsARefinementUnderThisUplinksId()
    {
        var codes = ErrorCodeCatalog.Of(typeof(TestFlightErrorCodes));

        Assert.Equal(5, codes.Count);
        Assert.All(codes, code =>
        {
            Assert.False(code.IsRoot, code.Id);
            Assert.Equal("testflight", code.Owner);
            Assert.Contains(code.Root, CommandErrorCode.Roots);
            Assert.False(string.IsNullOrWhiteSpace(code.Sentence), code.Id);
        });
    }
}
