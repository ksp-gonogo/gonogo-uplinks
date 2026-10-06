using System;
using System.Collections.Generic;
using System.Linq;
using RP0;
using Sitrep.Contract;
using Xunit;

namespace GonogoRp1Uplink.Tests
{
    /// <summary>
    /// Starting a NEW design building from a saved craft file: the command that
    /// closes the dead end RP-1's own model leaves.
    ///
    /// <para>The refusals come first here, deliberately and in the order they are
    /// asked, because the capability that was missing is not "add a row to a
    /// list": it is "decide, before spending, whether this complex will take this
    /// craft at all". A handler that only did the happy path would be a button
    /// that charges a career for a vehicle its launch complex refuses.</para>
    ///
    /// <para>The case that decides whether the feature is SAFE is
    /// <see cref="Refuses_and_charges_nothing_when_the_career_cannot_afford_it"/>,
    /// for the reason <c>Rp1BuildCommandsTests</c> gives at length: RP-1's own
    /// SpendFunds performs no affordability test, so an unasked currency query is
    /// a career driven into negative funds with nothing to show.</para>
    ///
    /// <para>The case that decides whether it LEAKS is
    /// <see cref="Gives_the_loaded_craft_back_even_when_it_refuses"/>. A load
    /// instantiates a Unity part per PART node; a refusal that returned without
    /// releasing would leave a craft standing at the world origin, once per
    /// press.</para>
    /// </summary>
    public class Rp1BuildStartTests : IDisposable
    {
        private readonly FakeCraftCatalogue _catalogue = new FakeCraftCatalogue();

        private readonly Rp1BuildStartCommands _commands;

        public Rp1BuildStartTests()
        {
            Reset();
            _commands = new Rp1BuildStartCommands(() => _catalogue);
        }

        public void Dispose() => Reset();

        private static void Reset()
        {
            SpaceCenterManagement.Instance = null;
            Funding.Instance = new Funding { Funds = 1_000_000.0 };
            KCTUtilities.Reset();
            CurrencyModifierQueryRP0.Reset();
            RP0.Harmony.RFECMPatcher.techNode = null;
        }

        /// <summary>A part titled as RP-1's popup would title it, carrying the given modules.</summary>
        private Part PartWith(string title, params object[] modules)
        {
            var part = new Part { partInfo = new PartInfo { title = title } };
            part.Modules.AddRange(modules);
            _catalogue.Parts.Add(part);
            return part;
        }

        /// <summary>One centre with one operational pad complex, registered as the live SCM.</summary>
        private static LaunchComplex Centre(
            bool operational = true, LaunchComplexType type = LaunchComplexType.Pad)
        {
            var lc = new LaunchComplex { Name = "LC-1", IsOperational = operational, LcTypeValue = type };
            var ksc = new LCSpaceCenter { KSCName = "Cape Canaveral" };
            ksc.LaunchComplexes.Add(lc);
            SpaceCenterManagement.Instance = new SpaceCenterManagement { ActiveSC = ksc };
            SpaceCenterManagement.Instance.KSCs.Add(ksc);
            return lc;
        }

        private CommandResult Start(
            string? file, LaunchComplex? lc, KspEditorFacility? facility = KspEditorFacility.VAB) =>
            _commands.Start(new Rp1BuildStartArgs
            {
                CraftFile = file,
                Facility = facility,
                LcId = lc?.ID.ToString(),
            });

        [Fact]
        public void Refuses_when_the_command_names_no_craft()
        {
            var lc = Centre();
            _catalogue.Add("Atlas");

            var result = Start(null, lc);

            Assert.False(result.Success);
            Assert.Equal(CommandErrorCode.NotFound, result.ErrorCode);
            Assert.Empty(lc.BuildList);
        }

