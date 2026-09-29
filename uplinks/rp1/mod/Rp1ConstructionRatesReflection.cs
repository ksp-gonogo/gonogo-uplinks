/*
 * What each construction would draw per day and when it would finish at every
 * work rate RP-1's slider offers, and what each facility's next tier would draw
 * and take at the full rate. No compile-time reference to RP0.dll, the same
 * arm's-length reflection pattern as Rp1BudgetReflection, whose header carries
 * the thread and provenance rules this file follows.
 *
 * PROVENANCE. Every member below was checked against an ilspycmd disassembly of
 * the SHIPPED RP-1 v4.6.0.0 and v4.7.0.0 RP0.dll, which agree on all of them,
 * and HermiteCurve.Evaluate against the installed ROUtils.dll. Nothing here has
 * been seen in a running game.
 *
 * THE DRAW IS RP-1'S OWN "Cost/day", from KCT_GUI.RenderConstructionList:
 *
 *     GetBuildRate() * 86400 / BP
 *         * -CurrencyUtils.Funds(reason, -cost * RushMultiplier)
 *
 * where GetBuildRate() is the costed _buildRate times workRate, RushMultiplier
 * is 1 at or below the full rate and SettingsSC.ConstructionRushCost.Evaluate
 * (workRate) above it, and the reason is StructureConstructionLC for a complex
 * or a pad and StructureConstruction for a building. Here it is evaluated at
 * each slider step in place of the stored workRate. _buildRate is read rather
 * than GetBuildRate() called, for the reason Rp1ScReflection gives: the getter
 * writes it and memoises a centre. HermiteCurve.Evaluate is a clamped cubic over
 * the curve's own ranges and writes nothing.
 *
 * A FACILITY'S NEXT TIER is priced as Rp1FacilityUpgradeCommands queues it: the
 * config tier cost and the cumulative cost of the tiers below, both scaled by
 * the career's FundsLossMultiplier, through Formula.GetConstructionBP for the
 * build points and Formula.GetConstructionBuildRate for the rate a new project
 * would be costed at. The latter is one CurrencyUtils.Rate query times the
 * difficulty's build rate, and ignores its index, so it is the rate the project
 * would run at wherever it sat in the list.
 *
 * AT RP-1'S UPKEEP CADENCE, as rp1.budget, and again whenever the set of
 * constructions, any of their rates or prices, or the active centre changes, so
 * a construction just queued or re-rated is priced on the next tick rather than
 * up to an hour later. A finish date at a rate other than the current one
 * drifts by at most that hour's difference in progress, which on a build of
 * months is no difference an operator can see.
 *
 * COST. Thirty currency queries a construction, one a facility.
 */
using System;
using System.Collections;
using System.Collections.Generic;
using System.Globalization;
using System.Reflection;
using System.Text;

namespace GonogoRp1Uplink
{
    /// <summary>
    /// Reads the construction rate tables on the main thread, recomputing only
    /// when RP-1 has refreshed its upkeep or the constructions have changed.
    /// </summary>
    public sealed class Rp1ConstructionRatesReflection
    {
        private const double SecondsPerDay = 86400d;

        private const string MaintenanceTypeName = "RP0.MaintenanceHandler";
        private const string SpaceCenterTypeName = "RP0.SpaceCenterManagement";
        private const string CurrencyUtilsTypeName = "RP0.CurrencyUtils";
        private const string TransactionReasonsTypeName = "RP0.TransactionReasonsRP0";
        private const string DatabaseTypeName = "RP0.Database";
        private const string FormulaTypeName = "RP0.Formula";
        private const string KctUtilitiesTypeName = "RP0.KCTUtilities";

        /// <summary>KSP's own, global-namespaced.</summary>
        private const string HighLogicTypeName = "HighLogic";

