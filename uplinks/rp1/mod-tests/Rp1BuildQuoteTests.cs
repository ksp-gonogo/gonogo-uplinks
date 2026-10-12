using System;
using RP0;
using Sitrep.Contract;
using Xunit;

namespace GonogoRp1Uplink.Tests
{
    /// <summary>
    /// <c>rp1.build.quote</c>: what RP-1 would charge to start a saved craft,
    /// asked without starting it.
    ///
    /// <para>The case that decides whether the quote is safe is
    /// <see cref="Charges_nothing_and_starts_nothing"/>: it shares every step of
    /// the press up to the charge, and a copy that went one step too far would be
    /// a button that spends a career's funds on a look. The cases that decide
    /// whether it is cheap are the cache ones, because a quote loads the craft's
    /// parts and the card asks again whenever it is drawn.</para>
    /// </summary>
    public class Rp1BuildQuoteTests : IDisposable
    {
        private readonly FakeCraftCatalogue _catalogue = new FakeCraftCatalogue();

        private readonly Rp1BuildStartCommands _commands;

        public Rp1BuildQuoteTests()
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
            ToolingDatabase.Generation = 0;
            RP0.Harmony.RFECMPatcher.techNode = null;
        }

        private static LaunchComplex Centre()
        {
            var lc = new LaunchComplex { Name = "LC-1", IsOperational = true, LcTypeValue = LaunchComplexType.Pad };
            var ksc = new LCSpaceCenter { KSCName = "Cape Canaveral" };
            ksc.LaunchComplexes.Add(lc);
            SpaceCenterManagement.Instance = new SpaceCenterManagement { ActiveSC = ksc };
            SpaceCenterManagement.Instance.KSCs.Add(ksc);
            return lc;
        }

        private CommandResult<Rp1BuildQuote> Quote(
            string? file, LaunchComplex? lc, KspEditorFacility? facility = KspEditorFacility.VAB) =>
            _commands.Quote(new Rp1BuildQuoteArgs
            {
                CraftFile = file,
                Facility = facility,
                LcId = lc?.ID.ToString(),
            });

        private CraftFileRecord Craft(string file = "Atlas", double cost = 40_000.0)
        {
            var record = _catalogue.Add(file, cost: cost);
            record.Modified = 1_000;
            return record;
        }

        [Fact]
        public void Quotes_the_price_rp1_arrives_at_with_the_balance_beside_it()
        {
            CurrencyModifierQueryRP0.Multiplier = 0.5;
            var lc = Centre();
            Craft(cost: 40_000.0);
            Funding.Instance!.Funds = 100_000.0;

            var result = Quote("Atlas", lc);

            Assert.True(result.Success);
            Assert.Equal(20_000.0, result.Payload!.Price);
            Assert.Equal(100_000.0, result.Payload.Balance);
            Assert.True(result.Payload.Affordable);
        }

        [Fact]
        public void Says_it_cannot_be_afforded_and_still_gives_the_price()
        {
            var lc = Centre();
            Craft(cost: 40_000.0);
            Funding.Instance!.Funds = 1_000.0;

            var result = Quote("Atlas", lc);

            Assert.True(result.Success);
            Assert.Equal(40_000.0, result.Payload!.Price);
            Assert.False(result.Payload.Affordable);
        }

        [Fact]
        public void Charges_nothing_and_starts_nothing()
        {
            var lc = Centre();
            Craft();

            var result = Quote("Atlas", lc);

            Assert.True(result.Success);
            Assert.Equal(1_000_000.0, Funding.Instance!.Funds);
            Assert.Empty(lc.BuildList);
        }

        [Fact]
        public void Gives_the_loaded_craft_back()
        {
            var lc = Centre();
            Craft();

            Quote("Atlas", lc);

            Assert.Single(_catalogue.Loaded);
            Assert.True(_catalogue.AllReleased);
        }

        [Fact]
        public void Refuses_a_spaceplane_at_a_pad_complex_the_way_the_press_does()
        {
            var lc = Centre();
            var plane = _catalogue.Add("Plane", KspEditorFacility.SPH);
            plane.Modified = 1_000;

            var result = Quote("Plane", lc, KspEditorFacility.SPH);

            Assert.False(result.Success);
            Assert.Equal(Rp1ErrorCodes.NotReady, result.ErrorCode);
            Assert.Null(result.Payload);
            Assert.True(_catalogue.AllReleased);
        }

