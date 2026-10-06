/*
 * The lines under RP-1's Budget tab, asked the way RP-1's own drill-down tabs
 * ask them. No compile-time reference to RP0.dll, the same arm's-length
 * reflection pattern as Rp1BudgetReflection, whose header carries the thread,
 * cadence and provenance rules this file follows.
 *
 * PROVENANCE. Every member below was checked against an ilspycmd disassembly of
 * the SHIPPED RP-1 v4.6.0.0 RP0.dll and against the v4.7.0.0 one, and every
 * derivation was copied from the v4.6.0.0 source. MaintenanceHandler is the same
 * in both. Nothing here has been seen in a running game.
 *
 * SIX OF RP-1'S TABS AND ONE OF ITS ROWS, reproduced rather than approximated:
 *
 *   MaintenanceGUI.RenderFacilitiesTab
 *       One StructureRepair query per building in FacilitiesForMaintenance,
 *       scaled by the period's day count before the query, and one
 *       StructureRepairLC query per launch complex on the public LCUpkeep(lc).
 *       The tab skips a complex that is not operational; UpdateUpkeep bills it
 *       its construction share all the same, so it is read here too. Each
 *       centre is headed by its LocalizeSiteName, which Rp1SiteNames reproduces.
 *
 *   MaintenanceGUI.RenderIntegrationTab
 *       One SalaryEngineers query per centre on IntegrationSalaries, which
 *       UpdateKCTSalaries fills from GetEffectiveIntegrationEngineersForSalary:
 *       the centre's complexes, each through GetEffectiveEngineersForSalary,
 *       plus its unassigned engineers at EngineerIdleSalaryMult. Those terms are
 *       read live here and priced one line each with the tab's own query, so a
 *       complex's team and a centre's idle pool are lines of their own.
 *
 *   MaintenanceGUI.RenderNautList and RenderAstronautsTab
 *       GetNautCost per crew member, base and flight summed then put through
 *       one SalaryCrew query, and the tab's three total rows. The kerbals are
 *       the ones UpdateUpkeep bills: crew-type and neither dead nor missing. The
 *       tab also drops a kerbal with no retirement date, which RP-1 still pays.
 *       Beside them, the ground pay GetNautCost starts every kerbal from, at
 *       the Astronaut Complex's tier, which is what a hire adds.
 *
 *   MaintenanceHandler.UpdateUpkeep's training loop
 *       Split per course, because no tab shows it per course. Each started
 *       course is students times the Astronaut Complex's per-head fee plus the
 *       proficiency upkeep its target fills in, as UpdateUpkeep sums it. The
 *       same per-student rate is given for every template in the catalogue, so
 *       a course can be priced before the press that builds it. The fill goes
 *       through TrainingDatabase.FillBools into RP-1's own scratch list on
 *       SettingsSC, which is reset afterwards exactly as RP-1 resets it; the
 *       private GetTrainingCostFromBools between the two is reproduced.
 *       FillBools also clears TrainingDatabase's static path tracker, which is
 *       safe on the main thread because every public entry into
 *       TrainingDatabase clears it before use and none holds it across a call.
 *
 *   MaintenanceGUI.RenderConstructionTab
 *       ConstructionProject.GetConstructionCostOverTime per project in each
 *       centre's Constructions list, called rather than reproduced. The Budget
 *       tab's Constructions row is the sum of exactly these calls.
 *
 *   SpaceCenterManagement.GetReconRolloutCostOverTime(time, LaunchComplex)
 *       The Budget tab's Rollout/Airlaunch Prep row, which no tab breaks down.
 *       RP-1 has no per-operation method: this one runs a currency query per
 *       billing operation (Rollout, Reconditioning and AirlaunchMount) on its
 *       TransactionReason and sums them. Its body is reproduced one operation
 *       at a time, so the lines sum to the row whatever the modifiers.
 *
 *   MaintenanceGUI.RenderProgramTab
 *       Funds(ProgramFunding) on GetFundsForFutureTimestamp at the horizon less
 *       the same at now, per Program. The sum of these is ProgramHandler's
 *       GetProgramFunding, which is the Budget tab's Program Budget row. Each
 *       Program is headed by its title, over its deadlineUT as the Nominal
 *       Deadline.
 *
 * AT RP-1'S UPKEEP CADENCE, as rp1.budget: recomputed only when
 * MaintenanceHandler.lastUpdate moves. RP-1 refreshes FacilityMaintenanceCosts
 * and IntegrationSalaries then, and schedules a refresh the moment a kerbal's
 * status or type changes, so the upkeep lines move when RP-1's do. The Program,
 * rollout and construction lines trail the game's by up to that interval, as
 * rp1.budget's rows for them do, and are read on the same tick those rows are.
 *
 * COST. Three currency queries a line and one FillBools per distinct training
 * target: a career with thirty crew, eight complexes, three Programs and a
 * catalogue of two hundred trainings runs about 750 queries per refresh, most of
 * them the catalogue.
 */
