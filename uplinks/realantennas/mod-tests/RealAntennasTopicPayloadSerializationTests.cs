using Gonogo.RealAntennasUplink;
using Sitrep.Contract.TestSupport;
using Xunit;

namespace GonogoRealAntennasUplink.Tests
{
    public class RealAntennasTopicPayloadSerializationTests
    {
        [Fact]
        public void Every_declared_topic_payload_writes_to_the_wire()
        {
            TopicPayloadSerializationAssertion.AssertEveryTopicPayloadSerializes(typeof(RealAntennasAntennaChain).Assembly,
                "RealAntennasAntennaChain",
                "CommsDataRate",
                "CommsLinkMargin",
                "RealAntennasHopRate",
                "RealAntennasVesselRetargeting",
                "RealAntennasAntennaState",
                "RealAntennasFleetRow");
        }
    }
}
