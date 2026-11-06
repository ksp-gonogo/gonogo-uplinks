using System;

namespace GonogoPrincipiaUplink
{
    /// <summary>
    /// Holds the Principia addon the Uplink reads fields off, and finds it again
    /// once the one held is gone.
    ///
    /// <para>The addon is a per-scene object: the game destroys it on every scene
    /// change and builds another, so an instance found in the Space Center is a
    /// dead reference in flight. A destroyed Unity object still compares non-null
    /// as a plain <see cref="object"/>, so liveness is asked of the caller rather
    /// than assumed, and a dead addon is searched for again on the next read.</para>
    /// </summary>
    internal sealed class PrincipiaAddonCache
    {
        private readonly Func<object?> _find;
        private readonly Func<object, bool> _isAlive;
        private object? _addon;

        /// <param name="find">Looks the addon up in the current scene, or answers null.</param>
        /// <param name="isAlive">Whether a held addon is still a live scene object.</param>
        public PrincipiaAddonCache(Func<object?> find, Func<object, bool> isAlive)
        {
            _find = find;
            _isAlive = isAlive;
        }

        /// <summary>The live addon, or null while the scene has none.</summary>
        public object? Current()
        {
            if (_addon != null && _isAlive(_addon))
            {
                return _addon;
            }
            _addon = _find();
            return _addon != null && _isAlive(_addon) ? _addon : null;
        }
    }
}