using System;
using System.Collections;
using System.Collections.Generic;
using System.Reflection;

namespace GonogoRp1Uplink
{
    /// <summary>
    /// Reads the lines under RP-1's budget on the main thread, recomputing only
    /// when RP-1 has refreshed its upkeep since the last read.
    /// </summary>
    public sealed class Rp1BudgetBreakdownReflection
    {
        private const double SecondsPerDay = 86400d;

        /// <summary>RP-1's Julian year, the one every yearly rate in its settings is stated over.</summary>
        private const double DaysPerYear = 365.25d;

        /// <summary>RP-1's Month column: thirty days, not a calendar month.</summary>
        private const double DaysPerMonth = 30d;

        private const string MaintenanceTypeName = "RP0.MaintenanceHandler";
        private const string SpaceCenterTypeName = "RP0.SpaceCenterManagement";
        private const string ProgramHandlerTypeName = "RP0.Programs.ProgramHandler";
        private const string ProgramTypeName = "RP0.Programs.Program";
        private const string CrewHandlerTypeName = "RP0.Crew.CrewHandler";
        private const string TrainingDatabaseTypeName = "RP0.Crew.TrainingDatabase";
        private const string CurrencyUtilsTypeName = "RP0.CurrencyUtils";
        private const string TransactionReasonsTypeName = "RP0.TransactionReasonsRP0";
        private const string DatabaseTypeName = "RP0.Database";
        private const string SettingsTypeName = "RP0.SpaceCenterSettings";
        private const string KctUtilitiesTypeName = "RP0.KCTUtilities";
        private const string LaunchComplexTypeName = "RP0.LaunchComplex";

        /// <summary>KSP's own, global-namespaced.</summary>
        private const string HighLogicTypeName = "HighLogic";

        private readonly Type? _maintenance;
        private readonly Type? _spaceCenter;
        private readonly Type? _programHandler;
        private readonly Type? _crewHandler;
        private readonly Type? _transactionReasons;
        private readonly Type? _database;
        private readonly Type? _highLogic;
        private readonly MethodInfo? _funds;
        private readonly MethodInfo? _lcUpkeep;
        private readonly MethodInfo? _nautCost;
        private readonly MethodInfo? _fundsAt;
        private readonly MethodInfo? _fillBools;
        private readonly MethodInfo? _resetBools;
        private readonly MethodInfo? _facilityLevel;
        private readonly Rp1SiteNames _siteNames = new Rp1SiteNames();

        private object? _lastMaintenance;
        private double? _lastRefresh;
        private Rp1BudgetBreakdownRaw? _cached;

