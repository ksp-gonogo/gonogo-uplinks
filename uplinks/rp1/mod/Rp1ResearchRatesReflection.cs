/*
 * What the research queue would pay its researchers per day, earn in Unlock
 * Credit per day, and when the node being researched would finish, at every work
 * rate RP-1's research slider offers. No compile-time reference to RP0.dll, the
 * same arm's-length reflection pattern as Rp1BudgetReflection, whose header
 * carries the thread and provenance rules this file follows.
 *
 * PROVENANCE. Every member below was checked against an ilspycmd disassembly of
 * the SHIPPED RP-1 v4.6.0.0 and v4.7.0.0 RP0.dll, which agree on all of them.
 * Nothing here has been seen in a running game.
 *
 * THE SALARY IS MaintenanceHandler.UpdateUpkeep's, at each rate in place of
 * TechList[0].workRate:
 *
 *     Researchers * salaryResearchers / 365.25
 *         * (ResearcherIdleSalaryMult + (1 - ResearcherIdleSalaryMult) * workRate)
 *
 * put through CurrencyUtils.Funds(SalaryResearchers, -salary) and negated, which
 * is how the Budget tab's Research Teams row shows it.
 *
 * THE CREDIT IS UnlockCreditHandler.CreditForTime's, over one day at each rate:
 *
 *     86400 * _unlockCredRate * workRate * salaryResearchers / (365.25 * 86400)
 *         * (each researcher's multiplier off researchersToUnlockCreditSalaryMultipliers)
 *
 * times CurrencyUtils.Rate(RateUnlockCreditIncrease), the modifier
 * IncrementCredit and the Budget tab both apply. CreditForTime itself is not
 * called because it reads the rate off TechList[0] rather than taking one, so it
 * can only ever answer for the rate already set. It is linear in the rate, so
 * RP-1's own figure at the current rate is this table's figure at that step.
 *
 * THE FINISH IS ResearchProject.TimeLeft's, at each rate in place of the node's
 * own: (scienceCost - progress) / (_buildRate * workRate). _buildRate is read
 * rather than BuildRate, because the getter costs an uncosted node through
 * UpdateBuildRate, which writes it.
 *
 * AT RP-1'S UPKEEP CADENCE, as rp1.budget, and again whenever the head of the
 * queue, its rate or cost, or the researcher count changes, so a rate just set is
 * priced on the next tick rather than up to an hour later.
 *
 * COST. Twenty-two currency queries a refresh.
 */
using System;
using System.Collections.Generic;
using System.Globalization;
using System.Reflection;

namespace GonogoRp1Uplink
{
    /// <summary>
    /// Reads the research rate table on the main thread, recomputing only when
    /// RP-1 has refreshed its upkeep or the queue has changed.
    /// </summary>
    public sealed class Rp1ResearchRatesReflection
    {
        private const double SecondsPerDay = 86400d;
        private const double DaysPerYear = 365.25d;

        private const string MaintenanceTypeName = "RP0.MaintenanceHandler";
        private const string SpaceCenterTypeName = "RP0.SpaceCenterManagement";
        private const string UnlockCreditTypeName = "RP0.UnlockCreditHandler";
        private const string CurrencyUtilsTypeName = "RP0.CurrencyUtils";
        private const string TransactionReasonsTypeName = "RP0.TransactionReasonsRP0";
        private const string DatabaseTypeName = "RP0.Database";

        private readonly Type? _maintenance;
        private readonly Type? _spaceCenter;
        private readonly Type? _unlockCredit;
        private readonly Type? _transactionReasons;
        private readonly Type? _database;
        private readonly MethodInfo? _funds;
        private readonly MethodInfo? _rate;

        private object? _lastSpaceCenter;
        private double? _lastRefresh;
        private string? _lastSignature;
        private Rp1ResearchRatesRaw? _cached;

