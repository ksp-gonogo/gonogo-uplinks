using System;

namespace Gonogo.RealAntennasUplink
{
    /// <summary>
    /// RealAntennas' own measure of a one-way link between two antennas: how far
    /// down its ladder of data rates the link has had to step to close, as a
    /// fraction from 1 (the top rate) towards 0.
    ///
    /// <para>This follows RealAntennas' link jobs step for step
    /// (<c>RateBoundariesJob</c>, <c>MaxTheoreticalBitRateJob</c>,
    /// <c>SelectBitRateJob</c>, <c>CountRateSteps</c>, and the metric
    /// <c>MakeLink</c> is handed). The pair's symbol rate runs from the faster
    /// of the two antennas' slowest to the slower of their fastest. The link
    /// first spends its margin on modulation bits at the top symbol rate, three
    /// decibels a bit, and below that halves the symbol rate until it closes.
    /// The metric is one less the number of halvings of the data rate from the
    /// best the pair can do, over the number of rungs on the ladder.</para>
    ///
    /// <para>RealAntennas works in single precision and this in double, so a
    /// link sitting exactly on a rung may read one rung apart from the game.</para>
    ///
    /// <para>Pure and KSP-free.</para>
    /// </summary>
    public static class RaRateLadder
    {
        /// <summary>What one direction of a link settles on.</summary>
        public readonly struct Rate
        {
            public Rate(double bitsPerSecond, int modulationBits, double metric)
            {
                BitsPerSecond = bitsPerSecond;
                ModulationBits = modulationBits;
                Metric = metric;
            }

            /// <summary>The data rate the link runs at, or 0 when it does not close at any rate.</summary>
            public double BitsPerSecond { get; }

            /// <summary>The modulation bits the link runs at, or 0 when it does not close.</summary>
            public int ModulationBits { get; }

            /// <summary>RealAntennas' metric, from 0 to 1. 0 when the link does not close.</summary>
            public double Metric { get; }
        }

        /// <param name="receivedPowerDbm">The power arriving at the receiver, in dBm.</param>
        /// <param name="minEbDbm">The receiver's noise density plus the energy per bit the encoder needs, in dBm per hertz.</param>
        /// <param name="maxSymbolRateHz">The slower of the two antennas' fastest symbol rates.</param>
        /// <param name="minSymbolRateHz">The faster of the two antennas' slowest symbol rates.</param>
        /// <param name="maxModulationBits">The fewer of the two antennas' modulation bits.</param>
        /// <param name="codingRate">The matched encoder's coding rate.</param>
        public static Rate Select(
            double receivedPowerDbm,
            double minEbDbm,
            double maxSymbolRateHz,
            double minSymbolRateHz,
            int maxModulationBits,
            double codingRate)
        {
            var none = new Rate(0.0, 0, 0.0);
            if (!(maxSymbolRateHz > 0.0) || !(minSymbolRateHz > 0.0) || minSymbolRateHz > maxSymbolRateHz
                || !(codingRate > 0.0) || maxModulationBits < 1
                || double.IsNaN(receivedPowerDbm) || double.IsNaN(minEbDbm))
            {
                return none;
            }

            var maxBitRate = Math.Pow(10.0, (receivedPowerDbm - minEbDbm) / 10.0);
            if (maxBitRate < minSymbolRateHz)
            {
                return none;
            }

            double symbolRate;
            int bits;
            if (maxBitRate <= maxSymbolRateHz)
            {
                symbolRate = maxSymbolRateHz * Math.Pow(2.0, Math.Floor(Math.Log(maxBitRate / maxSymbolRateHz, 2.0)));
                bits = 1;
            }
            else
            {
                var spare = receivedPowerDbm - minEbDbm - (10.0 * Math.Log10(maxSymbolRateHz));
                spare = Math.Max(0.0, Math.Min(100.0, spare));
                bits = Math.Min(maxModulationBits, 1 + (int)Math.Floor(spare / 3.0));
                symbolRate = maxSymbolRateHz;
            }

            var chosen = symbolRate * codingRate * Math.Pow(2.0, bits - 1);
            var best = maxSymbolRateHz * codingRate * Math.Pow(2.0, maxModulationBits - 1);
            var least = minSymbolRateHz * codingRate;
            var rungs = (int)Math.Floor(Math.Log(best / least, 2.0));
            var down = chosen > 0.0 ? (int)Math.Floor(Math.Log(best / chosen, 2.0)) : 0;
            var metric = 1.0 - ((double)down / (rungs + 1));
            return new Rate(chosen, bits, Math.Max(0.0, Math.Min(1.0, metric)));
        }
    }
}