        public Rp1BudgetBreakdownReflection()
        {
            _maintenance = Rp1Types.Find(MaintenanceTypeName);
            _spaceCenter = Rp1Types.Find(SpaceCenterTypeName);
            _programHandler = Rp1Types.Find(ProgramHandlerTypeName);
            _crewHandler = Rp1Types.Find(CrewHandlerTypeName);
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

            // Arity one is the public LCUpkeep(LaunchComplex). The two beside it
            // take a pad count and are private.
            _lcUpkeep = Rp1Types.MostDerivedInstanceMethod(_maintenance, "LCUpkeep", 1);
            _nautCost = Rp1Types.MostDerivedInstanceMethod(_maintenance, "GetNautCost", 3);
            _fundsAt = Rp1Types.MostDerivedInstanceMethod(Rp1Types.Find(ProgramTypeName), "GetFundsForFutureTimestamp", 1);
            _resetBools = Rp1Types.MostDerivedInstanceMethod(Rp1Types.Find(SettingsTypeName), "ResetBools", 0);

            var trainingDatabase = Rp1Types.Find(TrainingDatabaseTypeName);
            if (trainingDatabase != null)
            {
                _fillBools = Rp1Types.StaticMethod(trainingDatabase, "FillBools", 3);
            }
            var kct = Rp1Types.Find(KctUtilitiesTypeName);
            if (kct != null)
            {
                _facilityLevel = Rp1Types.StaticMethod(kct, "GetFacilityLevel", 1);
            }
        }

        /// <summary>
        /// The four things without which no line can be priced. Everything else
        /// missing costs its own lines only.
        /// </summary>
        public bool IsAvailable =>
            _maintenance != null && _spaceCenter != null && _funds != null && _transactionReasons != null;