        [Fact]
        public void Refuses_when_the_command_names_no_craft_and_loads_nothing()
        {
            var lc = Centre();
            Craft();

            var result = Quote(null, lc);

            Assert.False(result.Success);
            Assert.Equal(CommandErrorCode.NotFound, result.ErrorCode);
            Assert.Empty(_catalogue.Loaded);
        }

        [Fact]
        public void Refuses_when_the_price_cannot_be_computed()
        {
            CurrencyModifierQueryRP0.ThrowOnQuery = true;
            var lc = Centre();
            Craft();

            var result = Quote("Atlas", lc);

            Assert.False(result.Success);
            Assert.Equal(CommandErrorCode.Unreadable, result.ErrorCode);
        }

        [Fact]
        public void Asks_again_without_loading_the_craft_a_second_time()
        {
            var lc = Centre();
            Craft();

            var first = Quote("Atlas", lc);
            var second = Quote("Atlas", lc);

            Assert.Equal(first.Payload!.Price, second.Payload!.Price);
            Assert.Single(_catalogue.Loaded);
        }

        [Fact]
        public void A_cached_price_is_compared_with_the_balance_as_it_is_now()
        {
            var lc = Centre();
            Craft(cost: 40_000.0);
            Funding.Instance!.Funds = 100_000.0;
            Assert.True(Quote("Atlas", lc).Payload!.Affordable);

            Funding.Instance.Funds = 1_000.0;
            var again = Quote("Atlas", lc);

            Assert.Single(_catalogue.Loaded);
            Assert.False(again.Payload!.Affordable);
            Assert.Equal(1_000.0, again.Payload.Balance);
        }

        [Fact]
        public void Loads_again_when_the_craft_file_was_written_since()
        {
            var lc = Centre();
            var record = Craft();
            Quote("Atlas", lc);

            record.Modified = 2_000;
            Quote("Atlas", lc);

            Assert.Equal(2, _catalogue.Loaded.Count);
        }

        [Fact]
        public void Loads_again_when_a_tooling_was_bought_since()
        {
            var lc = Centre();
            Craft();
            Quote("Atlas", lc);

            ToolingDatabase.Generation++;
            Quote("Atlas", lc);

            Assert.Equal(2, _catalogue.Loaded.Count);
        }

        [Fact]
        public void Loads_again_and_quotes_the_new_price_when_a_leader_moved_what_a_purchase_costs()
        {
            var lc = Centre();
            Craft(cost: 40_000.0);
            Assert.Equal(40_000.0, Quote("Atlas", lc).Payload!.Price);

            CurrencyModifierQueryRP0.Multiplier = 0.5;
            var again = Quote("Atlas", lc);

            Assert.Equal(2, _catalogue.Loaded.Count);
            Assert.Equal(20_000.0, again.Payload!.Price);
        }

        [Fact]
        public void Keeps_a_price_per_complex()
        {
            var lc = Centre();
            Craft();
            Quote("Atlas", lc);

            var other = new LaunchComplex { Name = "LC-2", IsOperational = true, LcTypeValue = LaunchComplexType.Pad };
            SpaceCenterManagement.Instance!.KSCs[0].LaunchComplexes.Add(other);
            Quote("Atlas", other);

            Assert.Equal(2, _catalogue.Loaded.Count);
        }

        [Fact]
        public void Does_not_cache_a_craft_whose_write_time_is_unknown()
        {
            var lc = Centre();
            var record = Craft();
            record.Modified = null;

            Quote("Atlas", lc);
            Quote("Atlas", lc);

            Assert.Equal(2, _catalogue.Loaded.Count);
        }

        [Fact]
        public void Does_not_cache_a_refusal()
        {
            var lc = Centre();
            var record = Craft();
            record.MissingParts = new[] { "fooPart" };
            Assert.False(Quote("Atlas", lc).Success);

            record.MissingParts = new string[0];
            var result = Quote("Atlas", lc);

            Assert.True(result.Success);
        }
    }
}