        [Fact]
        public void Refuses_when_the_command_names_no_launch_complex()
        {
            var lc = Centre();
            _catalogue.Add("Atlas");

            var result = _commands.Start(new Rp1BuildStartArgs
            {
                CraftFile = "Atlas",
                Facility = KspEditorFacility.VAB,
            });

            Assert.False(result.Success);
            Assert.Equal(CommandErrorCode.NotFound, result.ErrorCode);
            Assert.Empty(lc.BuildList);
            // Never opened: the complex is the first thing that could make the
            // load pointless, so nothing is instantiated to find out.
            Assert.Empty(_catalogue.Loaded);
        }

        [Fact]
        public void Refuses_when_rp1_is_not_managing_this_save()
        {
            var lc = Centre();
            SpaceCenterManagement.Instance!.enabledForSave = false;
            _catalogue.Add("Atlas");

            var result = Start("Atlas", lc);

            Assert.False(result.Success);
            Assert.Equal(Rp1ErrorCodes.NotManaging, result.ErrorCode);
            Assert.Empty(lc.BuildList);
        }

        [Fact]
        public void Refuses_when_no_complex_carries_that_id()
        {
            Centre();
            _catalogue.Add("Atlas");

            var result = _commands.Start(new Rp1BuildStartArgs
            {
                CraftFile = "Atlas",
                Facility = KspEditorFacility.VAB,
                LcId = Guid.NewGuid().ToString(),
            });

            Assert.False(result.Success);
            Assert.Equal(CommandErrorCode.NotFound, result.ErrorCode);
        }

        [Fact]
        public void Refuses_when_the_complex_is_still_being_built()
        {
            var lc = Centre(operational: false);
            _catalogue.Add("Atlas");

            var result = Start("Atlas", lc);

            Assert.False(result.Success);
            Assert.Equal(Rp1ErrorCodes.NotReady, result.ErrorCode);
            Assert.Contains("LC-1", result.Detail!);
            Assert.Empty(lc.BuildList);
        }

        [Fact]
        public void Refuses_a_vab_craft_at_a_hangar_and_names_both()
        {
            var lc = Centre(type: LaunchComplexType.Hangar);
            _catalogue.Add("Atlas");

            var result = Start("Atlas", lc);

            Assert.False(result.Success);
            Assert.Equal(Rp1ErrorCodes.NotReady, result.ErrorCode);
            // Both halves of the mismatch, because "wrong complex" alone leaves
            // an operator guessing which of the two is the wrong one.
            Assert.Contains("VAB", result.Detail!);
            Assert.Contains("hangar", result.Detail!, StringComparison.OrdinalIgnoreCase);
            Assert.Empty(lc.BuildList);
        }

        [Fact]
        public void Refuses_a_spaceplane_at_a_pad_complex()
        {
            var lc = Centre(type: LaunchComplexType.Pad);
            _catalogue.Add("Dynasoar", KspEditorFacility.SPH);

            var result = Start("Dynasoar", lc, KspEditorFacility.SPH);

            Assert.False(result.Success);
            Assert.Equal(Rp1ErrorCodes.NotReady, result.ErrorCode);
            Assert.Empty(lc.BuildList);
        }

        [Fact]
        public void Refuses_with_rp1s_own_reasons_when_the_complex_will_not_take_it()
        {
            var lc = Centre();
            _catalogue.Add("Saturn V", mass: 2_900.0);
            VesselProject.NextFacilityRefusals = new List<string>
            {
                "Mass limit exceeded, currently at 2,900.00 tons, max 100.00",
            };

            var result = Start("Saturn V", lc);

            Assert.False(result.Success);
            Assert.Equal(Rp1ErrorCodes.NotReady, result.ErrorCode);
            // RP-1's own sentence, carried through rather than summarised: it
            // names both figures, and a paraphrase would drop one.
            Assert.Contains("Mass limit exceeded", result.Detail!);
            Assert.Contains("LC-1", result.Detail!);
            Assert.Empty(lc.BuildList);
            Assert.Equal(1_000_000.0, Funding.Instance!.Funds);
        }

