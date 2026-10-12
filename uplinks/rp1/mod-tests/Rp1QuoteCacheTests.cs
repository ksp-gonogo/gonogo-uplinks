using Sitrep.Contract;
using Xunit;

namespace GonogoRp1Uplink.Tests
{
    public class Rp1QuoteCacheTests
    {
        private static string Key(string file = "Atlas", long modified = 100, string lc = "lc-1") =>
            Rp1QuoteCache.KeyOf(file, KspEditorFacility.VAB, modified, lc);

        [Fact]
        public void Gives_back_a_price_for_the_same_build_under_the_same_stamp()
        {
            var cache = new Rp1QuoteCache();
            cache.Put(Key(), "s1", 40_000.0);

            Assert.True(cache.TryGet(Key(), "s1", out var price));
            Assert.Equal(40_000.0, price);
        }

        [Fact]
        public void Misses_when_the_careers_stamp_moved()
        {
            var cache = new Rp1QuoteCache();
            cache.Put(Key(), "s1", 40_000.0);

            Assert.False(cache.TryGet(Key(), "s2", out _));
        }

        [Fact]
        public void Misses_when_the_file_was_written_again()
        {
            var cache = new Rp1QuoteCache();
            cache.Put(Key(modified: 100), "s1", 40_000.0);

            Assert.False(cache.TryGet(Key(modified: 101), "s1", out _));
        }

        [Fact]
        public void Keeps_each_complex_and_each_editor_apart()
        {
            var cache = new Rp1QuoteCache();
            cache.Put(Key(lc: "lc-1"), "s", 1.0);

            Assert.False(cache.TryGet(Key(lc: "lc-2"), "s", out _));
            Assert.False(cache.TryGet(
                Rp1QuoteCache.KeyOf("Atlas", KspEditorFacility.SPH, 100, "lc-1"), "s", out _));
        }

        [Fact]
        public void A_newer_stamp_replaces_the_older_price()
        {
            var cache = new Rp1QuoteCache();
            cache.Put(Key(), "s1", 40_000.0);
            cache.Put(Key(), "s2", 30_000.0);

            Assert.False(cache.TryGet(Key(), "s1", out _));
            Assert.True(cache.TryGet(Key(), "s2", out var price));
            Assert.Equal(30_000.0, price);
        }

        [Fact]
        public void Starts_over_rather_than_growing_without_bound()
        {
            var cache = new Rp1QuoteCache();
            for (var i = 0; i < Rp1QuoteCache.Capacity; i++)
            {
                cache.Put(Key(file: "craft" + i), "s", i);
            }

            cache.Put(Key(file: "one-more"), "s", 1.0);

            Assert.False(cache.TryGet(Key(file: "craft0"), "s", out _));
            Assert.True(cache.TryGet(Key(file: "one-more"), "s", out _));
        }
    }
}
