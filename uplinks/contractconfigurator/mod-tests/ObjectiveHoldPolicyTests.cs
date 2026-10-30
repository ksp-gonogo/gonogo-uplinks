using System;
using Sitrep.Contract;
using Xunit;

namespace Gonogo.ContractConfiguratorUplink.Tests
{
    public class ObjectiveHoldPolicyTests
    {
        private static HoldFacts Facts(ObjectiveState target, ObjectiveState? current = ObjectiveState.Unmet, string craft = "craft-1") =>
            new HoldFacts
            {
                Target = target,
                Current = current,
                Enabled = true,
                ReadyToComplete = true,
                SourceVesselId = craft,
            };

        private static bool Never(double ut) => false;

        [Fact]
        public void A_change_from_a_craft_is_held()
        {
            Assert.Equal(HoldAction.Hold, ObjectiveHoldPolicy.Decide(Facts(ObjectiveState.Met), Never));
        }

        [Fact]
        public void A_change_with_no_craft_behind_it_goes_through()
        {
            Assert.Equal(HoldAction.LetThrough, ObjectiveHoldPolicy.Decide(Facts(ObjectiveState.Met, craft: ""), Never));
        }

        [Fact]
        public void A_disabled_objective_goes_through_to_be_ignored_by_the_game()
        {
            var facts = Facts(ObjectiveState.Met);
            facts.Enabled = false;
            Assert.Equal(HoldAction.LetThrough, ObjectiveHoldPolicy.Decide(facts, Never));
        }

        [Fact]
        public void Repeating_the_state_it_is_already_in_goes_through_as_the_no_op_it_is()
        {
            Assert.Equal(HoldAction.LetThrough, ObjectiveHoldPolicy.Decide(Facts(ObjectiveState.Unmet, ObjectiveState.Unmet), Never));
        }

        [Fact]
        public void Repeating_a_pending_target_is_skipped_rather_than_held_again()
        {
            var facts = Facts(ObjectiveState.Met);
            facts.PendingTarget = ObjectiveState.Met;
            Assert.Equal(HoldAction.Skip, ObjectiveHoldPolicy.Decide(facts, Never));
        }

        [Fact]
        public void Reverting_a_pending_change_is_held_behind_it_even_though_home_already_shows_that_state()
        {
            var facts = Facts(ObjectiveState.Unmet, ObjectiveState.Unmet);
            facts.PendingTarget = ObjectiveState.Met;
            Assert.Equal(HoldAction.Hold, ObjectiveHoldPolicy.Decide(facts, Never));
        }

        [Fact]
        public void A_move_to_met_the_game_would_refuse_goes_through_to_be_refused()
        {
            var facts = Facts(ObjectiveState.Met);
            facts.ReadyToComplete = false;
            Assert.Equal(HoldAction.LetThrough, ObjectiveHoldPolicy.Decide(facts, Never));
        }

        [Fact]
        public void A_failure_is_held_like_any_other_change()
        {
            Assert.Equal(HoldAction.Hold, ObjectiveHoldPolicy.Decide(Facts(ObjectiveState.Failed), Never));
        }

        private static HoldFacts TimerFacts(ObjectiveState target, double? end = 500.0)
        {
            var facts = Facts(target, ObjectiveState.Met);
            facts.IsTimer = true;
            facts.TimerEndUt = end;
            return facts;
        }

        [Fact]
        public void A_timer_failure_waits_while_word_stamped_before_its_end_is_in_transit()
        {
            double? asked = null;
            var action = ObjectiveHoldPolicy.Decide(TimerFacts(ObjectiveState.Failed), ut =>
            {
                asked = ut;
                return true;
            });
            Assert.Equal(HoldAction.Skip, action);
            Assert.Equal(500.0, asked);
        }

        [Fact]
        public void A_timer_failure_goes_through_once_nothing_before_its_end_is_in_transit()
        {
            Assert.Equal(HoldAction.LetThrough, ObjectiveHoldPolicy.Decide(TimerFacts(ObjectiveState.Failed), Never));
        }

        [Fact]
        public void A_timer_failure_is_never_put_on_the_line_as_a_craft_change()
        {
            Assert.NotEqual(HoldAction.Hold, ObjectiveHoldPolicy.Decide(TimerFacts(ObjectiveState.Failed), ut => true));
        }

        [Fact]
        public void A_timer_starting_is_not_held()
        {
            var facts = TimerFacts(ObjectiveState.Met);
            facts.Current = ObjectiveState.Unmet;
            Assert.Equal(HoldAction.LetThrough, ObjectiveHoldPolicy.Decide(facts, ut => true));
        }

        [Fact]
        public void A_timer_that_has_not_started_has_no_end_to_wait_for()
        {
            Assert.Equal(HoldAction.LetThrough, ObjectiveHoldPolicy.Decide(TimerFacts(ObjectiveState.Failed, end: null), ut => true));
        }
    }

    public class PendingLedgerTests
    {
        private static readonly Guid Contract = Guid.NewGuid();

        [Fact]
        public void Reports_the_latest_target_while_the_line_holds_something_for_the_contract()
        {
            var ledger = new PendingLedger();
            ledger.Held(Contract, "0", ObjectiveState.Met);
            ledger.Held(Contract, "0", ObjectiveState.Unmet);
            Assert.Equal(ObjectiveState.Unmet, ledger.LatestTarget(Contract, "0", _ => true));
        }

        [Fact]
        public void Another_objective_of_the_same_contract_has_nothing_pending()
        {
            var ledger = new PendingLedger();
            ledger.Held(Contract, "0", ObjectiveState.Met);
            Assert.Null(ledger.LatestTarget(Contract, "1", _ => true));
        }

        [Fact]
        public void Forgets_entries_once_the_line_holds_nothing_for_the_contract()
        {
            var ledger = new PendingLedger();
            ledger.Held(Contract, "0", ObjectiveState.Met);
            Assert.Null(ledger.LatestTarget(Contract, "0", _ => false));
            Assert.Null(ledger.LatestTarget(Contract, "0", _ => true));
        }

        [Fact]
        public void Keeps_an_objective_until_every_change_for_it_has_been_made()
        {
            var ledger = new PendingLedger();
            ledger.Held(Contract, "0", ObjectiveState.Met);
            ledger.Held(Contract, "0", ObjectiveState.Unmet);
            ledger.Settled(Contract, "0");
            Assert.Equal(ObjectiveState.Unmet, ledger.LatestTarget(Contract, "0", _ => true));
            ledger.Settled(Contract, "0");
            Assert.Null(ledger.LatestTarget(Contract, "0", _ => true));
        }
    }

    public class ContractConfiguratorHealthTests
    {
        [Fact]
        public void Is_unavailable_when_contract_configurator_is_not_loaded()
        {
            Assert.Equal(UplinkHealthState.Unavailable, ContractConfiguratorHealth.Of(false, null, false).State);
        }

        [Fact]
        public void Is_degraded_when_the_hooks_failed()
        {
            var health = ContractConfiguratorHealth.Of(true, "no such method", false);
            Assert.Equal(UplinkHealthState.Degraded, health.State);
            Assert.Contains("no such method", health.Detail);
        }

        [Fact]
        public void Is_degraded_when_gonogo_offers_no_line()
        {
            Assert.Equal(UplinkHealthState.Degraded, ContractConfiguratorHealth.Of(true, null, true).State);
        }

        [Fact]
        public void Is_healthy_otherwise()
        {
            Assert.Equal(UplinkHealthState.Healthy, ContractConfiguratorHealth.Of(true, null, false).State);
        }
    }
}
