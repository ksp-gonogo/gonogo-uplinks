using System;
using System.Collections.Generic;
using System.Linq;
using GonogoRp1Uplink;
using KSP.Localization;
using RP0;
using RP0.Crew;
using RP0.Programs;
using Xunit;

/// <summary>
/// The lines under RP-1's Budget tab, against the stand-in object graph: each
/// building and launch complex, each crew member, each training course and each
/// Program, at the tab's three horizons.
///
/// <para>Every reason carries a multiplier of its own and one an affine offset,
/// so a line priced against the wrong reason, or scaled after the query rather
/// than before it, lands on a different number.</para>
/// </summary>
[Collection("rp0-static-graph")]
public class Rp1BudgetBreakdownTests : IDisposable
{
    private const double Day = 86400d;
    private const double Ut = 1_000_000d;

    public Rp1BudgetBreakdownTests() => Clear();

    public void Dispose() => Clear();

    private static void Clear()
    {
        MaintenanceHandler.Instance = null;
        SpaceCenterManagement.Instance = null;
        ProgramHandler.Instance = null;
        CrewHandler.Instance = null;
        HighLogic.Reset();
        CurrencyUtils.Reset();
        KCTUtilities.FacilityLevels.Clear();
        Database.SettingsSC.ResetBreakdown();
        TrainingDatabase.Fills.Clear();
        KSCSwitcherInterop.Sites = null;
        Localizer.Tags = null;
    }

    private static MaintenanceHandler ACareer()
    {
        MaintenanceHandler.Instance = new MaintenanceHandler { lastUpdate = 3600.0 };
        SpaceCenterManagement.Instance = new SpaceCenterManagement();
        return MaintenanceHandler.Instance;
    }

    private static Rp1BudgetBreakdownRaw Read() => new Rp1BudgetBreakdownReflection().CaptureOnMain(Ut)!;

    private static ProtoCrewMember Kerbal(
        string name,
        ProtoCrewMember.RosterStatus status = ProtoCrewMember.RosterStatus.Available,
        ProtoCrewMember.KerbalType type = ProtoCrewMember.KerbalType.Crew,
        bool inactive = false) =>
        new ProtoCrewMember(name) { rosterStatus = status, type = type, inactive = inactive };

    [Fact]
    public void Nothing_is_said_while_RP1_is_not_running_a_career()
    {
        Assert.Null(new Rp1BudgetBreakdownReflection().CaptureOnMain(Ut));
        Assert.Null(Rp1BudgetBreakdownCapture.Build(null));

        MaintenanceHandler.Instance = new MaintenanceHandler();
        Assert.Null(new Rp1BudgetBreakdownReflection().CaptureOnMain(Ut));
    }

    [Fact]
    public void Each_building_RP1_prices_is_a_line_in_the_Facilities_tabs_order()
    {
        var maintenance = ACareer();
        // Out of the tab's order, and one of the four left unpriced as RP-1
        // leaves a locked building.
        maintenance.FacilityMaintenanceCosts[SpaceCenterFacility.MissionControl] = 30.0;
        maintenance.FacilityMaintenanceCosts[SpaceCenterFacility.Administration] = 10.0;
        maintenance.FacilityMaintenanceCosts[SpaceCenterFacility.AstronautComplex] = 20.0;
        CurrencyUtils.Multipliers[TransactionReasonsRP0.StructureRepair] = 0.5;

        var buildings = Read().Buildings!;

        Assert.Equal(new[] { "Administration", "AstronautComplex", "MissionControl" }, buildings.Select(b => b.Facility));
        Assert.Equal(-10.0 * 0.5, buildings[0].Upkeep!.Day);
        Assert.Equal(-30.0 * 30 * 0.5, buildings[2].Upkeep!.Month);
    }