        /// <summary>
        /// MAIN-THREAD read. Null when RP-1 is not running a career in this
        /// scene; otherwise the last reading, recomputed if RP-1 has refreshed
        /// its upkeep since.
        /// </summary>
        public Rp1BudgetBreakdownRaw? CaptureOnMain(double ut)
        {
            if (!IsAvailable)
            {
                return null;
            }
            var maintenance = Rp1Types.StaticValue(_maintenance!, "Instance");
            var spaceCenter = Rp1Types.StaticValue(_spaceCenter!, "Instance");
            if (maintenance == null || spaceCenter == null)
            {
                _lastMaintenance = null;
                _lastRefresh = null;
                _cached = null;
                return null;
            }

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

        private Rp1BudgetBreakdownRaw Read(object maintenance, object spaceCenter, double ut, double? refreshed)
        {
            var settings = _database == null ? null : Rp1Types.StaticValue(_database, "SettingsSC");
            var level = AstronautComplexLevel();
            var crewHandler = _crewHandler == null ? null : Rp1Types.StaticValue(_crewHandler, "Instance");
            var training = new TrainingRates(this, settings, level);

            return new Rp1BudgetBreakdownRaw
            {
                RefreshedAt = refreshed,
                Buildings = Buildings(maintenance),
                Complexes = Complexes(maintenance, spaceCenter),
                Crew = Crew(maintenance),
                AstronautBase = Upkeep("SalaryCrew", Rp1Types.ReadDouble(maintenance, "NautBaseUpkeepPerDay")),
                NautBaseSalary = Upkeep("SalaryCrew", PerYearToDay(AtLevel(settings, "nautYearlyUpkeepPerFacLevel", level))),
                AstronautOperational = Upkeep("SalaryCrew", Rp1Types.ReadDouble(maintenance, "NautInFlightUpkeepPerDay")),
                AstronautTraining = Upkeep("CrewTraining", Rp1Types.ReadDouble(maintenance, "TrainingUpkeepPerDay")),
                Courses = Courses(crewHandler, training),
                TrainingFees = TrainingFees(crewHandler, training),
                Programs = Programs(ut),
                IntegrationTeams = IntegrationTeams(spaceCenter, settings),
                Rollouts = Rollouts(spaceCenter),
                Constructions = Constructions(spaceCenter),
            };
        }

        /// <summary>
        /// The Integration tab's centres split into their terms: each complex's
        /// team, then the centre's unassigned engineers, each priced as the tab
        /// prices a centre.
        /// </summary>
        private List<Rp1IntegrationTeamCostRaw> IntegrationTeams(object spaceCenter, object? settings)
        {
            var salary = Rp1Types.ReadDouble(settings, "salaryEngineers");
            var idleMult = Rp1Types.ReadDouble(settings, "EngineerIdleSalaryMult");
            // By parameter type: the LCSpaceCenter overload has the same name and
            // arity and answers for the whole centre.
            var complexEngineers = Rp1Types.InstanceMethodOn(
                spaceCenter, "GetEffectiveEngineersForSalary", LaunchComplexTypeName, 1);
            var rows = new List<Rp1IntegrationTeamCostRaw>();
            foreach (var ksc in Rp1Types.Enumerate(Rp1Types.Member(spaceCenter, "KSCs")))
            {
                var kscName = Rp1Types.ReadString(ksc, "KSCName");
                var kscDisplayName = _siteNames.For(kscName);
                foreach (var lc in Rp1Types.Enumerate(Rp1Types.Member(ksc, "LaunchComplexes")))
                {
                    rows.Add(new Rp1IntegrationTeamCostRaw
                    {
                        KscName = kscName,
                        KscDisplayName = kscDisplayName,
                        Unassigned = false,
                        LcId = Rp1Types.ReadGuidString(lc, "ID"),
                        Name = Rp1Types.ReadString(lc, "Name"),
                        Engineers = ReadInt(lc, "Engineers"),
                        Cost = Salary(salary, Invoke(complexEngineers, spaceCenter, lc)),
                    });
                }
                var unassigned = ReadInt(ksc, "UnassignedEngineers");
                rows.Add(new Rp1IntegrationTeamCostRaw
                {
                    KscName = kscName,
                    KscDisplayName = kscDisplayName,
                    Unassigned = true,
                    Engineers = unassigned,
                    Cost = Salary(salary, unassigned == null || idleMult == null ? null : unassigned.Value * idleMult.Value),
                });
            }
            return rows;
        }

        /// <summary>RenderIntegrationTab's line: salaried heads over the period, then the SalaryEngineers query.</summary>
        private Rp1HorizonsRaw Salary(double? salaryPerYear, double? heads) =>
            Horizons(days => salaryPerYear == null || heads == null
                ? null
                : Funds("SalaryEngineers", -heads.Value * salaryPerYear.Value * days / DaysPerYear));

        /// <summary>Every operation GetReconRolloutCostOverTime bills, priced as it prices each one.</summary>
        private List<Rp1RolloutCostRaw> Rollouts(object spaceCenter)
        {
            var rows = new List<Rp1RolloutCostRaw>();
            foreach (var ksc in Rp1Types.Enumerate(Rp1Types.Member(spaceCenter, "KSCs")))
            {
                var kscName = Rp1Types.ReadString(ksc, "KSCName");
                var kscDisplayName = _siteNames.For(kscName);
                foreach (var lc in Rp1Types.Enumerate(Rp1Types.Member(ksc, "LaunchComplexes")))
                {
                    var lcId = Rp1Types.ReadGuidString(lc, "ID");
                    var lcName = Rp1Types.ReadString(lc, "Name");
                    foreach (var op in Rp1Types.Enumerate(Rp1Types.Member(lc, "Recon_Rollout")))
                    {
                        var type = Rp1Types.ReadEnumName(op, "RRType");
                        if (type != "Rollout" && type != "Reconditioning" && type != "AirlaunchMount")
                        {
                            continue;
                        }
                        var vesselId = Rp1Types.ReadString(op, "associatedID");
                        rows.Add(new Rp1RolloutCostRaw
                        {
                            KscName = kscName,
                            KscDisplayName = kscDisplayName,
                            LcId = lcId,
                            LcName = lcName,
                            LaunchPadId = Rp1Types.ReadString(op, "launchPadID"),
                            Type = type,
                            AssociatedVesselId = string.IsNullOrEmpty(vesselId) ? null : vesselId,
                            VesselName = VesselName(lc, vesselId),
                            Cost = RolloutCost(op),
                        });
                    }
                }
            }
            return rows;
        }

        /// <summary>
        /// One operation's term of GetReconRolloutCostOverTime: what is left of
        /// its cost, by the share of its time left that falls inside the period,
        /// through the query for its own TransactionReason.
        /// </summary>
        private Rp1HorizonsRaw RolloutCost(object op)
        {
            var cost = Rp1Types.ReadDouble(op, "cost");
            var progress = Rp1Types.ReadDouble(op, "progress");
            var points = Rp1Types.ReadDouble(op, "BP");
            var reason = Rp1Types.Member(op, "TransactionReason");
            double? timeLeft = null;
            var getTimeLeft = Rp1Types.InstanceMethod(op, "GetTimeLeft", 0);
            if (getTimeLeft != null)
            {
                try
                {
                    timeLeft = Rp1Types.ToDouble(getTimeLeft.Invoke(op, Array.Empty<object>()));
                }
                catch (Exception)
                {
                    timeLeft = null;
                }
            }
            return Horizons(days =>
            {
                if (cost == null || progress == null || points == null || reason == null || timeLeft == null)
                {
                    return null;
                }
                var span = days * SecondsPerDay;
                var share = timeLeft.Value > span ? span / timeLeft.Value : 1d;
                return Funds(reason, -cost.Value * (1d - progress.Value / points.Value) * share);
            });
        }

        /// <summary>
        /// The vehicle an operation moves, looked up as RP-1's FindVPByIDInLC looks
        /// it up: the complex's warehouse, then its build list.
        /// </summary>
        private static string? VesselName(object lc, string? vesselId)
        {
            if (string.IsNullOrEmpty(vesselId))
            {
                return null;
            }
            foreach (var list in new[] { "Warehouse", "BuildList" })
            {
                foreach (var vp in Rp1Types.Enumerate(Rp1Types.Member(lc, list)))
                {
                    if (string.Equals(Rp1Types.ReadGuidString(vp, "shipID"), vesselId, StringComparison.OrdinalIgnoreCase))
                    {
                        return Rp1Types.ReadString(vp, "shipName");
                    }
                }
            }
            return null;
        }

        /// <summary>The Construction tab's projects, each at its own GetConstructionCostOverTime.</summary>
        private List<Rp1ConstructionCostRaw> Constructions(object spaceCenter)
        {
            var rows = new List<Rp1ConstructionCostRaw>();
            foreach (var ksc in Rp1Types.Enumerate(Rp1Types.Member(spaceCenter, "KSCs")))
            {
                var kscName = Rp1Types.ReadString(ksc, "KSCName");
                var kscDisplayName = _siteNames.For(kscName);
                foreach (var project in Rp1Types.Enumerate(Rp1Types.Member(ksc, "Constructions")))
                {
                    var kind = ConstructionKind(project);
                    var costOverTime = Rp1Types.InstanceMethod(project, "GetConstructionCostOverTime", 1);
                    rows.Add(new Rp1ConstructionCostRaw
                    {
                        Id = kind == null ? null : Rp1ConstructionIds.Of(project, kind),
                        KscName = kscName,
                        KscDisplayName = kscDisplayName,
                        Kind = kind,
                        Name = Rp1Types.ReadString(project, "name"),
                        Cost = Horizons(days => Invoke(costOverTime, project, days * SecondsPerDay)),
                    });
                }
            }
            return rows;
        }

        /// <summary>Which of RP-1's three construction types a project is, by the contract's name for it.</summary>
        private static string? ConstructionKind(object project)
        {
            switch (project.GetType().FullName)
            {
                case "RP0.FacilityUpgradeProject":
                    return "FacilityUpgrade";
                case "RP0.LCConstructionProject":
                    return "LaunchComplex";
                case "RP0.PadConstructionProject":
                    return "Pad";
                default:
                    return null;
            }
        }

        private static int? ReadInt(object? target, string name) =>
            Rp1Types.Member(target, name) is int value ? value : (int?)null;

        /// <summary>The Facilities tab's buildings, in its order, each only if RP-1 has priced it.</summary>
        private List<Rp1BuildingUpkeepRaw>? Buildings(object maintenance)
        {
            if (!(Rp1Types.Member(maintenance, "FacilityMaintenanceCosts") is IDictionary costs))
            {
                return null;
            }
            var rows = new List<Rp1BuildingUpkeepRaw>();
            foreach (var facility in Rp1Types.Enumerate(Rp1Types.Member(maintenance, "FacilitiesForMaintenance")))
            {
                // A building RP-1 has locked or has no tier costs for is left out
                // of the dictionary, and out of the tab.
                if (!costs.Contains(facility))
                {
                    continue;
                }
                rows.Add(new Rp1BuildingUpkeepRaw
                {
                    Facility = facility.ToString(),
                    Upkeep = Upkeep("StructureRepair", Rp1Types.ToDouble(costs[facility])),
                });
            }
            return rows;
        }

        private List<Rp1ComplexUpkeepRaw> Complexes(object maintenance, object spaceCenter)
        {
            var rows = new List<Rp1ComplexUpkeepRaw>();
            foreach (var ksc in Rp1Types.Enumerate(Rp1Types.Member(spaceCenter, "KSCs")))
            {
                var kscName = Rp1Types.ReadString(ksc, "KSCName");
                foreach (var lc in Rp1Types.Enumerate(Rp1Types.Member(ksc, "LaunchComplexes")))
                {
                    rows.Add(new Rp1ComplexUpkeepRaw
                    {
                        LcId = Rp1Types.ReadGuidString(lc, "ID"),
                        Name = Rp1Types.ReadString(lc, "Name"),
                        KscName = kscName,
                        KscDisplayName = _siteNames.For(kscName),
                        Operational = Rp1Types.ReadBool(lc, "IsOperational"),
                        Upkeep = Upkeep("StructureRepairLC", Invoke(_lcUpkeep, maintenance, lc)),
                    });
                }
            }
            return rows;
        }

        /// <summary>The crew UpdateUpkeep bills, each priced as the Astronauts tab prices them.</summary>
        private List<Rp1CrewCostRaw>? Crew(object maintenance)
        {
            var game = _highLogic == null ? null : Rp1Types.StaticValue(_highLogic, "CurrentGame");
            var roster = Rp1Types.Member(game, "CrewRoster");
            if (roster == null)
            {
                return null;
            }
            var rows = new List<Rp1CrewCostRaw>();
            // KSP's Crew enumeration yields crew-type kerbals at every status.
            // UpdateUpkeep walks the whole roster instead, so its own filter is
            // applied here in full rather than trusting the enumerator's.
            foreach (var kerbal in Rp1Types.Enumerate(Rp1Types.Member(roster, "Crew")))
            {
                var status = Rp1Types.ReadEnumName(kerbal, "rosterStatus");
                if (status == "Dead" || status == "Missing" || Rp1Types.ReadEnumName(kerbal, "type") != "Crew")
                {
                    continue;
                }
                rows.Add(new Rp1CrewCostRaw
                {
                    Name = Rp1Types.ReadString(kerbal, "name"),
                    InFlight = status == null ? (bool?)null : status == "Assigned",
                    Cost = Upkeep("SalaryCrew", NautCostPerDay(maintenance, kerbal)),
                });
            }
            return rows;
        }

        /// <summary>GetNautCost's two out parameters, summed as RenderNautList sums them.</summary>
        private double? NautCostPerDay(object maintenance, object kerbal)
        {
            if (_nautCost == null)
            {
                return null;
            }
            try
            {
                var args = new object?[] { kerbal, null, null };
                _nautCost.Invoke(maintenance, args);
                var baseCost = Rp1Types.ToDouble(args[1]);
                var flightCost = Rp1Types.ToDouble(args[2]);
                return baseCost == null || flightCost == null ? null : Finite(baseCost.Value + flightCost.Value);
            }
            catch (Exception)
            {
                return null;
            }
        }

        /// <summary>UpdateUpkeep's training loop, one course at a time.</summary>
        private List<Rp1CourseCostRaw>? Courses(object? crewHandler, TrainingRates training)
        {
            var courses = Rp1Types.Member(crewHandler, "TrainingCourses");
            if (courses == null)
            {
                return null;
            }
            var rows = new List<Rp1CourseCostRaw>();
            foreach (var course in Rp1Types.Enumerate(courses))
            {
                if (Rp1Types.ReadBool(course, "Started") != true)
                {
                    continue;
                }
                var students = 0;
                foreach (var _ in Rp1Types.Enumerate(Rp1Types.Member(course, "Students")))
                {
                    students++;
                }
                var perStudent = training.PerStudentPerYear(Rp1Types.ReadString(course, "Target"));
                rows.Add(new Rp1CourseCostRaw
                {
                    Id = Rp1Types.ReadString(course, "id"),
                    Students = students,
                    Cost = Upkeep("CrewTraining", PerYearToDay(perStudent == null ? null : students * perStudent.Value)),
                });
            }
            return rows;
        }

        /// <summary>
        /// Every template in the catalogue at the per-student rate a course built
        /// from it would run at. TrainingCourse.Target is the template's
        /// training.target, or empty without one.
        /// </summary>
        private List<Rp1TrainingFeeRaw>? TrainingFees(object? crewHandler, TrainingRates training)
        {
            var templates = Rp1Types.Member(crewHandler, "TrainingTemplates");
            if (templates == null)
            {
                return null;
            }
            var rows = new List<Rp1TrainingFeeRaw>();
            foreach (var template in Rp1Types.Enumerate(templates))
            {
                var target = Rp1Types.ReadString(Rp1Types.Member(template, "training"), "target") ?? string.Empty;
                rows.Add(new Rp1TrainingFeeRaw
                {
                    TemplateId = Rp1Types.ReadString(template, "id"),
                    PerStudent = Upkeep("CrewTraining", PerYearToDay(training.PerStudentPerYear(target))),
                });
            }
            return rows;
        }

        /// <summary>The Astronaut Complex's tier as RP-1 indexes its per-tier settings, or null.</summary>
        private int? AstronautComplexLevel()
        {
            if (_facilityLevel == null)
            {
                return null;
            }
            try
            {
                var facility = Enum.Parse(_facilityLevel.GetParameters()[0].ParameterType, "AstronautComplex");
                return _facilityLevel.Invoke(null, new[] { facility }) is int level ? level : (int?)null;
            }
            catch (Exception)
            {
                return null;
            }
        }

        /// <summary>A per-tier settings list at a tier, or null when the tier is not on it.</summary>
        private static double? AtLevel(object? settings, string list, int? level) =>
            level is int i && Rp1Types.Member(settings, list) is IList values && i >= 0 && i < values.Count
                ? Rp1Types.ToDouble(values[i])
                : null;

        private static double? PerYearToDay(double? perYear) => perYear == null ? null : Finite(perYear.Value / DaysPerYear);

        /// <summary>
        /// The per-student yearly training cost by target, as UpdateUpkeep
        /// computes it for one student: the Astronaut Complex's per-head fee plus
        /// the proficiency upkeep the target fills in, times RP-1's type
        /// multiplier. Each target is filled once per reading.
        /// </summary>
        private sealed class TrainingRates
        {
            private readonly Rp1BudgetBreakdownReflection _owner;
            private readonly object? _settings;
            private readonly double? _perHead;
            private readonly double? _typeMult;
            private readonly Dictionary<string, double?> _byTarget = new Dictionary<string, double?>();

            public TrainingRates(Rp1BudgetBreakdownReflection owner, object? settings, int? level)
            {
                _owner = owner;
                _settings = settings;
                _perHead = AtLevel(settings, "nautTrainingCostPerFacLevel", level);
                _typeMult = Rp1Types.ReadDouble(settings, "nautTrainingTypeCostMult");
            }

            public double? PerStudentPerYear(string? target)
            {
                if (_settings == null || _perHead == null || _typeMult == null)
                {
                    return null;
                }
                var key = target ?? string.Empty;
                if (!_byTarget.TryGetValue(key, out var rate))
                {
                    var typeCost = _owner.ProficiencyUpkeep(_settings, key);
                    rate = typeCost == null ? null : Finite(_perHead.Value + typeCost.Value * _typeMult.Value);
                    _byTarget[key] = rate;
                }
                return rate;
            }
        }

        /// <summary>
        /// The yearly upkeep of every proficiency a training target fills in:
        /// FillBools, then GetTrainingCostFromBools reproduced, then RP-1's own
        /// ResetBools, so its scratch list is left as RP-1 leaves it.
        /// </summary>
        private double? ProficiencyUpkeep(object settings, string target)
        {
            if (_fillBools == null || _resetBools == null
                || !(Rp1Types.Member(settings, "nautUpkeepTrainings") is IList trainings)
                || !(Rp1Types.Member(settings, "nautUpkeepTrainingBools") is IList filled)
                || !(Rp1Types.Member(settings, "nautYearlyUpkeepPerTraining") is IDictionary yearly))
            {
                return null;
            }
            try
            {
                _fillBools.Invoke(null, new object[] { target, trainings, filled });
                var cost = 0d;
                for (var i = filled.Count; i-- > 0;)
                {
                    if (filled[i] is true)
                    {
                        var perYear = Rp1Types.ToDouble(yearly[trainings[i]!]);
                        if (perYear == null)
                        {
                            return null;
                        }
                        cost += perYear.Value;
                    }
                }
                return cost;
            }
            catch (Exception)
            {
                return null;
            }
            finally
            {
                try
                {
                    _resetBools.Invoke(settings, Array.Empty<object>());
                }
                catch (Exception)
                {
                    // fail-soft: RP-1 fills the list afresh before its next read of it
                }
            }
        }

        /// <summary>The Programs tab's Funding line for each running Program.</summary>
        private List<Rp1ProgramFundingRaw>? Programs(double ut)
        {
            var handler = _programHandler == null ? null : Rp1Types.StaticValue(_programHandler, "Instance");
            var active = Rp1Types.Member(handler, "ActivePrograms");
            if (active == null)
            {
                return null;
            }
            var rows = new List<Rp1ProgramFundingRaw>();
            foreach (var program in Rp1Types.Enumerate(active))
            {
                var now = Invoke(_fundsAt, program, ut);
                rows.Add(new Rp1ProgramFundingRaw
                {
                    Name = Rp1Types.ReadString(program, "name"),
                    Title = Rp1Types.ReadString(program, "title"),
                    // Zero until RP-1 stamps it on accepting, and a zero is no date at all.
                    DeadlineUt = Rp1Types.ReadDouble(program, "deadlineUT") is double deadline && deadline != 0d
                        ? deadline
                        : (double?)null,
                    Funding = Horizons(days =>
                    {
                        var then = Invoke(_fundsAt, program, ut + days * SecondsPerDay);
                        return now == null || then == null ? null : Funds("ProgramFunding", then.Value - now.Value);
                    }),
                });
            }
            return rows;
        }

        /// <summary>A per-day upkeep over each horizon, scaled before the query as RP-1's tabs scale it.</summary>
        private Rp1HorizonsRaw Upkeep(string reason, double? perDay) =>
            Horizons(days => perDay == null ? null : Funds(reason, -perDay.Value * days));

        private static Rp1HorizonsRaw Horizons(Func<double, double?> over) =>
            new Rp1HorizonsRaw { Day = over(1d), Month = over(DaysPerMonth), Year = over(DaysPerYear) };

        private double? Funds(string reason, double amount)
        {
            try
            {
                return Funds(Enum.Parse(_transactionReasons!, reason), amount);
            }
            catch (Exception)
            {
                return null;
            }
        }

        /// <summary>A currency query on a reason RP-1 handed over as its own enum value.</summary>
        private double? Funds(object reason, double amount)
        {
            try
            {
                return Finite(Rp1Types.ToDouble(_funds!.Invoke(null, new[] { reason, amount, false })));
            }
            catch (Exception)
            {
                return null;
            }
        }

        /// <summary>A one-argument RP-1 instance method, or null if it will not answer.</summary>
        private static double? Invoke(MethodInfo? method, object? target, object argument)
        {
            if (method == null || target == null)
            {
                return null;
            }
            try
            {
                return Finite(Rp1Types.ToDouble(method.Invoke(target, new[] { argument })));
            }
            catch (Exception)
            {
                return null;
            }
        }

        private static double? Finite(double? value) =>
            value == null || double.IsNaN(value.Value) || double.IsInfinity(value.Value) ? null : value;
    }
}
