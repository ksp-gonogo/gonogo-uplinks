using System.Collections.Generic;
using Gonogo.KerbcastUplink;
using Sitrep.Contract;
using Xunit;

namespace GonogoKerbcastUplink.Tests
{
    public sealed class KerbcastZoomTests
    {
        private static KerbcastLensSites SitesWithCommandCamera(string key)
        {
            var sites = new KerbcastLensSites();
            sites.ReplaceCommandFeeds(new Dictionary<string, string> { [key] = "ground:KSC" });
            return sites;
        }

        [Fact]
        public void A_command_camera_zooms_through_the_command_path_at_full_precision()
        {
            var api = new FakeKerbcastApi();

            var result = KerbcastZoom.Apply(api, SitesWithCommandCamera("9"), 9, "9", 0.004);

            Assert.True(result.Success);
            Assert.Equal((9u, 0.004), api.LastCommandFov);
            Assert.Null(api.LastFov);
        }

        [Fact]
        public void A_part_camera_keeps_the_camera_path()
        {
            var api = new FakeKerbcastApi { FovResult = true };

            var result = KerbcastZoom.Apply(api, SitesWithCommandCamera("9"), 4, "4", 30);

            Assert.True(result.Success);
            Assert.Equal((4u, 30f), api.LastFov);
            Assert.Null(api.LastCommandFov);
        }

        [Fact]
        public void A_kerbcast_without_command_zoom_refuses_as_unavailable()
        {
            var api = new FakeKerbcastApi { CommandFovResult = null };

            var result = KerbcastZoom.Apply(api, SitesWithCommandCamera("9"), 9, "9", 1);

            Assert.Equal(CommandErrorCode.ModeUnavailable, result.ErrorCode);
        }

        [Fact]
        public void A_zoom_without_the_lock_refuses_as_unavailable()
        {
            var api = new FakeKerbcastApi { CommandFovResult = "NotLockHolder" };

            var result = KerbcastZoom.Apply(api, SitesWithCommandCamera("9"), 9, "9", 1);

            Assert.Equal(CommandErrorCode.ModeUnavailable, result.ErrorCode);
        }

        [Fact]
        public void A_zoom_kerbcast_calls_a_bad_number_is_a_range_refusal()
        {
            var api = new FakeKerbcastApi { CommandFovResult = "BadNumber" };

            var result = KerbcastZoom.Apply(api, SitesWithCommandCamera("9"), 9, "9", 1);

            Assert.Equal(CommandErrorCode.Range, result.ErrorCode);
        }
    }
}
