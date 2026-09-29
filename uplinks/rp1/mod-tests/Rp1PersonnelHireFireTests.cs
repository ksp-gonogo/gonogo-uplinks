using System;
using RP0;
using Sitrep.Contract;
using Xunit;

namespace GonogoRp1Uplink.Tests
{
    /// <summary>
    /// Hiring and firing by a count, against the stand-in RP-1 object graph.
    ///
    /// <para>The cases that matter are the ones RP-1's own window only greys out
    /// and never stops: a hire the balance does not cover, and a fire beyond the
    /// unassigned pool, which drives the pool negative. Both are refused here with
    /// nothing moved. The rest pin that the call is RP-1's own, so applicants are
    /// hired free and the right pool moves.</para>
    /// </summary>
    public class Rp1PersonnelHireFireTests : IDisposable
    {
        private readonly Rp1PersonnelCommands _commands = new Rp1PersonnelCommands();

        public Rp1PersonnelHireFireTests() => Reset();

        public void Dispose() => Reset();

        private static void Reset()
        {
            SpaceCenterManagement.Instance = null;
            Funding.Instance = null;
            KCTUtilities.Reset();
            // Shared and static, and another suite leaves it at its own price.
            Database.SettingsSC.HireCost = 200;
        }

        /// <summary>
        /// Two centres, Cape active, each with a complex holding some of its
        /// engineers, and a balance.
        /// </summary>
        private static (LCSpaceCenter cape, LCSpaceCenter vandenberg) Career(
            double funds = 10_000,
            int applicants = 0,
            int researchers = 12,
            int capeHired = 30,
            int capeAssigned = 10)
        {
            var cape = Centre("Cape", capeHired, capeAssigned);
            var vandenberg = Centre("Vandenberg", 8, 8);
            SpaceCenterManagement.Instance = new SpaceCenterManagement
            {
                ActiveSC = cape,
                Applicants = applicants,
                Researchers = researchers,
            };
            SpaceCenterManagement.Instance.KSCs.Add(cape);
            SpaceCenterManagement.Instance.KSCs.Add(vandenberg);
            Funding.Instance = new Funding { Funds = funds };
            return (cape, vandenberg);
        }

        private static LCSpaceCenter Centre(string name, int hired, int assigned)
        {
            var lc = new LaunchComplex { Name = name + " LC", IsOperational = true, Engineers = assigned, MaxEngineersValue = 60 };
            var ksc = new LCSpaceCenter { KSCName = name, Engineers = hired };
            ksc.LaunchComplexes.Add(lc);
            lc.Ksc = ksc;
            return ksc;
        }

        private CommandResult Hire(bool research, int? count, string? ksc = "Cape") =>
            _commands.Hire(new Rp1PersonnelHeadcountArgs { Research = research, Count = count, KscName = ksc });

        private CommandResult Fire(bool research, int? count, string? ksc = "Cape") =>
            _commands.Fire(new Rp1PersonnelHeadcountArgs { Research = research, Count = count, KscName = ksc });

        [Fact]
        public void Hires_engineers_into_the_active_centres_pool_and_charges_each_head()
        {
            var (cape, _) = Career(funds: 10_000);

            Assert.True(Hire(false, 5).Success);

            Assert.Equal(35, cape.Engineers);
            Assert.Equal(25, cape.UnassignedEngineers);
            // The centre overload, not a complex's: the heads join the pool and
            // assigning them is a separate press.
            Assert.Same(cape, Assert.Single(KCTUtilities.EngineerChanges).Key);
            Assert.Equal(10_000 - 5 * 200, Funding.Instance!.Funds);
        }

        [Fact]
        public void Hires_researchers_and_charges_nothing_for_waiting_applicants()
        {
            Career(funds: 10_000, applicants: 3, researchers: 12);

            Assert.True(Hire(true, 5, ksc: null).Success);

            Assert.Equal(17, SpaceCenterManagement.Instance!.Researchers);
            Assert.Equal(0, SpaceCenterManagement.Instance.Applicants);
            Assert.Equal(10_000 - 2 * 200, Funding.Instance!.Funds);
            Assert.Empty(KCTUtilities.EngineerChanges);
        }

        [Fact]
        public void Refuses_a_hire_the_balance_does_not_cover_and_moves_nothing()
        {
            var (cape, _) = Career(funds: 999, applicants: 1);

            // Six heads, one of them a free applicant: 5 * 200 = 1,000 against 999.
            var result = Hire(false, 6);

            Assert.False(result.Success);
            Assert.Equal(CommandErrorCode.InsufficientFunds, result.ErrorCode);
            Assert.Contains("1,000 funds", result.Detail ?? "");
            Assert.Contains("999 funds", result.Detail ?? "");
            Assert.Equal(30, cape.Engineers);
            Assert.Equal(999, Funding.Instance!.Funds);
            Assert.Equal(1, SpaceCenterManagement.Instance!.Applicants);
        }