        [Fact]
        public void Refuses_and_names_the_parts_this_install_does_not_have()
        {
            var lc = Centre();
            var craft = _catalogue.Add("Atlas");
            craft.MissingParts = new[] { "RO-Atlas-LR89", "RO-Atlas-LR105" };

            var result = Start("Atlas", lc);

            Assert.False(result.Success);
            Assert.Equal(Rp1ErrorCodes.NotReady, result.ErrorCode);
            Assert.Contains("RO-Atlas-LR89", result.Detail!);
            Assert.Empty(lc.BuildList);
        }

        [Fact]
        public void Refuses_and_names_the_parts_whose_tech_is_not_researched()
        {
            var lc = Centre();
            var craft = _catalogue.Add("Atlas");
            craft.LockedParts = new[] { "RO-Agena-8096" };

            var result = Start("Atlas", lc);

            Assert.False(result.Success);
            Assert.Equal(Rp1ErrorCodes.NotReady, result.ErrorCode);
            Assert.Contains("RO-Agena-8096", result.Detail!);
            Assert.Empty(lc.BuildList);
        }

        [Fact]
        public void Refuses_parts_that_are_researched_but_not_bought_rather_than_buying_them()
        {
            var lc = Centre();
            var craft = _catalogue.Add("Atlas");
            craft.UnpurchasedParts = new[] { "RO-Vanguard-X405" };

            var result = Start("Atlas", lc);

            Assert.False(result.Success);
            Assert.Equal(Rp1ErrorCodes.NotReady, result.ErrorCode);
            Assert.Contains("RO-Vanguard-X405", result.Detail!);
            // RP-1's own window offers to spend the funds here, through a popup.
            // Nobody can answer a popup on a command dispatched from another
            // machine, and spending an operator's money on an unasked question is
            // not the safe direction, so the refusal names the remedy instead.
            Assert.Equal(1_000_000.0, Funding.Instance!.Funds);
            Assert.Empty(lc.BuildList);
        }

        /// <summary>
        /// The control for the planted error below: the same craft, its modules
        /// all vouching for themselves and one declaring no check at all, starts.
        /// Without it the refusal test would pass against a walk that refused
        /// every craft with a module on it.
        /// </summary>
        [Fact]
        public void Starts_a_craft_whose_part_modules_all_vouch_for_their_configuration()
        {
            var lc = Centre();
            _catalogue.Add("Atlas");
            PartWith("LR105", new ConfiguredModule(), new PlainModule());

            var result = Start("Atlas", lc);

            Assert.True(result.Success, result.Detail);
            Assert.Single(lc.BuildList);
        }

        [Fact]
        public void Refuses_when_the_crafts_own_part_modules_report_a_configuration_error()
        {
            var lc = Centre();
            _catalogue.Add("Atlas");
            PartWith("LR105", new ConfiguredModule(), new PlainModule());
            PartWith("LR89", new ConfiguredModule
            {
                Valid = false,
                Error = "engine config \"LR89-NA-3\" is not unlocked",
            });

            var result = Start("Atlas", lc);

            Assert.False(result.Success);
            Assert.Equal(Rp1ErrorCodes.NotReady, result.ErrorCode);
            Assert.Contains("LR89: engine config \"LR89-NA-3\" is not unlocked", result.Detail!);
            Assert.DoesNotContain("LR105", result.Detail!);
            Assert.Equal(1_000_000.0, Funding.Instance!.Funds);
            Assert.Empty(lc.BuildList);
            Assert.True(_catalogue.AllReleased);
        }

        /// <summary>
        /// RP-1's integrate button resolves an error costing at most 1.1 funds
        /// without asking, with its purchase patch pointed at the error's tech,
        /// and so does this. Refusing it would refuse a craft RP-1 builds.
        /// </summary>
        [Fact]
        public void Resolves_a_config_rp1_unlocks_without_asking_and_starts()
        {
            var lc = Centre();
            _catalogue.Add("Atlas");
            var module = new ConfiguredModule
            {
                Valid = false,
                Error = "engine config \"LR89-NA-3\" is not unlocked",
                CanBeResolved = true,
                CostToResolve = 0f,
                TechToResolve = "basicRocketry",
            };
            PartWith("LR89", module);

            var result = Start("Atlas", lc);

            Assert.True(result.Success, result.Detail);
            Assert.Equal(new[] { "basicRocketry" }, module.ResolvedWithTech);
            Assert.Null(RP0.Harmony.RFECMPatcher.techNode);
            Assert.Single(lc.BuildList);
        }

