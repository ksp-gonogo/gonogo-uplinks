/*
 * RP-1's own budget, asked the way RP-1's own screens ask it. No compile-time
 * reference to RP0.dll, the same arm's-length reflection pattern as
 * Rp1ScReflection, whose header carries the provenance rules this file follows.
 *
 * PROVENANCE. Every member below was checked against an ilspycmd disassembly of
 * the SHIPPED RP-1 v4.6.0.0 RP0.dll, and every derivation was copied from the
 * v4.6.0.0 source it was built from. Nothing here has been seen in a running
 * game.
 *
 * THREE OF RP-1'S SCREENS, reproduced rather than approximated:
 *
 *   SpaceCenterManagement.GetBudgetDelta(dt)
 *       Public, and CALLED rather than reproduced. The net the funds widget's
 *       tooltip quotes at a day, 30 days and 365.25 days, and the gain or loss
 *       every Warp To button prints. RP-1 declines to quote it beyond five
 *       years (GUI_BuildList drops the tooltip past 86400 * 365.25 * 5), which
 *       is where the forecast stops.
 *
 *   MaintenanceGUI.RenderSummaryTab
 *       The Budget tab. Its rows are computed inline in an OnGUI method, so they
 *       are reproduced line for line, calling the same public RP-1 members with
 *       the same arguments: one CurrencyUtils.Funds query per upkeep line scaled
 *       by the period's day count BEFORE the query (so a post-multiplier delta
 *       lands once per row, as it does there), the subsidy averaged over the
 *       period and put through the Subsidy query, the net clamped at zero, and
 *       the Unlock Credit accrual walked across the research queue.
 *
 *   PatchReputationWidget.GetTooltipTextRep
 *       The reputation tooltip: the subsidy floor, ceiling and current figure
 *       each through the Subsidy query, the reputation at which the ceiling is
 *       reached, and the decay per day and over a year, compounding monthly.
 *
 * TWO FIGURES NO RP-1 SCREEN PRINTS, carried beside the tab's rows: the four
 * upkeep rows' own total (the running sum RenderSummaryTab adds the subsidy to),
 * and the same upkeep with no currency query run, from the seven raw
 * MaintenanceHandler costs UpdateUpkeep builds. Their difference is what the
 * career's Strategies change in upkeep: the only listener RP-1 registers on the
 * currency query is the leader effect CurrencyModifier.
 *
 * MAIN THREAD, AND WHY. Every one of those runs CurrencyModifierQueryRP0, which
 * fires GameEvents.Modifiers.OnCurrencyModifierQuery at every modifier in the
 * save, and several read Planetarium. Firing a Unity game event into arbitrary
 * third-party listeners from the Courier thread is not a thing to do at any
 * cadence.
 *
 * AT RP-1'S UPKEEP CADENCE. The capture recomputes only when
 * MaintenanceHandler.lastUpdate moves, which MaintenanceHandler.Update writes
 * each time it runs UpdateUpkeep: every in-game hour below 100x warp, up to a
 * day above it, never inside a simulated flight, and at once when RP-1 is told
 * its maintenance changed. A tick in between costs two reads and no query. That
 * is the cadence RP-1 refreshes the upkeep its own tab prices from; the tab
 * redraws the constructions, rollouts and Program rows every frame, so those
 * three rows here can trail the game's by up to that interval.
 *
 * COST. One refresh is roughly 700 currency queries, nearly all of them the
 * forecast: GetBudgetDelta averages the subsidy over one sample a month, so
 * twenty horizons out to five years sum to about 650 reputation queries.
 * Below 100x warp that is once per in-game hour.
 */
using System;
using System.Collections.Generic;
using System.Reflection;

namespace GonogoRp1Uplink
{
    /// <summary>
    /// Reads RP-1's budget on the main thread, recomputing only when RP-1 has
    /// refreshed its upkeep since the last read.
    /// </summary>
    public sealed class Rp1BudgetReflection
    {
        private const double SecondsPerDay = 86400d;

        /// <summary>RP-1's Julian year, the one its subsidy curve and its Year column use.</summary>
        private const double DaysPerYear = 365.25d;

        /// <summary>RP-1's Month column: thirty days, not a calendar month.</summary>
        private const double DaysPerMonth = 30d;

        /// <summary>Forecast points, a quarter of a Julian year apart, ending at the five years RP-1 itself quotes to.</summary>
        private const int ForecastSamples = 20;

