using GonogoFerramAerospaceResearchUplink;
using Sitrep.Contract.TestSupport;
using Xunit;

namespace GonogoFerramAerospaceResearchUplink.Tests
{
    public class FerramAerospaceResearchTopicPayloadSerializationTests
    {
        [Fact]
        public void Every_declared_topic_payload_writes_to_the_wire()
        {
            TopicPayloadSerializationAssertion.AssertEveryTopicPayloadSerializes(typeof(AeroState).Assembly,
                "AeroState");
        }
    }
}
