using GonogoPrincipiaUplink;
using Xunit;

namespace GonogoPrincipiaUplink.Tests
{
    /// <summary>
    /// The addon is a per-scene object, so the one found in the Space Center is a
    /// dead reference in flight. A cache that keeps it forever reads nothing from
    /// the flight scene, and nothing says so.
    /// </summary>
    public sealed class PrincipiaAddonCacheTests
    {
        private sealed class Addon
        {
            public bool Alive = true;
        }

        [Fact]
        public void FindsTheAddonOnceWhileItLives()
        {
            var finds = 0;
            var addon = new Addon();
            var cache = new PrincipiaAddonCache(() => { finds++; return addon; }, a => ((Addon)a).Alive);

            Assert.Same(addon, cache.Current());
            Assert.Same(addon, cache.Current());
            Assert.Equal(1, finds);
        }

        [Fact]
        public void FindsTheNextScenesAddonOnceTheHeldOneIsDestroyed()
        {
            var spaceCenter = new Addon();
            var flight = new Addon();
            var current = spaceCenter;
            var cache = new PrincipiaAddonCache(() => current, a => ((Addon)a).Alive);

            Assert.Same(spaceCenter, cache.Current());

            spaceCenter.Alive = false;
            current = flight;

            Assert.Same(flight, cache.Current());
        }

        [Fact]
        public void AnswersNullWhileTheSceneHasNoAddonAndFindsItWhenItAppears()
        {
            var spaceCenter = new Addon();
            Addon? current = spaceCenter;
            var cache = new PrincipiaAddonCache(() => current, a => ((Addon)a).Alive);
            Assert.Same(spaceCenter, cache.Current());

            spaceCenter.Alive = false;
            current = null;
            Assert.Null(cache.Current());

            var flight = new Addon();
            current = flight;
            Assert.Same(flight, cache.Current());
        }

        [Fact]
        public void DoesNotHandBackADestroyedAddonTheSearchStillFinds()
        {
            var stale = new Addon { Alive = false };
            var cache = new PrincipiaAddonCache(() => stale, a => ((Addon)a).Alive);

            Assert.Null(cache.Current());
        }
    }
}