        [Fact]
        public void Refuses_a_config_that_costs_to_unlock_and_names_the_cost_rather_than_buying_it()
        {
            var lc = Centre();
            _catalogue.Add("Atlas");
            var module = new ConfiguredModule
            {
                Valid = false,
                Error = "engine config \"LR89-NA-3\" is not unlocked",
                CanBeResolved = true,
                CostToResolve = 15_000f,
                TechToResolve = "basicRocketry",
            };
            PartWith("LR89", module);

            var result = Start("Atlas", lc);

            Assert.False(result.Success);
            Assert.Equal(Rp1ErrorCodes.NotReady, result.ErrorCode);
            Assert.Contains("base cost 15,000 funds", result.Detail!);
            Assert.Empty(module.ResolvedWithTech);
            Assert.Equal(1_000_000.0, Funding.Instance!.Funds);
            Assert.Empty(lc.BuildList);
        }

        [Fact]
        public void Refuses_when_a_free_resolve_does_not_clear_the_error()
        {
            var lc = Centre();
            _catalogue.Add("Atlas");
            PartWith("LR89", new ConfiguredModule
            {
                Valid = false,
                Error = "engine config \"LR89-NA-3\" is not unlocked",
                CanBeResolved = true,
                CostToResolve = 1f,
                ResolveSucceeds = false,
            });

            var result = Start("Atlas", lc);

            Assert.False(result.Success);
            Assert.Contains("LR89-NA-3", result.Detail!);
            Assert.Null(RP0.Harmony.RFECMPatcher.techNode);
            Assert.Empty(lc.BuildList);
        }

        /// <summary>
        /// RP-1 counts a check that throws as an error, so a module with a bug in
        /// its own validation is not integrated there and is not here.
        /// </summary>
        [Fact]
        public void Refuses_when_a_part_modules_own_check_throws()
        {
            var lc = Centre();
            _catalogue.Add("Atlas");
            PartWith("LR89", new ConfiguredModule { ThrowOnValidate = true });

            var result = Start("Atlas", lc);

            Assert.False(result.Success);
            Assert.Equal(Rp1ErrorCodes.NotReady, result.ErrorCode);
            Assert.Contains("LR89: its configuration check failed", result.Detail!);
            Assert.Empty(lc.BuildList);
            Assert.True(_catalogue.AllReleased);
        }

        /// <summary>
        /// A part whose game-database prefab carries the given modules, as
        /// RealFuels' FetchModuleFromPrefab finds them: by index, then by type.
        /// </summary>
        private static void PrefabOf(Part part, params object[] modules)
        {
            var prefab = new Part { partInfo = part.partInfo };
            prefab.Modules.AddRange(modules);
            part.partInfo!.partPrefab = prefab;
        }

        /// <summary>
        /// RealFuels fills a tank's available types from the part prefab in
        /// OnAwake only in the editor and in flight, so a craft loaded at the
        /// Space Center holds none and every tank reports its own type "not
        /// available". RP-1's button runs in the editor, where the copy has been
        /// made, and integrates the craft.
        /// </summary>
        [Fact]
        public void Starts_a_craft_whose_tank_type_the_part_prefab_offers_though_the_loaded_module_was_never_given_it()
        {
            var lc = Centre();
            _catalogue.Add("Jet Trainer");
            var steel = new RealFuels.Tanks.TankDefinition("Tank-Sep-Steel", "Steel Fuselage");
            RealFuels.Tanks.ModuleFuelTanks.Definitions[steel.name] = steel;
            var part = PartWith(
                "Procedural Tank",
                new PlainModule(),
                new RealFuels.Tanks.ModuleFuelTanks { type = steel.name });
            PrefabOf(
                part,
                new PlainModule(),
                new RealFuels.Tanks.ModuleFuelTanks { typesAvailable = { steel } });

            var result = Start("Jet Trainer", lc);

            Assert.True(result.Success, result.Detail);
            Assert.Single(lc.BuildList);
        }