    [Fact]
    public void A_line_is_scaled_to_its_horizon_before_the_query_as_RP1s_tabs_scale_it()
    {
        // An affine modifier is where the two differ: scaled first, the offset
        // lands once per horizon. A Month built as thirty Days would carry it
        // thirty times.
        var maintenance = ACareer();
        maintenance.FacilityMaintenanceCosts[SpaceCenterFacility.Administration] = 10.0;
        CurrencyUtils.PostDeltas[TransactionReasonsRP0.StructureRepair] = -1.0;

        var upkeep = Read().Buildings![0].Upkeep!;

        Assert.Equal(-10.0 - 1.0, upkeep.Day);
        Assert.Equal(-10.0 * 30 - 1.0, upkeep.Month);
        Assert.Equal(-10.0 * 365.25 - 1.0, upkeep.Year);
    }

    [Fact]
    public void Every_launch_complex_is_a_line_including_one_RP1_bills_while_it_is_built()
    {
        var maintenance = ACareer();
        var pad = new LaunchComplex { Name = "Pad A" };
        var building = new LaunchComplex { Name = "Pad B", IsOperational = false };
        var hangar = new LaunchComplex { Name = "Hangar" };
        SpaceCenterManagement.Instance!.KSCs.Add(new LCSpaceCenter
        {
            KSCName = "us_cape_canaveral",
            LaunchComplexes = { pad, building },
        });
        SpaceCenterManagement.Instance.KSCs.Add(new LCSpaceCenter
        {
            KSCName = "ru_baikonur",
            LaunchComplexes = { hangar },
        });
        maintenance.LcUpkeepValues[pad] = 40.0;
        maintenance.LcUpkeepValues[building] = 15.0;
        maintenance.UnpriceableComplexes.Add(hangar);
        CurrencyUtils.Multipliers[TransactionReasonsRP0.StructureRepairLC] = 0.25;

        var complexes = Read().Complexes!;

        Assert.Equal(new[] { "Pad A", "Pad B", "Hangar" }, complexes.Select(c => c.Name));
        Assert.Equal(pad.ID.ToString(), complexes[0].LcId);
        Assert.Equal(new[] { "us_cape_canaveral", "us_cape_canaveral", "ru_baikonur" }, complexes.Select(c => c.KscName));
        Assert.Equal(new bool?[] { true, false, true }, complexes.Select(c => c.Operational));
        Assert.Equal(-40.0 * 0.25, complexes[0].Upkeep!.Day);
        Assert.Equal(-15.0 * 365.25 * 0.25, complexes[1].Upkeep!.Year);
        // One complex RP-1 will not price is a line with no figure, not a zero.
        Assert.Null(complexes[2].Upkeep!.Day);
        Assert.Null(complexes[2].Upkeep!.Year);
    }

    [Fact]
    public void A_complex_carries_the_name_the_Facilities_tab_heads_its_centre_with()
    {
        ACareer();
        foreach (var ksc in new[] { "us_cape_canaveral", "ru_baikonur", "cn_jiuquan" })
        {
            SpaceCenterManagement.Instance!.KSCs.Add(new LCSpaceCenter { KSCName = ksc, LaunchComplexes = { new LaunchComplex() } });
        }
        // RSS writes its site names as localisation tags, which KSP never
        // translates on load, so RP-1's getter hands the tag back as it stands.
        KSCSwitcherInterop.Sites = new List<(string, string)>
        {
            ("us_cape_canaveral", "#RSS_Site_cape_canaveral_name"),
            ("ru_baikonur", "KZ - Baikonur"),
            ("cn_jiuquan", "#RSS_Site_jiuquan_name"),
        };
        Localizer.Tags = new Dictionary<string, string> { ["#RSS_Site_cape_canaveral_name"] = "US - Cape Canaveral" };

        var complexes = Read().Complexes!;

        // A tag the loaded language lacks comes back as the tag, which is no name.
        Assert.Equal(new[] { "US - Cape Canaveral", "KZ - Baikonur", null }, complexes.Select(c => c.KscDisplayName));
        Assert.Equal(new[] { "us_cape_canaveral", "ru_baikonur", "cn_jiuquan" }, complexes.Select(c => c.KscName));
    }

    [Fact]
    public void Without_KSCSwitcher_a_complex_carries_no_display_name_and_its_centre_id_stands()
    {
        ACareer();
        SpaceCenterManagement.Instance!.KSCs.Add(new LCSpaceCenter { KSCName = "Stock", LaunchComplexes = { new LaunchComplex() } });

        var complex = Read().Complexes!.Single();

        Assert.Null(complex.KscDisplayName);
        Assert.Equal("Stock", complex.KscName);
    }

