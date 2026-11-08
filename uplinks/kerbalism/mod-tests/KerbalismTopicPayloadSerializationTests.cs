using GonogoKerbalismUplink;
using Sitrep.Contract.TestSupport;
using Xunit;

namespace GonogoKerbalismUplink.Tests
{
    public class KerbalismTopicPayloadSerializationTests
    {
        [Fact]
        public void Every_declared_topic_payload_writes_to_the_wire()
        {
            TopicPayloadSerializationAssertion.AssertEveryTopicPayloadSerializes(typeof(KerbalismSpaceWeather).Assembly,
                "KerbalismSpaceWeather",
                "KerbalismProfile",
                "KerbalismLifeSupport",
                "KerbalismCrewEntry",
                "KerbalismFeatures",
                "KerbalismReliabilitySummary",
                "KerbalismReliabilityPart",
                "KerbalismTransmission",
                "KerbalismEva",
                "KerbalismDiagnostics");
        }
    }
}
