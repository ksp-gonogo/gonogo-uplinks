using GonogoTestFlightUplink;
using Sitrep.Contract.TestSupport;
using Xunit;

namespace GonogoTestFlightUplink.Tests
{
    public class TestFlightTopicPayloadSerializationTests
    {
        [Fact]
        public void Every_declared_topic_payload_writes_to_the_wire()
        {
            TopicPayloadSerializationAssertion.AssertEveryTopicPayloadSerializes(typeof(TestFlightReliabilitySummary).Assembly,
                "TestFlightReliabilitySummary",
                "TestFlightReliabilityPart");
        }
    }
}