        private const string MaintenanceTypeName = "RP0.MaintenanceHandler";
        private const string SpaceCenterTypeName = "RP0.SpaceCenterManagement";
        private const string ProgramHandlerTypeName = "RP0.Programs.ProgramHandler";
        private const string UnlockCreditTypeName = "RP0.UnlockCreditHandler";
        private const string CurrencyUtilsTypeName = "RP0.CurrencyUtils";
        private const string TransactionReasonsTypeName = "RP0.TransactionReasonsRP0";
        private const string DatabaseTypeName = "RP0.Database";
        private const string ResearchProjectTypeName = "RP0.ResearchProject";

        /// <summary>KSP's own, global-namespaced.</summary>
        private const string ReputationTypeName = "Reputation";

        private readonly Type? _maintenance;
        private readonly Type? _subsidyDetails;
        private readonly Type? _spaceCenter;
        private readonly Type? _programHandler;
        private readonly Type? _unlockCredit;
        private readonly Type? _transactionReasons;
        private readonly Type? _database;
        private readonly Type? _reputation;
        private readonly MethodInfo? _funds;
        private readonly MethodInfo? _rep;
        private readonly MethodInfo? _rate;
        private readonly MethodInfo? _averageSubsidy;
        private readonly MethodInfo? _fillSubsidyDetails;
        private readonly MethodInfo? _budgetDelta;
        private readonly MethodInfo? _constructionCost;
        private readonly MethodInfo? _rolloutCost;
        private readonly MethodInfo? _programFunding;
        private readonly MethodInfo? _creditForTime;
        private readonly MethodInfo? _timeLeftEstimate;

        private object? _lastMaintenance;
        private double? _lastRefresh;
        private Rp1BudgetRaw? _cached;

        public Rp1BudgetReflection()
        {
            _maintenance = Rp1Types.Find(MaintenanceTypeName);
            _subsidyDetails = Rp1Types.Find(MaintenanceTypeName + "+SubsidyDetails");
            _spaceCenter = Rp1Types.Find(SpaceCenterTypeName);
            _programHandler = Rp1Types.Find(ProgramHandlerTypeName);
            _unlockCredit = Rp1Types.Find(UnlockCreditTypeName);
            _transactionReasons = Rp1Types.Find(TransactionReasonsTypeName);
            _database = Rp1Types.Find(DatabaseTypeName);
            _reputation = Rp1Types.Find(ReputationTypeName);

            var currency = Rp1Types.Find(CurrencyUtilsTypeName);
            if (currency != null)
            {
                // Every one with includeHidden last and defaulted, which a
                // reflected call does not supply, so it is passed explicitly.
                _funds = Rp1Types.StaticMethod(currency, "Funds", 3);
                _rep = Rp1Types.StaticMethod(currency, "Rep", 3);
                _rate = Rp1Types.StaticMethod(currency, "Rate", 2);
            }
            if (_maintenance != null)
            {
                _averageSubsidy = Rp1Types.StaticMethod(_maintenance, "GetAverageSubsidyForPeriod", 2);
                _fillSubsidyDetails = Rp1Types.StaticMethod(_maintenance, "FillSubsidyDetails", 3);
            }

            // Arity one picks the career-wide overload of both cost methods: the
            // per-centre, per-complex and by-name ones all take two.
            _budgetDelta = Rp1Types.MostDerivedInstanceMethod(_spaceCenter, "GetBudgetDelta", 1);
            _constructionCost = Rp1Types.MostDerivedInstanceMethod(_spaceCenter, "GetConstructionCostOverTime", 1);
            _rolloutCost = Rp1Types.MostDerivedInstanceMethod(_spaceCenter, "GetReconRolloutCostOverTime", 1);
            _programFunding = Rp1Types.MostDerivedInstanceMethod(_programHandler, "GetDisplayProgramFunding", 1);
            _creditForTime = Rp1Types.MostDerivedInstanceMethod(_unlockCredit, "CreditForTime", 1);
            _timeLeftEstimate = Rp1Types.MostDerivedInstanceMethod(Rp1Types.Find(ResearchProjectTypeName), "GetTimeLeftEst", 1);
        }

        /// <summary>
        /// The four things without which no row can be priced. Everything else
        /// missing costs its own rows only.
        /// </summary>
        public bool IsAvailable =>
            _maintenance != null && _spaceCenter != null && _funds != null && _transactionReasons != null;