        public Rp1ResearchRatesReflection()
        {
            _maintenance = Rp1Types.Find(MaintenanceTypeName);
            _spaceCenter = Rp1Types.Find(SpaceCenterTypeName);
            _unlockCredit = Rp1Types.Find(UnlockCreditTypeName);
            _transactionReasons = Rp1Types.Find(TransactionReasonsTypeName);
            _database = Rp1Types.Find(DatabaseTypeName);

            var currency = Rp1Types.Find(CurrencyUtilsTypeName);
            if (currency != null)
            {
                // includeHidden is last and defaulted, which a reflected call
                // does not supply, so it is passed explicitly.
                _funds = Rp1Types.StaticMethod(currency, "Funds", 3);
                _rate = Rp1Types.StaticMethod(currency, "Rate", 2);
            }
        }

        /// <summary>The things without which nothing can be priced.</summary>
        public bool IsAvailable =>
            _spaceCenter != null && _database != null && _funds != null && _rate != null && _transactionReasons != null;

        /// <summary>
        /// MAIN-THREAD read. Null when RP-1 is not running a career in this
        /// scene; otherwise the last reading, recomputed if anything it depends
        /// on has moved.
        /// </summary>
        public Rp1ResearchRatesRaw? CaptureOnMain(double ut)
        {
            if (!IsAvailable)
            {
                return null;
            }
            var spaceCenter = Rp1Types.StaticValue(_spaceCenter!, "Instance");
            if (spaceCenter == null)
            {
                _lastSpaceCenter = null;
                _lastRefresh = null;
                _lastSignature = null;
                _cached = null;
                return null;
            }

            var maintenance = _maintenance == null ? null : Rp1Types.StaticValue(_maintenance, "Instance");
            var refreshed = Rp1Types.ReadDouble(maintenance, "lastUpdate");
            var head = Head(spaceCenter);
            var signature = Signature(spaceCenter, head);
            if (_cached != null && ReferenceEquals(spaceCenter, _lastSpaceCenter)
                && refreshed == _lastRefresh && signature == _lastSignature)
            {
                return _cached;
            }

            _cached = Read(spaceCenter, head, ut);
            _lastSpaceCenter = spaceCenter;
            _lastRefresh = refreshed;
            _lastSignature = signature;
            return _cached;
        }

        private static object? Head(object spaceCenter)
        {
            foreach (var project in Rp1Types.Enumerate(Rp1Types.Member(spaceCenter, "TechList")))
            {
                return project;
            }
            return null;
        }

        /// <summary>
        /// Everything the table depends on apart from progress, which moves every
        /// tick and changes no pay or credit.
        /// </summary>
        private static string Signature(object spaceCenter, object? head) =>
            Number(Rp1Types.ReadDouble(spaceCenter, "Researchers")) + ";"
            + (head == null
                ? "-"
                : Rp1Types.ReadString(head, "techID") + "|"
                    + Number(Rp1Types.ReadDouble(head, "workRate")) + "|"
                    + Number(Rp1Types.ReadDouble(head, "_buildRate")) + "|"
                    + Number(Rp1Types.ReadDouble(head, "scienceCost")));

        private static string Number(double? value) =>
            value == null ? "-" : value.Value.ToString("R", CultureInfo.InvariantCulture);

