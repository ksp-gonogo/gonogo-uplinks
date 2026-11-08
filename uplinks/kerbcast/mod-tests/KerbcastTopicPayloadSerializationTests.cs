using GonogoKerbcastUplink;
using Sitrep.Contract.TestSupport;
using Xunit;

namespace GonogoKerbcastUplink.Tests
{
    public class KerbcastTopicPayloadSerializationTests
    {
        [Fact]
        public void Every_declared_topic_payload_writes_to_the_wire()
        {
            TopicPayloadSerializationAssertion.AssertEveryTopicPayloadSerializes(typeof(KerbcastCameraEntry).Assembly,
                "KerbcastCameraEntry",
                "KerbcastCraftKnowledgeEntry");
        }
    }
}