    [Fact]
    public void Every_living_crew_member_is_a_line_on_ground_pay_or_the_flight_rate()
    {
        var maintenance = ACareer();
        maintenance.NautYearlyUpkeep = 365.25 * 10.0;
        maintenance.NautProficiencyYearly["Valentina Kerman"] = 365.25 * 4.0;
        maintenance.NautInFlightDailyRate = 50.0;
        maintenance.NautInactiveMult = 0.5;
        HighLogic.CurrentGame.CrewRoster.With(
            Kerbal("Jebediah Kerman", ProtoCrewMember.RosterStatus.Assigned),
            Kerbal("Valentina Kerman"),
            Kerbal("Bill Kerman", inactive: true),
            Kerbal("Wernher Kerman", ProtoCrewMember.RosterStatus.Dead),
            Kerbal("Gene Kerman", ProtoCrewMember.RosterStatus.Missing),
            Kerbal("Tourist Kerman", type: ProtoCrewMember.KerbalType.Tourist),
            Kerbal("Applicant Kerman", type: ProtoCrewMember.KerbalType.Applicant));
        CurrencyUtils.Multipliers[TransactionReasonsRP0.SalaryCrew] = 2.0;

        var crew = Read().Crew!;

        Assert.Equal(new[] { "Jebediah Kerman", "Valentina Kerman", "Bill Kerman" }, crew.Select(k => k.Name));
        Assert.Equal(new bool?[] { true, false, false }, crew.Select(k => k.InFlight));
        // In flight: ground pay AND the flight rate, as GetNautCost leaves both.
        Assert.Equal(-(10.0 + 50.0) * 2.0, crew[0].Cost!.Day!.Value, 9);
        Assert.Equal(-(10.0 + 4.0) * 30 * 2.0, crew[1].Cost!.Month!.Value, 9);
        Assert.Equal(-10.0 * 0.5 * 2.0, crew[2].Cost!.Day!.Value, 9);
    }

    [Fact]
    public void A_crew_member_RP1_will_not_price_keeps_a_line_with_no_figure()
    {
        var maintenance = ACareer();
        maintenance.UnpriceableNauts.Add("Bob Kerman");
        HighLogic.CurrentGame.CrewRoster.With(Kerbal("Bob Kerman"), Kerbal("Bill Kerman"));

        var crew = Read().Crew!;

        Assert.Null(crew[0].Cost!.Day);
        Assert.NotNull(crew[1].Cost!.Day);
    }

    [Fact]
    public void The_Astronauts_tabs_three_rows_are_priced_against_their_own_reasons()
    {
        var maintenance = ACareer();
        maintenance.NautBaseUpkeepPerDay = 50.0;
        maintenance.NautInFlightUpkeepPerDay = 25.0;
        maintenance.TrainingUpkeepPerDay = 10.0;
        CurrencyUtils.Multipliers[TransactionReasonsRP0.SalaryCrew] = 0.5;
        CurrencyUtils.Multipliers[TransactionReasonsRP0.CrewTraining] = 3.0;

        var raw = Read();

        Assert.Equal(-50.0 * 0.5, raw.AstronautBase!.Day);
        Assert.Equal(-25.0 * 30 * 0.5, raw.AstronautOperational!.Month);
        Assert.Equal(-10.0 * 365.25 * 3.0, raw.AstronautTraining!.Year);
    }

