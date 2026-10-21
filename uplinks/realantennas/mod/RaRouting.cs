using System;
using System.Collections.Generic;
using CommNet;
using Sitrep.Contract;

namespace Gonogo.RealAntennasUplink
{
    /// <summary>
    /// RealAntennas' own route between two nodes, which is the only router on an
    /// RA install that answers the way the game does.
    ///
    /// <para>RA replaces stock's pathfinding by overriding <c>FindClosestWhere</c>
    /// and nothing else. Stock's <c>FindHome</c> and
    /// <c>FindClosestControlSource</c> both call through it, which is why every
    /// vessel's <c>ControlPath</c> is RA-correct without anyone doing anything.
    /// <c>FindPath</c> is a separate stock method with its own
    /// <c>CreateShortestPathTree</c> walk, and RA does not touch it: verified
    /// against the shipped assembly, whose only overrides are Add,
    /// SetNodeConnection, TryConnect, Connect, PostUpdateNodes, UpdateNetwork,
    /// Rebuild and FindClosestWhere.</para>
    ///
    /// <para>So a two-node route is asked for as "the closest node that IS the
    /// destination". The predicate is what carries the destination, and it also
    /// does real work inside RA's gate: RA admits a neighbour to the frontier
    /// only when its receiving antenna clears <c>minRelayTL</c> or the predicate
    /// already accepts it, so a below-minimum antenna can still be the end of a
    /// route while never carrying anyone else's traffic. That is exactly the
    /// distinction stock's solver cannot make, and on an RSS/RO career
    /// <c>minRelayTL</c> is 2, so it is not a corner case.</para>
    /// </summary>
    internal static class RaRouting
    {
        /// <summary>
        /// Ordered hop geometry, or null when RA will not route between the two
        /// nodes, with the directions each hop carries read from its link's
        /// forward and reverse data rates through <paramref name="rates"/>.
        /// Fail-soft: a torn-down node mid-solve is "no route" rather than an
        /// exception, which is the same graceful meaning and keeps a telemetry
        /// read from taking the uplink down.
        /// </summary>
        /// <param name="rates">
        /// A link's (forward, reverse) data rate in bits per second, forward
        /// being the link's stored a to b direction. A rate it cannot read is
        /// null and counts as carried; with no reader every hop carries both.
        /// </param>
        internal static IReadOnlyList<CommsRouteHop>? Between(
            CommNode? start,
            CommNode? end,
            Func<CommLink, (double? Forward, double? Reverse)>? rates = null)
        {
            try
            {
                if (start == null || end == null || ReferenceEquals(start, end))
                {
                    return null;
                }

                var net = start.Net;
                if (net == null)
                {
                    return null;
                }

                var path = new CommPath();
                if (net.FindClosestWhere(start, path, (_, node) => ReferenceEquals(node, end)) == null)
                {
                    return null;
                }

                var links = new List<CommLink>();
                foreach (var link in path)
                {
                    if (link?.a != null && link.b != null)
                    {
                        links.Add(link);
                    }
                }
                if (links.Count > 0 && !Touches(links[0], start))
                {
                    links.Reverse();
                }

                var hops = new List<CommsRouteHop>();
                var near = start;
                foreach (var link in links)
                {
                    var carries = CommsDirection.Both;
                    CommNode far;
                    if (ReferenceEquals(link.a, near))
                    {
                        far = link.b;
                        carries = Carried(link, rates, nearIsA: true);
                    }
                    else if (ReferenceEquals(link.b, near))
                    {
                        far = link.a;
                        carries = Carried(link, rates, nearIsA: false);
                    }
                    else
                    {
                        far = link.b;
                    }
                    hops.Add(new CommsRouteHop(
                        (link.a.precisePosition - link.b.precisePosition).magnitude,
                        link.b.isHome || link.a.isHome,
                        CommsNodeHandle.Of(near),
                        CommsNodeHandle.Of(far),
                        carries));
                    near = far;
                }
                return hops;
            }
            catch (Exception)
            {
                return null;
            }
        }

        private static bool Touches(CommLink link, CommNode node) =>
            ReferenceEquals(link.a, node) || ReferenceEquals(link.b, node);

        private static CommsDirection Carried(
            CommLink link,
            Func<CommLink, (double? Forward, double? Reverse)>? rates,
            bool nearIsA)
        {
            if (rates == null)
            {
                return CommsDirection.Both;
            }
            var (forward, reverse) = rates(link);
            var nearToFar = nearIsA ? forward : reverse;
            var farToNear = nearIsA ? reverse : forward;
            return (nearToFar is > 0 or null ? CommsDirection.Forward : CommsDirection.None)
                | (farToNear is > 0 or null ? CommsDirection.Reverse : CommsDirection.None);
        }
    }
}
