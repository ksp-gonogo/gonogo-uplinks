using GonogoScansatUplink;
using Sitrep.Contract.TestSupport;
using Xunit;

namespace GonogoScansatUplink.Tests
{
    public class ScansatTopicPayloadSerializationTests
    {
        [Fact]
        public void Every_declared_topic_payload_writes_to_the_wire()
        {
            TopicPayloadSerializationAssertion.AssertEveryTopicPayloadSerializes(typeof(ScanningVesselEntry).Assembly,
                "ScanningVesselEntry",
                "ScanScienceEntry");
        }
    }
}
