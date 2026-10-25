using Gonogo.RealAntennasUplink;
using Xunit;

namespace GonogoRealAntennasUplink.Tests
{
    /// <summary>
    /// The up/down resolution the audit flagged as possibly-swapped. RA's
    /// <c>FwdDataRate</c> is the rate in the link's stored <c>a -&gt; b</c>
    /// direction and RA orders <c>a</c>/<c>b</c> by node index, so which of Fwd/Rev
    /// is the downlink depends on which endpoint is the vessel. These pin both
    /// orientations so a regression that silently reverts to a fixed mapping fails.
    /// </summary>
    public class RaLinkDirectionTests
    {
        [Fact]
        public void ForwardIsDownlinkWhenVesselIsNodeA()
        {
            // link.a is the vessel, so Fwd (a -> b) runs vessel -> home = downlink.
            var (up, down) = RaLinkDirection.Resolve(forwardIsDownlink: true, forwardBitsPerSec: 262000, reverseBitsPerSec: 9600);

            Assert.Equal(262000, down);
            Assert.Equal(9600, up);
        }

        [Fact]
        public void ForwardIsUplinkWhenVesselIsNodeB()
        {
            // link.b is the vessel, so Fwd (a -> b) runs home -> vessel = uplink;
            // the downlink is Rev. This is the case the old fixed Down=Fwd got wrong.
            var (up, down) = RaLinkDirection.Resolve(forwardIsDownlink: false, forwardBitsPerSec: 262000, reverseBitsPerSec: 9600);

            Assert.Equal(9600, down);
            Assert.Equal(262000, up);
        }

        [Fact]
        public void AHopRunningAlongTheStoredDirectionReadsTheForwardEnds()
        {
            var ends = RaLinkDirection.ForHop(fromIsForwardEnd: true, "fwdTx", "fwdRx", "revTx", "revRx", 3900, 31500);

            Assert.Equal("fwdTx", ends.Transmit);
            Assert.Equal("fwdRx", ends.Receive);
            Assert.Equal(31500, ends.OppositeBitsPerSec);
        }

        [Fact]
        public void AHopRunningAgainstTheStoredDirectionReadsTheReverseEnds()
        {
            // The hop starts at the link's b node, so its transmitter is the reverse
            // transmitter and the rate the other way is the stored forward one.
            var ends = RaLinkDirection.ForHop(fromIsForwardEnd: false, "fwdTx", "fwdRx", "revTx", "revRx", 3900, 31500);

            Assert.Equal("revTx", ends.Transmit);
            Assert.Equal("revRx", ends.Receive);
            Assert.Equal(3900, ends.OppositeBitsPerSec);
        }
    }
}
