using Gonogo.KosUplink;
using Sitrep.Contract.TestSupport;
using Xunit;

namespace GonogoKosUplink.Tests
{
    public class KosTopicPayloadSerializationTests
    {
        [Fact]
        public void Every_declared_topic_payload_writes_to_the_wire()
        {
            TopicPayloadSerializationAssertion.AssertEveryTopicPayloadSerializes(typeof(KosProcessorInfo).Assembly,
                "KosProcessorInfo");
        }
    }
}