        /// <summary>
        /// MAIN-THREAD read. Null when RP-1 is not running a career in this
        /// scene; otherwise the last reading, recomputed if RP-1 has refreshed
        /// its upkeep since.
        /// </summary>
        public Rp1BudgetRaw? CaptureOnMain(double ut)
        {
            if (!IsAvailable)
            {
                return null;
            }
            var maintenance = Rp1Types.StaticValue(_maintenance!, "Instance");
            var spaceCenter = Rp1Types.StaticValue(_spaceCenter!, "Instance");
            if (maintenance == null || spaceCenter == null)
            {
                // Cleared rather than held, so the next career loaded does not
                // inherit this one's budget.
                _lastMaintenance = null;
                _lastRefresh = null;
                _cached = null;
                return null;
            }

            // The instance is part of the key because a newly loaded save builds
            // a new handler whose refresh stamp can match the old one's.
            var refreshed = Rp1Types.ReadDouble(maintenance, "lastUpdate");
            if (_cached != null && ReferenceEquals(maintenance, _lastMaintenance) && refreshed == _lastRefresh)
            {
                return _cached;
            }

            _cached = Read(maintenance, spaceCenter, ut, refreshed);
            _lastMaintenance = maintenance;
            _lastRefresh = refreshed;
            return _cached;
        }

        private Rp1BudgetRaw Read(object maintenance, object spaceCenter, double ut, double? refreshed)
        {
            var programs = _programHandler == null ? null : Rp1Types.StaticValue(_programHandler, "Instance");
            var credit = _unlockCredit == null ? null : Rp1Types.StaticValue(_unlockCredit, "Instance");

            var raw = new Rp1BudgetRaw
            {
                RefreshedAt = refreshed,
                Day = Period(maintenance, spaceCenter, programs, credit, 1d),
                Month = Period(maintenance, spaceCenter, programs, credit, DaysPerMonth),
                Year = Period(maintenance, spaceCenter, programs, credit, DaysPerYear),
                UnlockCreditBalance = credit == null ? null : Finite(Rp1Types.ReadDouble(credit, "TotalCredit")),
                Forecast = Forecast(spaceCenter),
            };
            ReadReputation(raw, ut);
            return raw;
        }

        /// <summary>One column of the Budget tab, as RenderSummaryTab computes it for this many days.</summary>
        private Rp1BudgetPeriodRaw Period(object maintenance, object spaceCenter, object? programs, object? credit, double days)
        {
            var span = days * SecondsPerDay;

            var facilities = Add(
                Upkeep("StructureRepair", Rp1Types.ReadDouble(maintenance, "FacilityUpkeepPerDay"), days),
                Upkeep("StructureRepairLC", Rp1Types.ReadDouble(maintenance, "LCsCostPerDay"), days));
            var integration = Upkeep("SalaryEngineers", Rp1Types.ReadDouble(maintenance, "IntegrationSalaryPerDay"), days);
            var research = Upkeep("SalaryResearchers", Rp1Types.ReadDouble(maintenance, "ResearchSalaryPerDay"), days);
            // Two SalaryCrew queries, not one on the sum, because that is how the
            // tab prices this row. UpdateUpkeep runs one, which is why FundsDelta
            // can differ from Balance.
            var astronauts = Add(
                Add(
                    Upkeep("SalaryCrew", Rp1Types.ReadDouble(maintenance, "NautBaseUpkeepPerDay"), days),
                    Upkeep("SalaryCrew", Rp1Types.ReadDouble(maintenance, "NautInFlightUpkeepPerDay"), days)),
                Upkeep("CrewTraining", Rp1Types.ReadDouble(maintenance, "TrainingUpkeepPerDay"), days));

            // The running total RenderSummaryTab adds the subsidy to. The tab
            // never prints it; it is carried so the operator has one upkeep figure.
            var upkeep = Add(Add(facilities, integration), Add(research, astronauts));
            var beforeModifiers = UpkeepBeforeModifiers(maintenance, days);

            var subsidy = Subsidy(span, days);
            var net = Add(upkeep, subsidy);
            if (net != null)
            {
                net = Math.Min(0d, net.Value);
            }

            var rollout = Call(_rolloutCost, spaceCenter, span);
            var constructions = Call(_constructionCost, spaceCenter, span);
            var programBudget = Call(_programFunding, programs, span);

            return new Rp1BudgetPeriodRaw
            {
                Span = span,
                FundsDelta = Call(_budgetDelta, spaceCenter, span),
                Facilities = facilities,
                IntegrationTeams = integration,
                ResearchTeams = research,
                Astronauts = astronauts,
                Upkeep = upkeep,
                UpkeepBeforeModifiers = beforeModifiers,
                UpkeepModifiers = upkeep == null || beforeModifiers == null ? null : upkeep.Value - beforeModifiers.Value,
                Subsidy = subsidy,
                Net = net,
                Rollout = rollout,
                Constructions = constructions,
                ProgramBudget = programBudget,
                Balance = Add(Add(programBudget, net), Add(constructions, rollout)),
                UnlockCredit = UnlockCreditAccrual(spaceCenter, credit, span),
            };
        }