        /// <summary>
        /// The control for the case above: a type the prefab does not offer is
        /// one the editor would not offer either, and the refusal stands.
        /// </summary>
        [Fact]
        public void Refuses_a_tank_type_the_part_prefab_does_not_offer_either()
        {
            var lc = Centre();
            _catalogue.Add("Jet Trainer");
            var steel = new RealFuels.Tanks.TankDefinition("Tank-Sep-Steel", "Steel Fuselage");
            var aluminium = new RealFuels.Tanks.TankDefinition("Tank-Sep-Al", "Aluminium Fuselage");
            RealFuels.Tanks.ModuleFuelTanks.Definitions[steel.name] = steel;
            RealFuels.Tanks.ModuleFuelTanks.Definitions[aluminium.name] = aluminium;
            var part = PartWith("Procedural Tank", new RealFuels.Tanks.ModuleFuelTanks { type = steel.name });
            PrefabOf(part, new RealFuels.Tanks.ModuleFuelTanks { typesAvailable = { aluminium } });

            var result = Start("Jet Trainer", lc);

            Assert.False(result.Success);
            Assert.Equal(Rp1ErrorCodes.NotReady, result.ErrorCode);
            Assert.Contains("Procedural Tank: definition Steel Fuselage is not available", result.Detail!);
            Assert.Empty(lc.BuildList);
            Assert.True(_catalogue.AllReleased);
        }

        /// <summary>
        /// A part whose prefab cannot be reached has nothing to restore from, and
        /// the module's own refusal is reported rather than waved through.
        /// </summary>
        [Fact]
        public void Refuses_a_tank_type_when_the_part_prefab_cannot_be_reached()
        {
            var lc = Centre();
            _catalogue.Add("Jet Trainer");
            var steel = new RealFuels.Tanks.TankDefinition("Tank-Sep-Steel", "Steel Fuselage");
            RealFuels.Tanks.ModuleFuelTanks.Definitions[steel.name] = steel;
            PartWith("Procedural Tank", new RealFuels.Tanks.ModuleFuelTanks { type = steel.name });

            var result = Start("Jet Trainer", lc);

            Assert.False(result.Success);
            Assert.Contains("definition Steel Fuselage is not available", result.Detail!);
            Assert.Empty(lc.BuildList);
        }

        /// <summary>
        /// ProceduralParts leaves a density the craft file does not carry at -1,
        /// and only its editor start-up raises it to the part's minimum. RP-1's
        /// button sees the raised value and integrates the craft.
        /// </summary>
        [Fact]
        public void Starts_a_procedural_part_whose_craft_carries_no_density()
        {
            var lc = Centre();
            _catalogue.Add("Jet Trainer");
            var module = new ProceduralParts.ProceduralPart { minDensity = 0.3f };
            PartWith("Procedural Tank", module);

            var result = Start("Jet Trainer", lc);

            Assert.True(result.Success, result.Detail);
            Assert.Equal(0.3f, module.density);
            Assert.Single(lc.BuildList);
        }

        /// <summary>
        /// A density the craft DID carry is the operator's, and one below the
        /// part's minimum is refused, as the editor refuses it.
        /// </summary>
        [Fact]
        public void Refuses_a_procedural_part_saved_below_its_minimum_density()
        {
            var lc = Centre();
            _catalogue.Add("Jet Trainer");
            PartWith("Procedural Tank", new ProceduralParts.ProceduralPart { density = 0.2f, minDensity = 0.3f });

            var result = Start("Jet Trainer", lc);

            Assert.False(result.Success);
            Assert.Contains("Procedural Tank: density needs to be 0.3 or higher", result.Detail!);
            Assert.Empty(lc.BuildList);
        }

