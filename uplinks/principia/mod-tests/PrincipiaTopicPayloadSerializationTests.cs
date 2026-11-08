using GonogoPrincipiaUplink;
using Sitrep.Contract.TestSupport;
using Xunit;

namespace GonogoPrincipiaUplink.Tests
{
    public class PrincipiaTopicPayloadSerializationTests
    {
        [Fact]
        public void Every_declared_topic_payload_writes_to_the_wire()
        {
            TopicPayloadSerializationAssertion.AssertEveryTopicPayloadSerializes(typeof(PrincipiaAnalysis).Assembly,
                "PrincipiaAnalysis",
                "PrincipiaSettings",
                "PrincipiaPlan");
        }
    }
}