        private Rp1ResearchRatesRaw Read(object spaceCenter, object? head, double ut)
        {
            var raw = new Rp1ResearchRatesRaw { RefreshedAt = ut };
            if (head == null)
            {
                return raw;
            }
            raw.TechId = Rp1Types.ReadString(head, "techID");

            var settings = Rp1Types.StaticValue(_database!, "SettingsSC");
            var researchers = Rp1Types.ReadDouble(spaceCenter, "Researchers");
            var salary = Rp1Types.ReadDouble(settings, "salaryResearchers");
            var idle = Rp1Types.ReadDouble(settings, "ResearcherIdleSalaryMult");
            var creditPerDayAtFull = CreditPerDayAtFullRate(settings, researchers, salary);

            // _buildRate is -1 until RP-1 costs the node, and a negative rate is
            // no rate at all.
            var buildRate = Rp1Types.ReadDouble(head, "_buildRate");
            var remaining = Rp1Types.ReadDouble(head, "scienceCost") - Rp1Types.ReadDouble(head, "progress");

            for (var step = 0; step <= Rp1ResearchRateCommands.Steps; step++)
            {
                var workRate = Rp1ResearchRateCommands.RateAt(step);
                var row = new Rp1ResearchRateStepRaw { WorkRate = workRate };
                if (researchers != null && salary != null && idle != null)
                {
                    var paid = researchers.Value * salary.Value / DaysPerYear * (idle.Value + (1d - idle.Value) * workRate);
                    var modified = Funds("SalaryResearchers", -paid);
                    row.ResearcherSalaryPerDay = modified == null ? null : Finite(-modified.Value);
                }
                row.UnlockCreditPerDay = step == 0 ? 0d : Finite(creditPerDayAtFull * workRate);
                if (step > 0 && buildRate > 0 && remaining != null)
                {
                    row.FinishesAt = Finite(ut + Math.Max(0d, remaining.Value) / (buildRate!.Value * workRate));
                }
                raw.Steps.Add(row);
            }
            return raw;
        }

        /// <summary>
        /// CreditForTime's arithmetic over one day at the full rate, with the
        /// Unlock Credit rate modifier applied, or null when any part of it will
        /// not read.
        /// </summary>
        private double? CreditPerDayAtFullRate(object? settings, double? researchers, double? salary)
        {
            var handler = _unlockCredit == null ? null : Rp1Types.StaticValue(_unlockCredit, "Instance");
            var creditRate = Rp1Types.ReadDouble(handler, "_unlockCredRate");
            var tiers = Rp1Types.Member(settings, "researchersToUnlockCreditSalaryMultipliers");
            if (creditRate == null || researchers == null || salary == null || tiers == null)
            {
                return null;
            }

            // Each researcher earns at the multiplier of the tier it falls in,
            // walked in key order as RP-1's sorted list enumerates.
            var counted = 0;
            var weighted = 0d;
            foreach (var tier in Rp1Types.Enumerate(tiers))
            {
                if (counted >= researchers.Value)
                {
                    break;
                }
                var key = Rp1Types.ToDouble(Rp1Types.Member(tier, "Key"));
                var multiplier = Rp1Types.ToDouble(Rp1Types.Member(tier, "Value"));
                if (key == null || multiplier == null)
                {
                    return null;
                }
                var take = Math.Min((int)key.Value - counted, (int)researchers.Value - counted);
                weighted += take * multiplier.Value;
                counted += take;
            }

            var modifier = Rate("RateUnlockCreditIncrease");
            return modifier == null
                ? null
                : Finite(SecondsPerDay * creditRate.Value * salary.Value / (DaysPerYear * SecondsPerDay) * weighted * modifier.Value);
        }

        private double? Funds(string reason, double amount)
        {
            try
            {
                return Finite(Rp1Types.ToDouble(_funds!.Invoke(null, new object[] { Enum.Parse(_transactionReasons!, reason), amount, false })));
            }
            catch (Exception)
            {
                return null;
            }
        }

        private double? Rate(string reason)
        {
            try
            {
                return Finite(Rp1Types.ToDouble(_rate!.Invoke(null, new object[] { Enum.Parse(_transactionReasons!, reason), false })));
            }
            catch (Exception)
            {
                return null;
            }
        }

        private static double? Finite(double? value) =>
            value == null || double.IsNaN(value.Value) || double.IsInfinity(value.Value) ? null : value;
    }

    public sealed class Rp1ResearchRatesRaw
    {
        public double? RefreshedAt;
        public string? TechId;
        public List<Rp1ResearchRateStepRaw> Steps = new List<Rp1ResearchRateStepRaw>();
    }

    public sealed class Rp1ResearchRateStepRaw
    {
        public double WorkRate;
        public double? ResearcherSalaryPerDay;
        public double? UnlockCreditPerDay;
        public double? FinishesAt;
    }
}
