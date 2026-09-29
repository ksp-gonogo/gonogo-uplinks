/*
 * RP-1's monthly financial ledger, the other half of its CareerLog. Same
 * arm's-length reflection pattern as Rp1CareerCostReflection, which reads the
 * event lists beside it.
 *
 * PROVENANCE. Every member below was checked against ilspycmd disassemblies of
 * the SHIPPED RP-1 v4.6.0.0 and v4.7.0.0 RP0.dll, where LogPeriod is identical.
 * Nothing here has been seen in a running game.
 *
 * WHAT RP-1 DOES WITH IT. CareerLog keeps one LogPeriod per month in a private
 * _periodDict keyed by the period's start. Money is booked into the open period
 * as it moves: FundsChanged sorts each funds change by its transaction reason,
 * and MaintenanceHandler books each upkeep line and the subsidy it paid out
 * directly. When RP-1 moves to the next period it writes the closing snapshot
 * (funds, science, Unlock Credit, headcounts, subsidy size, Confidence and
 * reputation) into the period it is leaving. RP-1 never draws any of this: its
 * Career Log tab only exports it, as CSV or as a web upload.
 *
 * THE LEDGER'S LINES OVERLAP, and are carried as RP-1 books them. The six upkeep
 * lines (salaries, facility and LC maintenance, training) are booked directly;
 * the same money also passes through FundsChanged inside a Maintenance scope and
 * lands in MaintenanceFees net of the subsidy paid. Tooling and entry costs
 * include the Unlock Credit spent on them, which SpentUnlockCredit also counts.
 * Summing the lines double-counts, so nothing here sums them.
 *
 * MEMBERS DELIBERATELY NOT CALLED:
 *
 *   CareerLog.CurrentPeriod
 *       Its getter is a write: while the clock is past NextPeriodStart it calls
 *       SwitchToNextPeriod, which closes periods and moves CurPeriodStart. The
 *       open period is found from the CurPeriodStart field instead, which is
 *       RP-1's own record of which period it has not closed. That can trail the
 *       clock until something books money, and the ledger says what RP-1 says.
 *
 * AT THE TICK, CHEAPLY. A closed period does not change, so the closed periods
 * are read once per (handler, open period, period count) and only the open one
 * is read each tick.
 */
using System;
using System.Collections.Generic;
using System.Linq;

namespace GonogoRp1Uplink
{
    /// <summary>
    /// Reads RP-1's monthly ledger. KSP-free at compile time, so it runs headless
    /// against a stand-in graph.
    /// </summary>
    public sealed class Rp1CareerLedgerReflection
    {
        private const string CareerLogTypeName = "RP0.CareerLog";

        /// <summary>
        /// The figures RP-1 books into a period as money moves, by wire name and
        /// then <c>LogPeriod</c> field.
        /// </summary>
        public static readonly IReadOnlyList<KeyValuePair<string, string>> FlowFields = new[]
        {
            Pair("programFunds", "ProgramFunds"),
            Pair("subsidyPaidOut", "SubsidyPaidOut"),
            Pair("otherFundsEarned", "OtherFundsEarned"),
            Pair("vesselRecovery", "VesselRecovery"),
            Pair("salaryEngineers", "SalaryEngineers"),
            Pair("salaryResearchers", "SalaryResearchers"),
            Pair("salaryCrew", "SalaryCrew"),
            Pair("facilityMaintenance", "FacilityMaintenance"),
            Pair("lcMaintenance", "LCMaintenance"),
            Pair("trainingFees", "TrainingFees"),
            Pair("maintenanceFees", "MaintenanceFees"),
            Pair("launchFees", "LaunchFees"),
            Pair("vesselPurchase", "VesselPurchase"),
            Pair("toolingFees", "ToolingFees"),
            Pair("entryCosts", "EntryCosts"),
            Pair("constructionFees", "ConstructionFees"),
            Pair("hiringEngineers", "HiringEngineers"),
            Pair("hiringResearchers", "HiringResearchers"),
            Pair("otherFees", "OtherFees"),
            Pair("spentUnlockCredit", "SpentUnlockCredit"),
            Pair("repFromPrograms", "RepFromPrograms"),
        };

