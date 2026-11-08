using GonogoRp1Uplink;
using Sitrep.Contract.TestSupport;
using Xunit;

namespace GonogoRp1Uplink.Tests
{
    public class Rp1TopicPayloadSerializationTests
    {
        [Fact]
        public void Every_declared_topic_payload_writes_to_the_wire()
        {
            TopicPayloadSerializationAssertion.AssertEveryTopicPayloadSerializes(typeof(Rp1CentreEntry).Assembly,
                "Rp1CentreEntry",
                "Rp1ComplexEntry",
                "Rp1BuildItemEntry",
                "Rp1WarehouseItemEntry",
                "Rp1PadEntry",
                "Rp1OperationEntry",
                "Rp1ConstructionEntry",
                "Rp1ConstructionRates",
                "Rp1ResearchRates",
                "Rp1ResearchEntry",
                "Rp1Personnel",
                "Rp1LcPricing",
                "Rp1RushTerms",
                "Rp1Confidence",
                "Rp1NextCompletion",
                "Rp1ProgramEntry",
                "Rp1ProgramSlots",
                "Rp1FundingCurveEntry",
                "Rp1CrewEntry",
                "Rp1CrewProgram",
                "Rp1BuildableCraftEntry",
                "Rp1LeaderEntry",
                "Rp1FundTarget",
                "Rp1TrainingCourseEntry",
                "Rp1TrainingTemplateEntry",
                "Rp1Tooling",
                "Rp1BuildCost",
                "Rp1CareerEvents",
                "Rp1FacilityEntry",
                "Rp1Avionics",
                "Rp1Simulation",
                "Rp1Budget",
                "Rp1BudgetBreakdown",
                "Rp1CareerLedger");
        }
    }
}