        [Fact]
        public void Starts_a_fairing_side_whose_craft_carries_no_density()
        {
            var lc = Centre();
            _catalogue.Add("Jet Trainer");
            var module = new Keramzit.ProceduralFairingSide { minDensity = 0.18f };
            PartWith("Fairing", module);

            var result = Start("Jet Trainer", lc);

            Assert.True(result.Success, result.Detail);
            Assert.Equal(0.18f, module.density);
            Assert.Single(lc.BuildList);
        }

        [Fact]
        public void Refuses_a_fairing_side_saved_below_its_minimum_density()
        {
            var lc = Centre();
            _catalogue.Add("Jet Trainer");
            PartWith("Fairing", new Keramzit.ProceduralFairingSide { density = 0.1f, minDensity = 0.18f });

            var result = Start("Jet Trainer", lc);

            Assert.False(result.Success);
            Assert.Contains("Fairing: density needs to be 0.18 or higher", result.Detail!);
            Assert.Empty(lc.BuildList);
        }

        [Fact]
        public void Refuses_and_charges_nothing_when_the_career_cannot_afford_it()
        {
            var lc = Centre();
            _catalogue.Add("Atlas", cost: 40_000.0);
            Funding.Instance!.Funds = 1_000.0;

            var result = Start("Atlas", lc);

            Assert.False(result.Success);
            Assert.Equal(CommandErrorCode.InsufficientFunds, result.ErrorCode);
            Assert.Empty(lc.BuildList);
            Assert.Equal(1_000.0, Funding.Instance.Funds);
            var breach = Assert.IsType<LimitBreach>(result.Breach);
            Assert.Equal(40_000.0, breach.Actual);
            Assert.Equal(1_000.0, breach.Limit);
            Assert.Equal(Units.Funds, breach.Unit);
        }

        [Fact]
        public void Refuses_and_charges_nothing_when_the_price_cannot_be_computed()
        {
            CurrencyModifierQueryRP0.ThrowOnQuery = true;
            var lc = Centre();
            _catalogue.Add("Atlas");

            var result = Start("Atlas", lc);

            Assert.False(result.Success);
            Assert.Equal(CommandErrorCode.Unreadable, result.ErrorCode);
            Assert.Empty(lc.BuildList);
            Assert.Equal(1_000_000.0, Funding.Instance!.Funds);
        }

        [Fact]
        public void Refuses_when_the_craft_file_cannot_be_opened_and_says_which()
        {
            var lc = Centre();
            _catalogue.LoadFailure = "the craft file is from a newer version of KSP";

            var result = Start("Atlas", lc);

            Assert.False(result.Success);
            Assert.Contains("newer version", result.Detail!);
            Assert.Empty(lc.BuildList);
        }

        [Fact]
        public void Refuses_when_this_install_has_no_craft_catalogue_at_all()
        {
            var lc = Centre();
            var commands = new Rp1BuildStartCommands(() => null);

            var result = commands.Start(new Rp1BuildStartArgs
            {
                CraftFile = "Atlas",
                Facility = KspEditorFacility.VAB,
                LcId = lc.ID.ToString(),
            });

            Assert.False(result.Success);
            Assert.Equal(CommandErrorCode.ModeUnavailable, result.ErrorCode);
            Assert.Empty(lc.BuildList);
        }

        /// <summary>
        /// The exact shape <see cref="Rp1ScUplink"/> wires: a factory over
        /// core's elected <c>ICraftCatalogue</c>, not a fixed stand-in. Before
        /// core restored <c>Load</c>/<c>Release</c> this factory could only ever
        /// resolve to null, so <c>rp1.build.start</c> was permanently dark on
        /// every install; this pins the two states a factory over a live Kernel
        /// election can actually be in, one command dispatched against each.
        /// </summary>
        [Fact]
        public void Refuses_cleanly_with_no_catalogue_elected_and_proceeds_once_one_is()
        {
            var lc = Centre();
            var catalogue = new FakeCraftCatalogue();
            catalogue.Add("Atlas", cost: 40_000.0);
            var args = new Rp1BuildStartArgs
            {
                CraftFile = "Atlas",
                Facility = KspEditorFacility.VAB,
                LcId = lc.ID.ToString(),
            };

            var darkResult = new Rp1BuildStartCommands(() => null).Start(args);
            Assert.False(darkResult.Success);
            Assert.Equal(CommandErrorCode.ModeUnavailable, darkResult.ErrorCode);
            Assert.Empty(lc.BuildList);

            var litResult = new Rp1BuildStartCommands(() => catalogue).Start(args);
            Assert.True(litResult.Success);
            Assert.Single(lc.BuildList);
        }

