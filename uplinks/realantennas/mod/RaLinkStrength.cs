using System;
using System.Collections.Generic;
using Sitrep.Contract;

namespace Gonogo.RealAntennasUplink
{
    /// <summary>
    /// One pair's strength under RealAntennas as a function of separation, with
    /// both ends' antennas as they were captured (<see cref="RaLinkWorth"/>),
    /// and the hop's facts in the bag <c>comms.path</c> carries.
    ///
    /// <para>Pure and KSP-free: it holds data only, so a command centre can
    /// evaluate it at the separation its own plan gives the hop.</para>
    /// </summary>
    public sealed class RaLinkStrength : IPersistableLinkStrength
    {
        private readonly IReadOnlyList<RaPlannedAntenna> _from;
        private readonly IReadOnlyList<RaPlannedAntenna> _to;

        public RaLinkStrength(IReadOnlyList<RaPlannedAntenna> from, IReadOnlyList<RaPlannedAntenna> to)
        {
            _from = from ?? throw new ArgumentNullException(nameof(from));
            _to = to ?? throw new ArgumentNullException(nameof(to));
        }

        /// <summary>Names the layout <see cref="Describe"/> writes, so a later layout is told from this one.</summary>
        public const string Model = "realantennas.linkStrength.v1";

        public string ModelId => Model;

        public Dictionary<string, object?> Describe() => new Dictionary<string, object?>
        {
            ["from"] = RaPlannedAntennaData.Of(_from),
            ["to"] = RaPlannedAntennaData.Of(_to),
        };

        /// <summary>The model <see cref="Describe"/> described, or null for data this build did not write.</summary>
        public static RaLinkStrength? From(IReadOnlyDictionary<string, object?> data)
        {
            data.TryGetValue("from", out var from);
            data.TryGetValue("to", out var to);
            var fromAntennas = RaPlannedAntennaData.From(from);
            var toAntennas = RaPlannedAntennaData.From(to);
            return fromAntennas == null || toAntennas == null ? null : new RaLinkStrength(fromAntennas, toAntennas);
        }

        public ContactHopFacts FactsAt(double ut, double separationMeters)
        {
            var worth = RaLinkWorth.At(_from, _to, separationMeters);
            return new ContactHopFacts(worth.Strength, SignalQuantity.DataRateHeadroom, RaLinkWorth.Extensions(worth));
        }

        /// <summary>The least of the hops, and 0 for none: a path carries the rate of its slowest link.</summary>
        public static double Weakest(IReadOnlyList<double> hopStrengths)
        {
            var least = double.PositiveInfinity;
            foreach (var strength in hopStrengths)
            {
                least = Math.Min(least, strength);
            }
            return double.IsPositiveInfinity(least) ? 0.0 : least;
        }
    }
}
