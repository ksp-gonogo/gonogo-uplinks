using System.Collections.Generic;

namespace Gonogo.RealAntennasUplink
{
    /// <summary>
    /// The log line for a chain's walk, one per change. A chain on a craft the
    /// channel is not scoped to is not on the wire, so this is where its link
    /// reading and its decision can be read.
    /// </summary>
    internal sealed class RaChainTrace
    {
        private readonly Dictionary<string, string> _last = new Dictionary<string, string>();

        /// <summary>The line to log for this tick, or null when nothing changed since the last one for this chain.</summary>
        public string? Note(string chainKey, bool loaded, bool? connected, RaChainPolicy.Move move, int step)
        {
            var state = (loaded ? "loaded" : "unloaded")
                + ", " + (connected == null ? "link unreadable" : connected.Value ? "linked" : "no link")
                + ", " + move.ToString().ToLowerInvariant()
                + (move == RaChainPolicy.Move.Apply ? " entry " + (step + 1).ToString() : "");
            if (_last.TryGetValue(chainKey, out var previous) && previous == state)
            {
                return null;
            }
            _last[chainKey] = state;
            return "[GonogoRealAntennasUplink] chain " + chainKey + ": " + state;
        }
    }
}