    /// <summary>A crew handler running two courses and holding a third not yet started.</summary>
    private static void ATrainingCareer()
    {
        ACareer();
        KCTUtilities.FacilityLevels[SpaceCenterFacility.AstronautComplex] = 1;
        var settings = Database.SettingsSC;
        settings.nautTrainingCostPerFacLevel = new List<double> { 1000.0, 2000.0 };
        settings.nautTrainingTypeCostMult = 0.25;
        settings.TrainingUpkeep(("Orbit", 400.0), ("EVA", 800.0), ("Docking", 1600.0));
        TrainingDatabase.Fills["Mercury"] = new[] { "Orbit", "EVA" };

        CrewHandler.Instance = new CrewHandler();
        CrewHandler.Instance.TrainingCourses.Add(ACourse("prof-mercury", "Mercury", started: true, "Alan Kerman", "John Kerman"));
        CrewHandler.Instance.TrainingCourses.Add(ACourse("prof-basic", "Basic", started: true, "Scott Kerman"));
        CrewHandler.Instance.TrainingCourses.Add(ACourse("prof-queued", "Mercury", started: false, "Gus Kerman"));
    }

    private static TrainingCourse ACourse(string id, string target, bool started, params string[] students)
    {
        var course = new TrainingCourse(new TrainingTemplate
        {
            id = id,
            training = new TrainingFlightEntry { target = target },
        })
        {
            Started = started,
        };
        course.Students.AddRange(students.Select(n => new ProtoCrewMember(n)));
        return course;
    }

    [Fact]
    public void A_course_costs_its_students_the_per_head_fee_and_a_share_of_the_proficiency_it_teaches()
    {
        ATrainingCareer();
        CurrencyUtils.Multipliers[TransactionReasonsRP0.CrewTraining] = 3.0;

        var courses = Read().Courses!;

        // The course waiting for its students costs nothing and is not a line.
        Assert.Equal(new[] { "prof-mercury", "prof-basic" }, courses.Select(c => c.Id));
        Assert.Equal(new int?[] { 2, 1 }, courses.Select(c => c.Students));
        var mercuryPerYear = 2 * (2000.0 + (400.0 + 800.0) * 0.25);
        Assert.Equal(-mercuryPerYear * 3.0, courses[0].Cost!.Year!.Value, 9);
        Assert.Equal(-mercuryPerYear / 365.25 * 30 * 3.0, courses[0].Cost!.Month!.Value, 9);
        // A target that fills in no upkeep-bearing proficiency pays the fee alone.
        Assert.Equal(-2000.0 / 365.25 * 3.0, courses[1].Cost!.Day!.Value, 9);
    }

    [Fact]
    public void RP1s_scratch_list_is_reset_after_every_course_as_RP1_resets_it()
    {
        ATrainingCareer();

        Read();

        Assert.Equal(2, Database.SettingsSC.ResetBoolsCalls);
        Assert.All(Database.SettingsSC.nautUpkeepTrainingBools, b => Assert.False(b));
    }

    [Fact]
    public void Every_template_in_the_catalogue_is_priced_per_student_as_a_course_on_it_would_run()
    {
        ATrainingCareer();
        var crew = CrewHandler.Instance!;
        crew.TrainingTemplates.Add(new TrainingTemplate { id = "prof-mercury", training = new TrainingFlightEntry { target = "Mercury" } });
        crew.TrainingTemplates.Add(new TrainingTemplate { id = "mission-x", training = new TrainingFlightEntry { target = "Unknown" } });
        crew.TrainingTemplates.Add(new TrainingTemplate { id = "bare" });
        CurrencyUtils.Multipliers[TransactionReasonsRP0.CrewTraining] = 3.0;

        var raw = Read();

        Assert.Equal(new[] { "prof-mercury", "mission-x", "bare" }, raw.TrainingFees!.Select(f => f.TemplateId));
        var mercuryPerStudentYear = 2000.0 + (400.0 + 800.0) * 0.25;
        Assert.Equal(-mercuryPerStudentYear * 3.0, raw.TrainingFees![0].PerStudent!.Year!.Value, 9);
        Assert.Equal(-2000.0 / 365.25 * 3.0, raw.TrainingFees[1].PerStudent!.Day!.Value, 9);
        Assert.Equal(-2000.0 / 365.25 * 3.0, raw.TrainingFees[2].PerStudent!.Day!.Value, 9);
        // Two students on the running Mercury course cost exactly two fees.
        Assert.Equal(2 * raw.TrainingFees[0].PerStudent!.Year!.Value, raw.Courses![0].Cost!.Year!.Value, 9);
        // Each distinct target is filled once: Mercury, Basic, Unknown and the empty one.
        Assert.Equal(4, Database.SettingsSC.ResetBoolsCalls);
    }