        private readonly Type? _maintenance;
        private readonly Type? _spaceCenter;
        private readonly Type? _transactionReasons;
        private readonly Type? _database;
        private readonly Type? _highLogic;
        private readonly MethodInfo? _funds;
        private readonly MethodInfo? _constructionBp;
        private readonly MethodInfo? _constructionRate;
        private readonly MethodInfo? _facilityLevel;

        private object? _lastSpaceCenter;
        private double? _lastRefresh;
        private string? _lastSignature;
        private Rp1ConstructionRatesRaw? _cached;

        public Rp1ConstructionRatesReflection()
        {
            _maintenance = Rp1Types.Find(MaintenanceTypeName);
            _spaceCenter = Rp1Types.Find(SpaceCenterTypeName);
            _transactionReasons = Rp1Types.Find(TransactionReasonsTypeName);
            _database = Rp1Types.Find(DatabaseTypeName);
            _highLogic = Rp1Types.Find(HighLogicTypeName);

            var currency = Rp1Types.Find(CurrencyUtilsTypeName);
            if (currency != null)
            {
                // includeHidden is last and defaulted, which a reflected call
                // does not supply, so it is passed explicitly.
                _funds = Rp1Types.StaticMethod(currency, "Funds", 3);
            }
            var formula = Rp1Types.Find(FormulaTypeName);
            if (formula != null)
            {
                _constructionBp = Rp1Types.StaticMethod(formula, "GetConstructionBP", 3);
                _constructionRate = Rp1Types.StaticMethod(formula, "GetConstructionBuildRate", 3);
            }
            var kct = Rp1Types.Find(KctUtilitiesTypeName);
            if (kct != null)
            {
                _facilityLevel = Rp1Types.StaticMethod(kct, "GetFacilityLevel", 1);
            }
        }

        /// <summary>The three things without which nothing can be priced.</summary>
        public bool IsAvailable => _spaceCenter != null && _funds != null && _transactionReasons != null;

        /// <summary>
        /// MAIN-THREAD read. Null when RP-1 is not running a career in this
        /// scene; otherwise the last reading, recomputed if anything it depends
        /// on has moved.
        /// </summary>
        public Rp1ConstructionRatesRaw? CaptureOnMain(double ut)
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
            var signature = Signature(spaceCenter);
            if (_cached != null && ReferenceEquals(spaceCenter, _lastSpaceCenter)
                && refreshed == _lastRefresh && signature == _lastSignature)
            {
                return _cached;
            }

            _cached = new Rp1ConstructionRatesRaw
            {
                RefreshedAt = ut,
                Constructions = Constructions(spaceCenter, ut),
                FacilityUpgrades = FacilityUpgrades(spaceCenter),
            };
            _lastSpaceCenter = spaceCenter;
            _lastRefresh = refreshed;
            _lastSignature = signature;
            return _cached;
        }

        /// <summary>
        /// Everything a table depends on apart from progress, which moves every
        /// tick and changes no draw.
        /// </summary>
        private static string Signature(object spaceCenter)
        {
            var sb = new StringBuilder();
            sb.Append(Rp1Types.ReadString(Rp1Types.Member(spaceCenter, "ActiveSC"), "KSCName")).Append(';');
            foreach (var (project, kind) in Rp1ConstructionIds.All(spaceCenter))
            {
                sb.Append(kind).Append('|')
                    .Append(Rp1ConstructionIds.Of(project, kind)).Append('|')
                    .Append(Number(Rp1Types.ReadDouble(project, "workRate"))).Append('|')
                    .Append(Number(Rp1Types.ReadDouble(project, "_buildRate"))).Append('|')
                    .Append(Number(Rp1Types.ReadDouble(project, "BP"))).Append('|')
                    .Append(Number(Rp1Types.ReadDouble(project, "cost"))).Append(';');
            }
            return sb.ToString();
        }

        private static string Number(double? value) =>
            value == null ? "-" : value.Value.ToString("R", CultureInfo.InvariantCulture);

