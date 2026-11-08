using Xunit;

namespace GonogoRp1Uplink.Tests
{
    public class Rp1SaveGuardTests
    {
        [Fact]
        public void A_simulated_flight_forbids_saving()
        {
            Assert.True(new Rp1SaveGuard(() => true).ForbidsSaving);
        }

        [Fact]
        public void A_real_flight_does_not()
        {
            Assert.False(new Rp1SaveGuard(() => false).ForbidsSaving);
        }

        [Fact]
        public void A_save_rp1_does_not_manage_forbids_nothing()
        {
            Assert.False(new Rp1SaveGuard(() => null).ForbidsSaving);
        }
    }
}