    [Fact]
    public void The_salary_a_hire_adds_is_base_pay_at_the_Astronaut_Complexs_tier()
    {
        ACareer();
        KCTUtilities.FacilityLevels[SpaceCenterFacility.AstronautComplex] = 1;
        Database.SettingsSC.nautYearlyUpkeepPerFacLevel = new List<double> { 365.25 * 5.0, 365.25 * 8.0 };
        CurrencyUtils.Multipliers[TransactionReasonsRP0.SalaryCrew] = 0.5;

        var salary = Read().NautBaseSalary!;

        Assert.Equal(-8.0 * 0.5, salary.Day!.Value, 9);
        Assert.Equal(-8.0 * 30 * 0.5, salary.Month!.Value, 9);

        KCTUtilities.FacilityLevels[SpaceCenterFacility.AstronautComplex] = 2;
        Assert.Null(Read().NautBaseSalary!.Day);
    }

    [Fact]
    public void A_course_is_unpriced_when_the_Astronaut_Complex_tier_has_no_fee()
    {
        ATrainingCareer();
        KCTUtilities.FacilityLevels[SpaceCenterFacility.AstronautComplex] = 2;

        var courses = Read().Courses!;

        Assert.Equal(2, courses.Count);
        Assert.All(courses, c => Assert.Null(c.Cost!.Day));
        Assert.Equal(new int?[] { 2, 1 }, courses.Select(c => c.Students));
    }

    [Fact]
    public void A_Programs_funding_is_read_off_its_curve_at_each_horizon_from_the_capture_instant()
    {
        ACareer();
        // Pays 100 a day until it has paid out 5,000 more, so a Year is not
        // 365.25 Days and a sum over a scaled day would say it was.
        var paying = new Program { name = "EarlySatellites", FundsAtUt = ut => Math.Min(100.0 * (ut - Ut) / Day, 5000.0) };
        var done = new Program { name = "X-Planes" };
        ProgramHandler.Instance = new ProgramHandler();
        ProgramHandler.Instance.ActivePrograms.Add(paying);
        ProgramHandler.Instance.ActivePrograms.Add(done);
        CurrencyUtils.Multipliers[TransactionReasonsRP0.ProgramFunding] = 1.5;

        var programs = Read().Programs!;

        Assert.Equal(new[] { "EarlySatellites", "X-Planes" }, programs.Select(p => p.Name));
        Assert.Equal(100.0 * 1.5, programs[0].Funding!.Day!.Value, 9);
        Assert.Equal(3000.0 * 1.5, programs[0].Funding!.Month!.Value, 9);
        Assert.Equal(5000.0 * 1.5, programs[0].Funding!.Year!.Value, 9);
        Assert.Equal(0.0, programs[1].Funding!.Year);
        Assert.Equal(Ut, paying.FundsAsks[0]);
        Assert.Contains(Ut + 30 * Day, paying.FundsAsks);
    }

    [Fact]
    public void A_Program_carries_the_title_and_Nominal_Deadline_the_Programs_tab_heads_it_with()
    {
        ACareer();
        ProgramHandler.Instance = new ProgramHandler();
        ProgramHandler.Instance.ActivePrograms.Add(new Program { name = "EarlyXPlanes", title = "X-Plane Research", deadlineUT = Ut + 400 * Day });
        // Accepted this instant and not yet stamped by a funding tick.
        ProgramHandler.Instance.ActivePrograms.Add(new Program { name = "EarlySatellites", title = "Early Satellites" });

        var programs = Read().Programs!;

        Assert.Equal(new[] { "EarlyXPlanes", "EarlySatellites" }, programs.Select(p => p.Name));
        Assert.Equal(new[] { "X-Plane Research", "Early Satellites" }, programs.Select(p => p.Title));
        Assert.Equal(new double?[] { Ut + 400 * Day, null }, programs.Select(p => p.DeadlineUt));
    }