        private List<Rp1ConstructionRateTableRaw> Constructions(object spaceCenter, double ut)
        {
            var rush = RushCurve();
            var rows = new List<Rp1ConstructionRateTableRaw>();
            foreach (var (project, kind) in Rp1ConstructionIds.All(spaceCenter))
            {
                var id = Rp1ConstructionIds.Of(project, kind);
                if (id == null)
                {
                    continue;
                }
                rows.Add(new Rp1ConstructionRateTableRaw { Id = id, Steps = Steps(project, rush, ut) });
            }
            return rows;
        }

        /// <summary>Every slider step, from a stopped project to the fastest rush.</summary>
        private List<Rp1ConstructionRateStepRaw> Steps(object project, Func<double, double?> rush, double ut)
        {
            // _buildRate is -1 until RP-1 costs the project, and a negative rate
            // is no rate at all.
            var baseRate = Rp1Types.ReadDouble(project, "_buildRate");
            if (baseRate < 0)
            {
                baseRate = null;
            }
            var bp = Rp1Types.ReadDouble(project, "BP");
            var progress = Rp1Types.ReadDouble(project, "progress");
            var cost = Rp1Types.ReadDouble(project, "cost");
            var reason = ReasonFor(Rp1Types.ReadEnumName(project, "FacilityType"));
            var costed = baseRate != null && bp > 0 && cost != null;

            var steps = new List<Rp1ConstructionRateStepRaw>();
            var max = (int)Math.Round(Rp1ConstructionCommands.MaxWorkRate * Rp1ConstructionCommands.StepsPerUnit);
            for (var step = 0; step <= max; step++)
            {
                var workRate = Rp1ConstructionCommands.RateAt(step);
                var multiplier = workRate > 1.0 ? rush(workRate) : 1.0;
                var row = new Rp1ConstructionRateStepRaw { WorkRate = workRate, CostMultiplier = multiplier };
                if (step == 0)
                {
                    row.CostPerDay = 0;
                }
                else if (costed)
                {
                    var rate = baseRate!.Value * workRate;
                    if (multiplier != null)
                    {
                        var modified = Funds(reason, -cost!.Value * multiplier.Value);
                        row.CostPerDay = modified == null ? null : Finite(rate * SecondsPerDay / bp!.Value * -modified.Value);
                    }
                    if (rate > 0 && progress != null)
                    {
                        row.FinishesAt = Finite(ut + Math.Max(0, bp!.Value - progress.Value) / rate);
                    }
                }
                steps.Add(row);
            }
            return steps;
        }

        /// <summary>
        /// Each building RP-1 upgrades that has a tier left, priced as
        /// <see cref="Rp1FacilityUpgradeCommands"/> would queue it.
        /// </summary>
        private List<Rp1FacilityUpgradeRateRaw>? FacilityUpgrades(object spaceCenter)
        {
            if (_database == null || _facilityLevel == null || _constructionBp == null || _constructionRate == null
                || !(Rp1Types.StaticValue(_database, "FacilityLevelCosts") is IDictionary costs))
            {
                return null;
            }
            var locked = LockedFacilityNames();
            var multiplier = FundsLossMultiplier();
            var activeCentre = Rp1Types.Member(spaceCenter, "ActiveSC");

            var rows = new List<Rp1FacilityUpgradeRateRaw>();
            foreach (DictionaryEntry entry in costs)
            {
                var facility = entry.Key;
                var name = facility?.ToString();
                if (facility == null || name == null || locked == null || locked.Contains(name))
                {
                    continue;
                }
                var tiers = Rp1FacilitiesReflection.TierCosts(entry.Value);
                var tier = Call(_facilityLevel, facility) as int?;
                if (tiers == null || tier == null || tier.Value < 0 || tier.Value + 1 >= tiers.Count)
                {
                    continue;
                }

                var row = new Rp1FacilityUpgradeRateRaw { Facility = name };
                if (multiplier != null)
                {
                    var cost = tiers[tier.Value + 1] * multiplier.Value;
                    var oldCost = 0.0;
                    for (var i = 0; i <= tier.Value; i++)
                    {
                        oldCost += tiers[i];
                    }
                    oldCost *= multiplier.Value;

                    var bp = Rp1Types.ToDouble(Call(_constructionBp, cost, oldCost, facility));
                    var rate = Rp1Types.ToDouble(Call(_constructionRate, 0, activeCentre, facility));
                    if (bp > 0 && rate > 0)
                    {
                        row.BuildSeconds = Finite(bp!.Value / rate!.Value);
                        var modified = Funds(ReasonFor(name), -cost);
                        row.CostPerDay = modified == null ? null : Finite(rate.Value * SecondsPerDay / bp.Value * -modified.Value);
                    }
                }
                rows.Add(row);
            }
            return rows;
        }