        /// <summary>
        /// The same seven MaintenanceHandler costs the upkeep rows price, over the
        /// period with no currency query run on them: what the upkeep would be
        /// with no leader or strategy modifying it. Absent when any one is.
        /// </summary>
        private static double? UpkeepBeforeModifiers(object maintenance, double days)
        {
            double? sum = 0d;
            foreach (var field in RawUpkeepFields)
            {
                sum = Add(sum, Rp1Types.ReadDouble(maintenance, field));
            }
            return sum == null ? null : Finite(-sum.Value * days);
        }

        private static readonly string[] RawUpkeepFields =
        {
            "FacilityUpkeepPerDay",
            "LCsCostPerDay",
            "IntegrationSalaryPerDay",
            "ResearchSalaryPerDay",
            "NautBaseUpkeepPerDay",
            "NautInFlightUpkeepPerDay",
            "TrainingUpkeepPerDay",
        };

        /// <summary>One upkeep line over the period, priced after scaling as the tab prices it.</summary>
        private double? Upkeep(string reason, double? perDay, double days) =>
            perDay == null ? null : Funds(reason, -perDay.Value * days);

        /// <summary>The Avg. Subsidy row: averaged across the period, then queried, then scaled from a year to the period.</summary>
        private double? Subsidy(double span, double days)
        {
            if (_averageSubsidy == null)
            {
                return null;
            }
            try
            {
                // Zero steps is RP-1's own default, one sample a month.
                var average = Rp1Types.ToDouble(_averageSubsidy.Invoke(null, new object[] { span, 0 }));
                var queried = average == null ? null : Funds("Subsidy", average.Value);
                return queried == null ? null : Finite(queried.Value * (days / DaysPerYear));
            }
            catch (Exception)
            {
                return null;
            }
        }

        /// <summary>
        /// The Unlock Credit row: the credit the research queue earns over the
        /// period, walked node by node for as long as each takes, as the tab
        /// walks it. A node already being researched finishes in its TimeLeft;
        /// one waiting its turn is estimated as of the time it would start.
        /// </summary>
        private double? UnlockCreditAccrual(object spaceCenter, object? credit, double span)
        {
            if (credit == null || _rate == null || _creditForTime == null)
            {
                return null;
            }
            try
            {
                var accrued = 0d;
                var elapsed = 0d;
                foreach (var tech in Rp1Types.Enumerate(Rp1Types.Member(spaceCenter, "TechList")))
                {
                    if (elapsed >= span)
                    {
                        break;
                    }
                    var buildRate = Rp1Types.ReadDouble(tech, "BuildRate");
                    if (buildRate == null)
                    {
                        return null;
                    }
                    double? buildTime;
                    if (buildRate.Value > 0d)
                    {
                        buildTime = Rp1Types.ReadDouble(tech, "TimeLeft");
                    }
                    else
                    {
                        buildTime = Call(_timeLeftEstimate, tech, elapsed);
                    }
                    if (buildTime == null)
                    {
                        return null;
                    }
                    var time = Math.Min(buildTime.Value, span - elapsed);
                    if (time <= 0d)
                    {
                        continue;
                    }
                    var earned = Call(_creditForTime, credit, time);
                    if (earned == null)
                    {
                        return null;
                    }
                    accrued += earned.Value;
                    elapsed += time;
                }
                var rate = Rp1Types.ToDouble(_rate.Invoke(null, new object[] { Reason("RateUnlockCreditIncrease"), false }));
                return rate == null ? null : Finite(rate.Value * accrued);
            }
            catch (Exception)
            {
                return null;
            }
        }

        /// <summary>GetBudgetDelta at each forecast horizon, all or none.</summary>
        private List<Rp1BudgetForecastRaw>? Forecast(object spaceCenter)
        {
            var step = DaysPerYear / 4d * SecondsPerDay;
            var samples = new List<Rp1BudgetForecastRaw>(ForecastSamples);
            for (var i = 1; i <= ForecastSamples; i++)
            {
                var horizon = step * i;
                var delta = Call(_budgetDelta, spaceCenter, horizon);
                if (delta == null)
                {
                    return null;
                }
                samples.Add(new Rp1BudgetForecastRaw { Horizon = horizon, FundsDelta = delta.Value });
            }
            return samples;
        }

