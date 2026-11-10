using System;
using System.Collections.Generic;
using System.Globalization;
using System.Threading;

namespace Gonogo.KerbcastUplink
{
    /// <summary>
    /// Where each camera lens stands, for the <c>kerbcast.lens.</c> namespace.
    /// A lens is keyed by its camera id in decimal, the same number
    /// <c>kerbcast.cameras</c> lists as <c>cameraId</c>. A command naming a lens
    /// is delayed by the signal delay from the command centre to that lens's craft,
    /// or for a command camera to the command centre it stands at.
    /// </summary>
    public sealed class KerbcastLensSites
    {
        public const string Prefix = "kerbcast.lens.";

        private IReadOnlyDictionary<string, string> _sites = new Dictionary<string, string>();
        private IReadOnlyDictionary<string, string> _feedSites = new Dictionary<string, string>();

        /// <summary>The key a camera is addressed by in the lens namespace.</summary>
        public static string KeyFor(long cameraId) => cameraId.ToString(CultureInfo.InvariantCulture);

        /// <summary>
        /// The command centre id of the craft a lens rides, <c>"vessel:&lt;guid&gt;"</c>,
        /// or null when the key names no lens known yet. Safe on any thread.
        /// </summary>
        public string? SiteFor(string key) =>
            Volatile.Read(ref _sites).TryGetValue(key, out var site)
                || Volatile.Read(ref _feedSites).TryGetValue(key, out site)
                    ? site
                    : null;

        /// <summary>
        /// Replaces what is known with the lenses of <paramref name="craft"/>, each a
        /// craft's centre id and the cameras it carries. Called from the main
        /// thread, since reading a craft's cameras is a game read.
        /// </summary>
        public void Replace(IEnumerable<KeyValuePair<string, IReadOnlyList<KerbcastView>>> craft)
        {
            var sites = new Dictionary<string, string>(StringComparer.Ordinal);
            foreach (var entry in craft)
            {
                foreach (var view in entry.Value)
                {
                    if (view.FlightId is uint id)
                    {
                        sites[KeyFor(id)] = entry.Key;
                    }
                }
            }
            Volatile.Write(ref _sites, sites);
        }

        /// <summary>
        /// Replaces the command cameras known, each keyed by its camera id in decimal
        /// and mapped to the command centre its lens stands at, such as a ground
        /// station. These lenses ride no craft, so <see cref="Replace"/> never
        /// places them. Safe on any thread.
        /// </summary>
        public void ReplaceCommandFeeds(IReadOnlyDictionary<string, string> feedSites) =>
            Volatile.Write(ref _feedSites, feedSites);

        /// <summary>Forgets every lens that rides a craft; the command cameras stay until <see cref="ReplaceCommandFeeds"/> replaces them.</summary>
        public void Clear() => Volatile.Write(ref _sites, new Dictionary<string, string>());

        /// <summary>
        /// Whether a command's lens key and camera id name the same camera, so the
        /// craft the command was delayed for is the craft it is applied to.
        /// </summary>
        public static bool Agrees(string? lensKey, long cameraId) =>
            string.Equals(lensKey, KeyFor(cameraId), StringComparison.Ordinal);
    }
}