        [Fact]
        public void Hires_on_an_empty_balance_when_applicants_cover_every_head()
        {
            Career(funds: 0, applicants: 4);

            Assert.True(Hire(true, 4, ksc: null).Success);

            Assert.Equal(16, SpaceCenterManagement.Instance!.Researchers);
            Assert.Equal(0, Funding.Instance!.Funds);
        }

        [Fact]
        public void Refuses_engineers_at_a_centre_that_is_not_active()
        {
            var (_, vandenberg) = Career();

            var hire = Hire(false, 2, ksc: "Vandenberg");
            var fire = Fire(false, 1, ksc: "Vandenberg");

            Assert.False(hire.Success);
            Assert.False(fire.Success);
            Assert.Equal(CommandErrorCode.WrongState, hire.ErrorCode);
            Assert.Contains("Cape", hire.Detail ?? "");
            Assert.Equal(8, vandenberg.Engineers);
            Assert.Empty(KCTUtilities.EngineerChanges);
        }

        [Fact]
        public void Refuses_engineers_with_no_centre_named()
        {
            Career();

            var result = Hire(false, 2, ksc: null);

            Assert.False(result.Success);
            Assert.Equal(CommandErrorCode.NotFound, result.ErrorCode);
        }

        [Theory]
        [InlineData(null)]
        [InlineData(0)]
        [InlineData(-3)]
        public void Refuses_a_count_below_one(int? count)
        {
            Career();

            Assert.Equal(CommandErrorCode.Range, Hire(true, count).ErrorCode);
            Assert.Equal(CommandErrorCode.Range, Fire(true, count).ErrorCode);
            Assert.Equal(12, SpaceCenterManagement.Instance!.Researchers);
        }

        [Fact]
        public void Refuses_when_the_kind_of_staff_is_not_named()
        {
            Career();

            var result = _commands.Hire(new Rp1PersonnelHeadcountArgs { Count = 1, KscName = "Cape" });

            Assert.False(result.Success);
            Assert.Equal(CommandErrorCode.Range, result.ErrorCode);
        }

        [Fact]
        public void Fires_unassigned_engineers_and_recalculates_the_centres_rates()
        {
            var (cape, _) = Career(capeHired: 30, capeAssigned: 10);

            Assert.True(Fire(false, 20).Success);

            Assert.Equal(10, cape.Engineers);
            Assert.Equal(0, cape.UnassignedEngineers);
            Assert.Same(cape, Assert.Single(KCTUtilities.EngineerChanges).Key);
            Assert.Equal(1, cape.BuildRateRecalculations);
            Assert.False(cape.LastRecalculateAll);
            Assert.Equal(10_000, Funding.Instance!.Funds);
        }

        [Fact]
        public void Refuses_to_fire_engineers_a_complex_holds()
        {
            var (cape, _) = Career(capeHired: 30, capeAssigned: 10);

            // RP-1's window greys this and does not stop it; the call would take
            // the pool to -1.
            var result = Fire(false, 21);

            Assert.False(result.Success);
            Assert.Equal(CommandErrorCode.Range, result.ErrorCode);
            Assert.Contains("20 unassigned", result.Detail ?? "");
            Assert.Equal(30, cape.Engineers);
            Assert.Empty(KCTUtilities.EngineerChanges);
        }

        [Fact]
        public void Fires_researchers_and_retimes_the_queue()
        {
            Career(researchers: 12);

            Assert.True(Fire(true, 5, ksc: null).Success);

            Assert.Equal(7, SpaceCenterManagement.Instance!.Researchers);
            Assert.Equal(1, SpaceCenterManagement.Instance.TechTimeUpdates);
        }

        [Fact]
        public void Refuses_to_fire_more_researchers_than_there_are()
        {
            Career(researchers: 4);

            var result = Fire(true, 5, ksc: null);

            Assert.False(result.Success);
            Assert.Equal(CommandErrorCode.Range, result.ErrorCode);
            Assert.Equal(4, SpaceCenterManagement.Instance!.Researchers);
        }

        [Fact]
        public void Says_to_check_the_balance_when_RP1_throws_after_charging()
        {
            Career(funds: 10_000);
            KCTUtilities.ThrowOnHire = true;

            var result = Hire(true, 2, ksc: null);

            Assert.False(result.Success);
            Assert.Contains("check the balance", result.Detail ?? "");
        }

        [Fact]
        public void Refuses_when_RP1_is_not_managing_the_save()
        {
            Career();
            SpaceCenterManagement.Instance!.enabledForSave = false;

            Assert.Equal(Rp1ErrorCodes.NotManaging, Hire(true, 1, ksc: null).ErrorCode);
            Assert.Equal(Rp1ErrorCodes.NotManaging, Fire(true, 1, ksc: null).ErrorCode);
            Assert.Equal(12, SpaceCenterManagement.Instance.Researchers);
        }
    }
}