        /// <summary>The reputation tooltip's figures, at this reading's instant and reputation.</summary>
        private void ReadReputation(Rp1BudgetRaw raw, double ut)
        {
            var instance = _reputation == null ? null : Rp1Types.StaticValue(_reputation, "Instance");
            var rep = instance == null ? null : Rp1Types.ReadDouble(instance, "reputation");
            if (rep == null)
            {
                // Every figure below is a function of reputation, and one computed
                // from an assumed reputation would be a claim about the operator's
                // income that nothing measured.
                return;
            }
            raw.Reputation = rep;

            FillSubsidy(raw, ut, rep.Value);

            var settings = _database == null ? null : Rp1Types.StaticValue(_database, "SettingsSC");
            var portion = settings == null ? null : Rp1Types.ReadDouble(settings, "repPortionLostPerDay");
            if (portion == null)
            {
                return;
            }
            var perDay = Decay(rep.Value, portion.Value);
            raw.ReputationDecayPerDay = perDay;
            raw.ReputationDecayPerYear = perDay == null ? null : DecayOverYear(rep.Value, portion.Value, perDay.Value);
        }

        private void FillSubsidy(Rp1BudgetRaw raw, double ut, double rep)
        {
            if (_fillSubsidyDetails == null || _subsidyDetails == null)
            {
                return;
            }
            try
            {
                // A ref struct travels boxed in the args array: the method writes
                // into the box and the box is read back.
                var args = new object?[] { Activator.CreateInstance(_subsidyDetails), ut, rep };
                _fillSubsidyDetails.Invoke(null, args);
                var details = args[0];
                raw.SubsidyPerDay = SubsidyPerDay(Rp1Types.ReadDouble(details, "subsidy"));
                raw.SubsidyMinPerDay = SubsidyPerDay(Rp1Types.ReadDouble(details, "minSubsidy"));
                raw.SubsidyMaxPerDay = SubsidyPerDay(Rp1Types.ReadDouble(details, "maxSubsidy"));
                raw.SubsidyMaxRep = Finite(Rp1Types.ReadDouble(details, "maxRep"));
            }
            catch (Exception)
            {
                // fail-soft: the four subsidy figures stay absent together
            }
        }

        /// <summary>A yearly subsidy through the Subsidy query, then over RP-1's Julian year.</summary>
        private double? SubsidyPerDay(double? perYear)
        {
            var queried = perYear == null ? null : Funds("Subsidy", perYear.Value);
            return queried == null ? null : Finite(queried.Value / DaysPerYear);
        }

        /// <summary>Tomorrow's loss after the career's modifiers, as a positive amount.</summary>
        private double? Decay(double rep, double portion)
        {
            var delta = RepQuery(-rep * portion);
            return delta == null ? null : -delta.Value;
        }

        /// <summary>
        /// The tooltip's year: five and a quarter days at today's rate, then
        /// twelve thirty-day months each priced at the reputation left after the
        /// last.
        /// </summary>
        private double? DecayOverYear(double rep, double portion, double perDay)
        {
            var total = perDay * 5.25d;
            var running = rep - total;
            for (var i = 0; i < 12; i++)
            {
                var delta = RepQuery(-running * portion);
                if (delta == null)
                {
                    return null;
                }
                var loss = -delta.Value * 30d;
                running -= loss;
                total += loss;
            }
            return Finite(total);
        }

        private double? RepQuery(double amount)
        {
            if (_rep == null)
            {
                return null;
            }
            try
            {
                return Finite(Rp1Types.ToDouble(_rep.Invoke(null, new object[] { Reason("DailyRepDecline"), amount, false })));
            }
            catch (Exception)
            {
                return null;
            }
        }

        private double? Funds(string reason, double amount)
        {
            try
            {
                return Finite(Rp1Types.ToDouble(_funds!.Invoke(null, new object[] { Reason(reason), amount, false })));
            }
            catch (Exception)
            {
                return null;
            }
        }

        /// <summary>A one-argument RP-1 instance method taking a time span, or null if it will not answer.</summary>
        private static double? Call(MethodInfo? method, object? target, double span)
        {
            if (method == null || target == null)
            {
                return null;
            }
            try
            {
                return Finite(Rp1Types.ToDouble(method.Invoke(target, new object[] { span })));
            }
            catch (Exception)
            {
                return null;
            }
        }

        private object Reason(string name) => Enum.Parse(_transactionReasons!, name);

        /// <summary>A sum that is absent when either part is, so a total never quietly omits a row.</summary>
        private static double? Add(double? a, double? b) => a == null || b == null ? null : a.Value + b.Value;

        /// <summary>
        /// A number JSON can carry. RP-1's own screens print NaN or Infinity where
        /// a rate is zero; here that is an absent figure.
        /// </summary>
        private static double? Finite(double? value) =>
            value == null || double.IsNaN(value.Value) || double.IsInfinity(value.Value) ? null : value;
    }
}
