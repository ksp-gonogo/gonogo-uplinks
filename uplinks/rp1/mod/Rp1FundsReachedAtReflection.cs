/*
 * When RP-1 forecasts the balance reaching a figure, asked the way RP-1 asks
 * it. No compile-time reference to RP0.dll, the same arm's-length reflection
 * pattern as Rp1ScReflection, whose header carries the provenance rules this
 * file follows.
 *
 * RP-1'S OWN ESTIMATE, CALLED RATHER THAN REPRODUCED. FundTargetProject's
 * public static EstimateTimeToFunds(baseFunds, targetFunds, epsilonTime) is the
 * wait RP-1's Maintenance screen quotes beside a fund target. Read off the
 * shipped RP-1 RP0.dll it bisects SpaceCenterManagement.GetBudgetDelta over
 * [0, FundTargetProject.MaxTime], two Julian years, for at most 256 steps, and
 * returns:
 *
 *   0         when the figure is at or below the balance
 *   +Infinity when the forecast never reaches it inside MaxTime
 *   seconds   otherwise, to within epsilonTime
 *
 * The epsilon is RP-1's own EpsilonTimeAutoWarp, the precision its auto-warp
 * asks with, rather than the quarter-second a standing target uses: a forecast
 * read in days does not need 28 bisection steps where 21 do.
 *
 * AN INSTANT ON THE WIRE, NOT AN INTERVAL. The estimate is taken once per RP-1
 * upkeep refresh, and an interval measured from that moment is wrong a tick
 * later. The instant it lands on stays right until RP-1's forecast changes.
 *
 * MAIN THREAD, AT RP-1'S UPKEEP CADENCE, for the reason Rp1BudgetReflection
 * gives: every GetBudgetDelta runs the Subsidy currency query about once per
 * month of horizon, so one figure is a few hundred queries. Each figure is
 * re-asked only when MaintenanceHandler.lastUpdate moves or the figure is new,
 * which means a payment landing between refreshes reaches the forecast at the
 * next refresh, as it reaches RP-1's own budget.
 */
using System;
using System.Collections.Generic;
using System.Globalization;
using System.Reflection;

namespace GonogoRp1Uplink
{
    /// <summary>RP-1's forecast instant for one figure, or why there is none.</summary>
    internal sealed class Rp1FundsReachedAtReading
    {
        /// <summary>The figure, in whole funds.</summary>
        public long Figure;

        /// <summary>
        /// True when RP-1 answered. False means the estimate could not be taken,
        /// which is not the same as RP-1 forecasting that it never arrives.
        /// </summary>
        public bool Readable;

        /// <summary>The UT RP-1 forecasts the balance reaching the figure, null when not inside its horizon.</summary>
        public double? ReachedAt;
    }

    internal sealed class Rp1FundsReachedAtReflection
    {
        private const string FundTargetProjectTypeName = "RP0.FundTargetProject";
        private const string MaintenanceTypeName = "RP0.MaintenanceHandler";

        private readonly MethodInfo? _estimate;
        private readonly double? _epsilon;
        private readonly Type? _maintenance;

        private object? _lastMaintenance;
        private double? _lastRefresh;
        private readonly Dictionary<long, Rp1FundsReachedAtReading> _cached = new Dictionary<long, Rp1FundsReachedAtReading>();

        public Rp1FundsReachedAtReflection()
        {
            var project = Rp1Types.Find(FundTargetProjectTypeName);
            _maintenance = Rp1Types.Find(MaintenanceTypeName);
            if (project == null)
            {
                return;
            }
            _estimate = Rp1Types.StaticMethod(project, "EstimateTimeToFunds", 3);
            var epsilon = project.GetField("EpsilonTimeAutoWarp", BindingFlags.Public | BindingFlags.Static);
            _epsilon = epsilon != null && epsilon.IsLiteral ? Rp1Types.ToDouble(epsilon.GetRawConstantValue()) : null;
        }

        public bool IsAvailable => _estimate != null && _epsilon != null && _maintenance != null;

        /// <summary>
        /// The sub-topic under <c>rp1.fundsReachedAt.</c> that names
        /// <paramref name="figure"/>: the figure in whole funds, invariant digits.
        /// </summary>
        public static string SubTopicFor(long figure) => figure.ToString(CultureInfo.InvariantCulture);

        /// <summary>The figure a sub-topic names, or null for one that names no positive whole figure.</summary>
        public static long? FigureOf(string subTopic) =>
            long.TryParse(subTopic, NumberStyles.None, CultureInfo.InvariantCulture, out var figure) && figure > 0
                ? figure
                : (long?)null;

        /// <summary>
        /// RP-1's forecast for each figure, from <paramref name="balance"/>, taken
        /// again only for a figure not yet asked since RP-1 last refreshed its
        /// upkeep. Empty while RP-1 has no career loaded.
        /// </summary>
        public List<Rp1FundsReachedAtReading> CaptureOnMain(double ut, double? balance, IEnumerable<long> figures)
        {
            var readings = new List<Rp1FundsReachedAtReading>();
            if (!IsAvailable)
            {
                return readings;
            }
            var maintenance = Rp1Types.StaticValue(_maintenance!, "Instance");
            if (maintenance == null)
            {
                _lastMaintenance = null;
                _lastRefresh = null;
                _cached.Clear();
                return readings;
            }

            // The instance is part of the key because a newly loaded save builds
            // a new handler whose refresh stamp can match the old one's.
            var refreshed = Rp1Types.ReadDouble(maintenance, "lastUpdate");
            if (!ReferenceEquals(maintenance, _lastMaintenance) || refreshed != _lastRefresh)
            {
                _cached.Clear();
                _lastMaintenance = maintenance;
                _lastRefresh = refreshed;
            }

            var asked = new HashSet<long>(figures);
            foreach (var stale in new List<long>(_cached.Keys))
            {
                if (!asked.Contains(stale))
                {
                    _cached.Remove(stale);
                }
            }
            foreach (var figure in asked)
            {
                if (!_cached.TryGetValue(figure, out var reading))
                {
                    reading = Estimate(figure, balance, ut);
                    _cached[figure] = reading;
                }
                readings.Add(reading);
            }
            return readings;
        }

        private Rp1FundsReachedAtReading Estimate(long figure, double? balance, double ut)
        {
            var unreadable = new Rp1FundsReachedAtReading { Figure = figure, Readable = false };
            if (balance == null || double.IsNaN(balance.Value) || double.IsInfinity(balance.Value))
            {
                return unreadable;
            }
            double? seconds;
            try
            {
                seconds = Rp1Types.ToDouble(_estimate!.Invoke(null, new object[] { balance.Value, (double)figure, _epsilon!.Value }));
            }
            catch (Exception)
            {
                return unreadable;
            }
            if (seconds == null || double.IsNaN(seconds.Value) || seconds.Value < 0)
            {
                return unreadable;
            }
            return new Rp1FundsReachedAtReading
            {
                Figure = figure,
                Readable = true,
                ReachedAt = double.IsPositiveInfinity(seconds.Value) ? (double?)null : ut + seconds.Value,
            };
        }
    }
}
