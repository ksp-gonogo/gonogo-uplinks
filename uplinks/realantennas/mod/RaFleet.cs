using System.Collections.Generic;
using Sitrep.Contract;

namespace Gonogo.RealAntennasUplink
{
    /// <summary>
    /// The craft-level figures of <c>realantennas.fleet</c>, worked out from
    /// plain readings so they are testable without a running game.
    /// </summary>
    public static class RaFleet
    {
        /// <summary>One antenna as the row reads it.</summary>
        public readonly struct Reading
        {
            public Reading(string? band, double? frequencyHz, bool? steerable)
            {
                Band = band;
                FrequencyHz = frequencyHz;
                Steerable = steerable;
            }

            public string? Band { get; }
            public double? FrequencyHz { get; }
            public bool? Steerable { get; }
        }

        /// <summary>One hop of a route home, as the near end sees it.</summary>
        public readonly struct Hop
        {
            public Hop(double? forwardBitsPerSec, double? reverseBitsPerSec, bool nearEndIsLinkA)
            {
                ForwardBitsPerSec = forwardBitsPerSec;
                ReverseBitsPerSec = reverseBitsPerSec;
                NearEndIsLinkA = nearEndIsLinkA;
            }

            public double? ForwardBitsPerSec { get; }
            public double? ReverseBitsPerSec { get; }
            public bool NearEndIsLinkA { get; }

            /// <summary>The rate along the route: the stored forward rate when the near end is the link's a node, the reverse rate otherwise.</summary>
            public double? AlongRoute => NearEndIsLinkA ? ForwardBitsPerSec : ReverseBitsPerSec;
        }

        /// <summary>The band of the highest-frequency antenna that states both, or null when none does.</summary>
        public static string? BestBand(IReadOnlyList<Reading> antennas)
        {
            string? best = null;
            var bestFrequency = double.NegativeInfinity;
            foreach (var antenna in antennas)
            {
                if (antenna.Band == null || antenna.FrequencyHz == null)
                {
                    continue;
                }
                if (antenna.FrequencyHz.Value > bestFrequency)
                {
                    bestFrequency = antenna.FrequencyHz.Value;
                    best = antenna.Band;
                }
            }
            return best;
        }

        /// <summary>How many antennas are steerable. An antenna whose shape cannot be read is not counted as a dish.</summary>
        public static int DishCount(IReadOnlyList<Reading> antennas)
        {
            var count = 0;
            foreach (var antenna in antennas)
            {
                if (antenna.Steerable == true)
                {
                    count++;
                }
            }
            return count;
        }

        /// <summary>
        /// The slowest hop's rate along the route, or null when there is no hop
        /// or any hop's rate cannot be read: a half-read route has no honest
        /// rate, and 0 would claim a link that does not carry.
        /// </summary>
        public static double? RateToHome(IReadOnlyList<Hop> route)
        {
            if (route.Count == 0)
            {
                return null;
            }
            double? slowest = null;
            foreach (var hop in route)
            {
                var rate = hop.AlongRoute;
                if (rate == null)
                {
                    return null;
                }
                if (slowest == null || rate.Value < slowest.Value)
                {
                    slowest = rate.Value;
                }
            }
            return slowest;
        }
    }
}
