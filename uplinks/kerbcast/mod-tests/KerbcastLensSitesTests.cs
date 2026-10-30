using System.Collections.Generic;
using Gonogo.KerbcastUplink;
using Xunit;

namespace GonogoKerbcastUplink.Tests
{
    public sealed class KerbcastLensSitesTests
    {
        private static KeyValuePair<string, IReadOnlyList<KerbcastView>> Craft(string site, params uint[] cameras)
        {
            var views = new List<KerbcastView>();
            foreach (var id in cameras)
            {
                views.Add(new KerbcastView { FlightId = id });
            }
            return new KeyValuePair<string, IReadOnlyList<KerbcastView>>(site, views);
        }

        [Fact]
        public void A_lens_resolves_to_the_craft_that_carries_its_camera()
        {
            var sites = new KerbcastLensSites();

            sites.Replace(new[] { Craft("vessel:aaa", 11, 12), Craft("vessel:bbb", 40) });

            Assert.Equal("vessel:aaa", sites.SiteFor("12"));
            Assert.Equal("vessel:bbb", sites.SiteFor("40"));
        }

        [Fact]
        public void An_unknown_lens_has_no_site()
        {
            var sites = new KerbcastLensSites();
            sites.Replace(new[] { Craft("vessel:aaa", 11) });

            Assert.Null(sites.SiteFor("99"));
        }

        [Fact]
        public void A_lens_follows_its_camera_to_the_craft_it_docks_with()
        {
            var sites = new KerbcastLensSites();
            sites.Replace(new[] { Craft("vessel:aaa", 11), Craft("vessel:bbb", 40) });

            sites.Replace(new[] { Craft("vessel:aaa", 11, 40) });

            Assert.Equal("vessel:aaa", sites.SiteFor("40"));
        }

        [Fact]
        public void A_camera_without_an_id_is_skipped()
        {
            var sites = new KerbcastLensSites();
            var views = new List<KerbcastView> { new KerbcastView(), new KerbcastView { FlightId = 5 } };

            sites.Replace(new[] { new KeyValuePair<string, IReadOnlyList<KerbcastView>>("vessel:aaa", views) });

            Assert.Equal("vessel:aaa", sites.SiteFor("5"));
        }

        [Fact]
        public void Clear_forgets_every_lens()
        {
            var sites = new KerbcastLensSites();
            sites.Replace(new[] { Craft("vessel:aaa", 11) });

            sites.Clear();

            Assert.Null(sites.SiteFor("11"));
        }

        [Theory]
        [InlineData("42", 42L, true)]
        [InlineData("43", 42L, false)]
        [InlineData("", 42L, false)]
        [InlineData(null, 42L, false)]
        public void A_command_agrees_when_its_lens_key_is_its_camera_id(string? key, long cameraId, bool expected)
        {
            Assert.Equal(expected, KerbcastLensSites.Agrees(key, cameraId));
        }
    }
}