    [Fact]
    public void A_list_is_absent_without_its_RP1_system_and_empty_when_that_system_bills_nothing()
    {
        ACareer();

        var raw = Read();

        Assert.Null(raw.Courses);
        Assert.Null(raw.Programs);
        Assert.Empty(raw.Buildings!);
        Assert.Empty(raw.Complexes!);
        Assert.Empty(raw.Crew!);

        CrewHandler.Instance = new CrewHandler();
        ProgramHandler.Instance = new ProgramHandler();
        MaintenanceHandler.Instance!.lastUpdate += 3600.0;
        raw = new Rp1BudgetBreakdownReflection().CaptureOnMain(Ut)!;

        Assert.Empty(raw.Courses!);
        Assert.Empty(raw.Programs!);
    }

    [Fact]
    public void Between_upkeep_refreshes_a_capture_asks_RP1_nothing()
    {
        var maintenance = ACareer();
        maintenance.FacilityMaintenanceCosts[SpaceCenterFacility.Administration] = 10.0;
        var reader = new Rp1BudgetBreakdownReflection();
        var first = reader.CaptureOnMain(Ut);
        var asked = CurrencyUtils.Queries;

        Assert.Same(first, reader.CaptureOnMain(Ut + 60));
        Assert.Equal(asked, CurrencyUtils.Queries);

        maintenance.lastUpdate += 3600.0;
        Assert.NotSame(first, reader.CaptureOnMain(Ut + 3600));
        Assert.True(CurrencyUtils.Queries > asked);
    }

    [Fact]
    public void A_newly_loaded_career_is_read_afresh_and_leaving_it_clears_the_reading()
    {
        ACareer();
        var reader = new Rp1BudgetBreakdownReflection();
        var first = reader.CaptureOnMain(Ut);

        MaintenanceHandler.Instance = new MaintenanceHandler { lastUpdate = MaintenanceHandler.Instance!.lastUpdate };
        Assert.NotSame(first, reader.CaptureOnMain(Ut));

        MaintenanceHandler.Instance = null;
        Assert.Null(reader.CaptureOnMain(Ut));
    }

    /// <summary>
    /// Two constructions, a rollout beside a rollback, and two complexes with a
    /// pool of unassigned engineers, each reason on a multiplier of its own.
    /// </summary>
    private static (LaunchComplex Pad, LaunchComplex Hangar, ReconRolloutProject Rollout) AProjectCareer()
    {
        var maintenance = ACareer();
        var scm = SpaceCenterManagement.Instance!;
        var pad = new LaunchComplex { Name = "LC-1", Engineers = 10 };
        var hangar = new LaunchComplex { Name = "Hangar", Engineers = 4, IsRushing = true };
        var vessel = new VesselProject { shipName = "Vanguard" };
        pad.Warehouse.Add(vessel);
        var rollout = new ReconRolloutProject
        {
            RRType = ReconRolloutProject.RolloutReconType.Rollout,
            associatedID = vessel.shipID.ToString(),
            launchPadID = "LC-1 Pad",
            cost = 500.0,
            BP = 100.0,
            progress = 25.0,
            TimeLeftValue = 5 * Day,
        };
        pad.Recon_Rollout.Add(rollout);
        pad.Recon_Rollout.Add(new ReconRolloutProject
        {
            RRType = ReconRolloutProject.RolloutReconType.Rollback,
            cost = 900.0,
            BP = 100.0,
            progress = 60.0,
            TimeLeftValue = 2 * Day,
        });

        // Ten days left on the upgrade, so a month and a year take all of it and
        // a day a tenth; four hundred on the pad, so even a year takes a share.
        var upgrade = new FacilityUpgradeProject(SpaceCenterFacility.VehicleAssemblyBuilding, "vab", 2, 1, "VAB")
        {
            cost = 1000.0,
            spentCost = 200.0,
            BP = 100.0,
            progress = 20.0,
        };
        upgrade.SetBuildRate(80.0 / (10 * Day));
        var newPad = new PadConstructionProject { name = "Pad B", cost = 4000.0, BP = 400.0, RushMultiplierValue = 1.5 };
        newPad.SetBuildRate(1.0 / Day);

        var centre = new LCSpaceCenter
        {
            KSCName = "us_cape_canaveral",
            Engineers = 20,
            LaunchComplexes = { pad, hangar },
            FacilityUpgrades = { upgrade },
            Constructions = { upgrade, newPad },
        };
        pad.Ksc = centre;
        hangar.Ksc = centre;
        scm.KSCs.Add(centre);

        maintenance.UpdateKCTSalaries();
        CurrencyUtils.Multipliers[TransactionReasonsRP0.SalaryEngineers] = 1.5;
        CurrencyUtils.Multipliers[TransactionReasonsRP0.RocketRollout] = 0.8;
        CurrencyUtils.Multipliers[TransactionReasonsRP0.StructureConstruction] = 0.9;
        CurrencyUtils.Multipliers[TransactionReasonsRP0.StructureConstructionLC] = 1.25;
        return (pad, hangar, rollout);
    }

