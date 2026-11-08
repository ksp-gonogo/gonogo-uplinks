using GonogoRealFuelsUplink;
using Sitrep.Contract.TestSupport;
using Xunit;

namespace GonogoRealFuelsUplink.Tests
{
    public class RealFuelsTopicPayloadSerializationTests
    {
        [Fact]
        public void Every_declared_topic_payload_writes_to_the_wire()
        {
            TopicPayloadSerializationAssertion.AssertEveryTopicPayloadSerializes(typeof(RealFuelsEngines).Assembly,
                "RealFuelsEngines",
                "RealFuelsBoiloff");
        }
    }
}