        [Fact]
        public void Refuses_rather_than_proceeding_when_the_catalogue_throws()
        {
            var lc = Centre();
            _catalogue.Add("Atlas");
            _catalogue.ThrowOnLoad = true;

            var result = Start("Atlas", lc);

            Assert.False(result.Success);
            Assert.Empty(lc.BuildList);
            Assert.Equal(1_000_000.0, Funding.Instance!.Funds);
        }

        [Fact]
        public void Gives_the_loaded_craft_back_even_when_it_refuses()
        {
            var lc = Centre();
            _catalogue.Add("Atlas", cost: 40_000.0);
            Funding.Instance!.Funds = 1_000.0;

            var result = Start("Atlas", lc);

            Assert.False(result.Success);
            Assert.Single(_catalogue.Loaded);
            Assert.True(_catalogue.AllReleased);
        }

        [Fact]
        public void Starts_the_build_at_the_complex_that_was_named()
        {
            var lc = Centre();
            _catalogue.Add("Atlas", cost: 40_000.0);

            var result = Start("Atlas", lc);

            Assert.True(result.Success);
            var started = Assert.Single(lc.BuildList);
            Assert.Equal("Atlas", started.shipName);
            Assert.Equal(lc.ID, started.LCID);
            // Stored, because a vehicle whose craft node was not kept is one RP-1
            // can never build another of and can never launch.
            Assert.True(started.Stored);
            Assert.Equal(960_000.0, Funding.Instance!.Funds);
            Assert.True(_catalogue.AllReleased);
        }

        [Fact]
        public void Asks_the_catalogue_for_the_file_and_editor_it_was_given()
        {
            var lc = Centre();
            _catalogue.Add("Dynasoar", KspEditorFacility.SPH);
            var hangar = new LaunchComplex
            {
                Name = "Hangar", IsOperational = true, LcTypeValue = LaunchComplexType.Hangar,
            };
            SpaceCenterManagement.Instance!.ActiveSC!.LaunchComplexes.Add(hangar);

            var result = Start("Dynasoar", hangar, KspEditorFacility.SPH);

            Assert.True(result.Success);
            // The FILE, never the ship name: two files may carry one ship name
            // and a command that addressed the name would build whichever the
            // directory listed first.
            Assert.Equal("Dynasoar", _catalogue.LastFile);
            Assert.Equal(KspEditorFacility.SPH, _catalogue.LastFacility);
        }

        [Fact]
        public void Charges_the_price_rp1_arrives_at_rather_than_the_stock_cost()
        {
            // Leaders and strategies move what a vessel purchase costs, so the
            // figure on the craft file is a list price. At a multiplier of 1.0 a
            // handler reading the wrong one passes anyway; at 0.5 it cannot.
            CurrencyModifierQueryRP0.Multiplier = 0.5;
            var lc = Centre();
            _catalogue.Add("Atlas", cost: 40_000.0);
            Funding.Instance!.Funds = 100_000.0;

            var result = Start("Atlas", lc);

            Assert.True(result.Success);
            Assert.Equal(60_000.0, Funding.Instance.Funds);
        }

        [Fact]
        public void Says_so_plainly_when_the_add_throws_after_the_career_was_charged()
        {
            KCTUtilities.ThrowOnAdd = true;
            var lc = Centre();
            _catalogue.Add("Atlas");

            var result = Start("Atlas", lc);

            Assert.False(result.Success);
            // An operator who reads a bare "refused" and presses again pays
            // twice, so the sentence has to send them to the queue and the
            // balance first.
            Assert.Contains("balance", result.Detail!);
            Assert.True(_catalogue.AllReleased);
        }
    }
}