    [Fact]
    public void Rollouts_constructions_and_integration_teams_are_lines_that_add_up_to_their_rows()
    {
        AProjectCareer();

        var lines = Read();
        var rows = new Rp1BudgetReflection().CaptureOnMain(Ut)!;

        foreach (var (row, horizon) in new[]
                 {
                     (rows.Day!, (Func<Rp1HorizonsRaw, double?>)(h => h.Day)),
                     (rows.Month!, h => h.Month),
                     (rows.Year!, h => h.Year),
                 })
        {
            Assert.NotNull(row.IntegrationTeams);
            Assert.NotEqual(0.0, row.Rollout);
            Assert.NotEqual(0.0, row.Constructions);
            Assert.Equal(row.IntegrationTeams!.Value, lines.IntegrationTeams!.Sum(t => horizon(t.Cost!)!.Value), 6);
            Assert.Equal(row.Rollout!.Value, lines.Rollouts!.Sum(r => horizon(r.Cost!)!.Value), 6);
            Assert.Equal(row.Constructions!.Value, lines.Constructions!.Sum(c => horizon(c.Cost!)!.Value), 6);
        }
    }

    [Fact]
    public void Each_complex_and_each_centres_unassigned_pool_is_an_integration_line()
    {
        var (pad, hangar, _) = AProjectCareer();

        var teams = Read().IntegrationTeams!;

        Assert.Equal(new[] { "LC-1", "Hangar", null }, teams.Select(t => t.Name));
        Assert.Equal(new[] { pad.ID.ToString(), hangar.ID.ToString(), null }, teams.Select(t => t.LcId));
        Assert.Equal(new bool?[] { false, false, true }, teams.Select(t => t.Unassigned));
        Assert.Equal(new int?[] { 10, 4, 6 }, teams.Select(t => t.Engineers));
        Assert.All(teams, t => Assert.Equal("us_cape_canaveral", t.KscName));
        // Heads at the salary, the rush multiplier on the hangar, the idle
        // fraction on the pool, scaled to the horizon before the query.
        Assert.Equal(-10.0 * 1000 / 365.25 * 1.5, teams[0].Cost!.Day!.Value, 9);
        Assert.Equal(-4.0 * 2.0 * 1000 * 30 / 365.25 * 1.5, teams[1].Cost!.Month!.Value, 9);
        Assert.Equal(-6.0 * 0.25 * 1000 * 1.5, teams[2].Cost!.Year!.Value, 9);
    }

    [Fact]
    public void A_rollout_that_bills_is_a_line_priced_as_RP1_prices_it_and_a_rollback_is_not()
    {
        var (pad, _, rollout) = AProjectCareer();

        var line = Read().Rollouts!.Single();

        Assert.Equal("Rollout", line.Type);
        Assert.Equal(pad.ID.ToString(), line.LcId);
        Assert.Equal("LC-1", line.LcName);
        Assert.Equal("LC-1 Pad", line.LaunchPadId);
        Assert.Equal(rollout.associatedID, line.AssociatedVesselId);
        Assert.Equal("Vanguard", line.VesselName);
        Assert.Equal("us_cape_canaveral", line.KscName);
        // Three quarters of the price still to pay, a fifth of it in a day, all
        // of it inside a month.
        Assert.Equal(-500.0 * 0.75 / 5 * 0.8, line.Cost!.Day!.Value, 9);
        Assert.Equal(-500.0 * 0.75 * 0.8, line.Cost!.Month!.Value, 9);
        Assert.Equal(-500.0 * 0.75 * 0.8, line.Cost!.Year!.Value, 9);
    }

