using Gonogo.KerbcastUplink;
using Sitrep.Contract;
using Xunit;

namespace GonogoKerbcastUplink.Tests
{
    public sealed class KerbcastZoomTests
    {
        [Fact]
        public void A_zoom_goes_through_the_camera_path()
        {
            var api = new FakeKerbcastApi { FovResult = true };

            var result = KerbcastZoom.Apply(api, 4, 30);

            Assert.True(result.Success);
            Assert.Equal((4u, 30f), api.LastFov);
        }

        [Fact]
        public void A_zoom_kerbcast_refuses_is_not_found()
        {
            var api = new FakeKerbcastApi { FovResult = false };

            var result = KerbcastZoom.Apply(api, 4, 30);

            Assert.Equal(CommandErrorCode.NotFound, result.ErrorCode);
        }
    }
}