        /// <summary>
        /// RP-1's rush multiplier at a work rate, or null for every rate when the
        /// curve could not be reached.
        /// </summary>
        private Func<double, double?> RushCurve()
        {
            var settings = _database == null ? null : Rp1Types.StaticValue(_database, "SettingsSC");
            var curve = Rp1Types.Member(settings, "ConstructionRushCost");
            var evaluate = curve == null ? null : Rp1Types.InstanceMethod(curve, "Evaluate", 1);
            if (evaluate == null)
            {
                return _ => null;
            }
            return workRate => Finite(Rp1Types.ToDouble(Call(evaluate, curve, workRate)));
        }

        /// <summary>The transaction reason RP-1 charges a construction of this facility type under.</summary>
        private static string ReasonFor(string? facilityType) =>
            facilityType == "LaunchPad" ? "StructureConstructionLC" : "StructureConstruction";

        /// <summary>The buildings RP-1 does not upgrade as buildings, by enum name, or null when unreadable.</summary>
        private HashSet<string>? LockedFacilityNames()
        {
            if (!(Rp1Types.StaticValue(_database!, "LockedFacilities") is IEnumerable list))
            {
                return null;
            }
            var names = new HashSet<string>();
            foreach (var facility in list)
            {
                if (facility != null)
                {
                    names.Add(facility.ToString());
                }
            }
            return names;
        }

        /// <summary>The career's funds multiplier, which scales every config tier price.</summary>
        private double? FundsLossMultiplier() =>
            _highLogic == null
                ? null
                : Rp1Types.ToDouble(
                    Rp1Types.Member(
                        Rp1Types.Member(
                            Rp1Types.Member(Rp1Types.StaticValue(_highLogic, "CurrentGame"), "Parameters"),
                            "Career"),
                        "FundsLossMultiplier"));

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

        /// <summary>A static call, or an instance call with the target first, or null if it will not answer.</summary>
        private static object? Call(MethodInfo method, params object?[] args)
        {
            try
            {
                return method.IsStatic ? method.Invoke(null, args) : method.Invoke(args[0], new[] { args[1] });
            }
            catch (Exception)
            {
                return null;
            }
        }

        private static double? Finite(double? value) =>
            value == null || double.IsNaN(value.Value) || double.IsInfinity(value.Value) ? null : value;
    }

    public sealed class Rp1ConstructionRatesRaw
    {
        public double? RefreshedAt;
        public List<Rp1ConstructionRateTableRaw>? Constructions;
        public List<Rp1FacilityUpgradeRateRaw>? FacilityUpgrades;
    }

    public sealed class Rp1ConstructionRateTableRaw
    {
        public string? Id;
        public List<Rp1ConstructionRateStepRaw> Steps = new List<Rp1ConstructionRateStepRaw>();
    }

    public sealed class Rp1ConstructionRateStepRaw
    {
        public double WorkRate;
        public double? CostMultiplier;
        public double? CostPerDay;
        public double? FinishesAt;
    }

    public sealed class Rp1FacilityUpgradeRateRaw
    {
        public string? Facility;
        public double? CostPerDay;
        public double? BuildSeconds;
    }
}