    [Fact]
    public void Each_construction_is_a_line_in_the_Construction_tabs_order()
    {
        AProjectCareer();

        var constructions = Read().Constructions!;

        Assert.Equal(new[] { "FacilityUpgrade", "Pad" }, constructions.Select(c => c.Kind));
        Assert.Equal(new[] { "VAB", "Pad B" }, constructions.Select(c => c.Name));
        Assert.Equal("us_cape_canaveral", constructions[0].KscName);
        Assert.NotNull(constructions[0].Id);
        // The upgrade finishes inside a month, so a month and a year take the
        // whole of its unspent cost; a day takes a tenth.
        Assert.Equal(-800.0 * 0.9 / 10, constructions[0].Cost!.Day!.Value, 9);
        Assert.Equal(-800.0 * 0.9, constructions[0].Cost!.Month!.Value, 9);
        Assert.Equal(-800.0 * 0.9, constructions[0].Cost!.Year!.Value, 9);
        // The pad is a complex's construction, rushed, with four hundred days to go.
        Assert.Equal(-4000.0 * 1.5 * 1.25 * 365.25 / 400, constructions[1].Cost!.Year!.Value, 9);
    }

    [Fact]
    public void The_payload_carries_every_line_under_its_contract_name()
    {
        ATrainingCareer();
        CrewHandler.Instance!.TrainingTemplates.Add(new TrainingTemplate { id = "t" });
        var maintenance = MaintenanceHandler.Instance!;
        maintenance.FacilityMaintenanceCosts[SpaceCenterFacility.Administration] = 10.0;
        SpaceCenterManagement.Instance!.KSCs.Add(new LCSpaceCenter { KSCName = "ksc", LaunchComplexes = { new LaunchComplex() } });
        HighLogic.CurrentGame.CrewRoster.With(Kerbal("Jebediah Kerman"));
        ProgramHandler.Instance = new ProgramHandler();
        ProgramHandler.Instance.ActivePrograms.Add(new Program { name = "p" });

        var payload = Rp1BudgetBreakdownCapture.Build(Read())!;

        AssertKeys(typeof(Rp1BudgetBreakdown), payload);
        AssertKeys(typeof(Rp1BudgetHorizons), (Dictionary<string, object?>)payload["astronautBase"]!);
        AssertKeys(typeof(Rp1BuildingUpkeepEntry), First(payload, "buildings"));
        AssertKeys(typeof(Rp1ComplexUpkeepEntry), First(payload, "complexes"));
        AssertKeys(typeof(Rp1CrewCostEntry), First(payload, "crew"));
        AssertKeys(typeof(Rp1CourseCostEntry), First(payload, "courses"));
        AssertKeys(typeof(Rp1TrainingFeeEntry), First(payload, "trainingFees"));
        AssertKeys(typeof(Rp1ProgramFundingEntry), First(payload, "programs"));

        AProjectCareer();
        payload = Rp1BudgetBreakdownCapture.Build(Read())!;
        AssertKeys(typeof(Rp1IntegrationTeamCostEntry), First(payload, "integrationTeams"));
        AssertKeys(typeof(Rp1RolloutCostEntry), First(payload, "rollouts"));
        AssertKeys(typeof(Rp1ConstructionCostEntry), First(payload, "constructions"));
    }

    private static Dictionary<string, object?> First(Dictionary<string, object?> payload, string key) =>
        (Dictionary<string, object?>)((List<object?>)payload[key]!)[0]!;

    private static void AssertKeys(Type contract, Dictionary<string, object?> dict) =>
        Assert.Equal(contract.GetProperties().Select(p => Camel(p.Name)).OrderBy(n => n), dict.Keys.OrderBy(n => n));

    private static string Camel(string name) => char.ToLowerInvariant(name[0]) + name.Substring(1);
}