        /// <summary>
        /// The snapshot RP-1 writes into a period only when it closes it, by wire
        /// name and then <c>LogPeriod</c> field.
        /// </summary>
        public static readonly IReadOnlyList<KeyValuePair<string, string>> ClosingFields = new[]
        {
            Pair("fundsAtClose", "CurrentFunds"),
            Pair("scienceAtClose", "CurrentSci"),
            Pair("unlockCreditAtClose", "CurrentUnlockCredit"),
            Pair("scienceEarnedAtClose", "ScienceEarned"),
            Pair("subsidySize", "SubsidySize"),
            Pair("engineersAtClose", "NumEngineers"),
            Pair("researchersAtClose", "NumResearchers"),
            Pair("confidenceAtClose", "Confidence"),
            Pair("reputationAtClose", "Reputation"),
        };

        private readonly Type? _careerLog;

        private object? _cachedLog;
        private double? _cachedOpenStart;
        private int _cachedCount = -1;
        private List<Rp1LedgerPeriodRaw>? _cachedClosed;

        public Rp1CareerLedgerReflection()
        {
            _careerLog = Rp1Types.Find(CareerLogTypeName);
        }

        public bool IsAvailable => _careerLog != null;

        /// <summary>
        /// MAIN-THREAD read. The ledger, or an unread raw carrying the tick's UT
        /// when RP-1's log handler is not live.
        /// </summary>
        public Rp1CareerLedgerRaw Read(double ut)
        {
            var log = _careerLog == null ? null : Rp1Types.StaticValue(_careerLog, "Instance");
            if (log == null)
            {
                // Cleared rather than held, so the next career loaded does not
                // inherit this one's months.
                _cachedLog = null;
                _cachedClosed = null;
                return new Rp1CareerLedgerRaw { Ut = ut };
            }

            var raw = new Rp1CareerLedgerRaw
            {
                Ut = ut,
                Available = true,
                Enabled = Rp1Types.ReadBool(log, "IsEnabled"),
            };

            var openStart = Rp1Types.ReadDouble(log, "CurPeriodStart");
            var periods = Rp1Types.Enumerate(Rp1Types.Member(log, "_periodDict"))
                .Select(entry => Rp1Types.Member(entry, "Value"))
                .Where(period => period != null)
                .ToList();

            object? open = null;
            if (openStart != null)
            {
                open = periods.FirstOrDefault(p => Rp1Types.ReadDouble(p, "StartUT") == openStart);
            }

            if (!ReferenceEquals(log, _cachedLog) || openStart != _cachedOpenStart
                || periods.Count != _cachedCount || _cachedClosed == null)
            {
                _cachedClosed = periods
                    .Where(p => !ReferenceEquals(p, open))
                    .Select(p => Period(p!, isOpen: false))
                    .ToList();
                _cachedLog = log;
                _cachedOpenStart = openStart;
                _cachedCount = periods.Count;
            }

            raw.Periods.AddRange(_cachedClosed);
            if (open != null)
            {
                raw.Periods.Add(Period(open, isOpen: true));
            }

            // LINQ's OrderBy is stable, so periods RP-1 would not date keep the
            // order its dictionary gave them, after every dated one.
            raw.Periods = raw.Periods
                .OrderBy(p => p.StartUt == null)
                .ThenBy(p => p.StartUt ?? 0d)
                .ToList();
            return raw;
        }

        private static Rp1LedgerPeriodRaw Period(object period, bool isOpen)
        {
            var raw = new Rp1LedgerPeriodRaw
            {
                StartUt = Rp1Types.ReadDouble(period, "StartUT"),
                EndUt = Rp1Types.ReadDouble(period, "EndUT"),
                Open = isOpen,
            };
            foreach (var field in FlowFields)
            {
                raw.Figures[field.Key] = Finite(Rp1Types.ReadDouble(period, field.Value));
            }
            foreach (var field in ClosingFields)
            {
                // RP-1 leaves these at zero until it closes the period, and a zero
                // there would read as a career that ended the month broke.
                raw.Figures[field.Key] = isOpen ? null : Finite(Rp1Types.ReadDouble(period, field.Value));
            }
            return raw;
        }

        private static KeyValuePair<string, string> Pair(string wire, string field) =>
            new KeyValuePair<string, string>(wire, field);

        private static double? Finite(double? value) =>
            value == null || double.IsNaN(value.Value) || double.IsInfinity(value.Value) ? null : value;
    }
}
