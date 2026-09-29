// RP-1's leaders, read the way its Administration Building's Leaders tab reads
// them. No compile-time reference to RP0.dll, the same arm's-length reflection
// pattern as Rp1ScReflection, whose header carries the provenance rules this
// file follows.
//
// WHAT WAS MISSING. rp1.leader.appoint asks every arm of CanBeActivated that
// does not need the screen, and RP-1 keeps two rules OUTSIDE CanBeActivated: a
// leader whose REQUIREMENTS block is unmet (StrategyConfigRP0.IsUnlocked) and a
// leader dismissed within its re-hire cooldown, or dismissed for good
// (StrategyConfigRP0.IsAvailable). RP-1 applies both only as a FILTER on the
// list its Administration screen draws (the StrategySystem.GetStrategies
// patch), so a leader failing either is simply not offered there. The console
// offered it anyway, and appointing one went through.
//
// WHAT THIS DOES. The two rules are ASKED, never reproduced: IsUnlocked()
// evaluates the compiled REQUIREMENTS predicate and IsAvailable(dateDeactivated)
// is the same call the patched list makes. The arithmetic here only puts words
// and dates on a refusal RP-1 has already made.
//
// THE DISMISSAL COST. StrategyRP0.DeactivateCost() is what DeactivateOverride
// charges, and RP-1's AddReputation prefix adds it to reputation as it stands
// (no curve, no modifier), so the figure published is the figure taken. What it
// does to income is RP-1's own FillSubsidyDetails asked at today's reputation
// and at today's less the cost, each through the Subsidy query as the budget's
// subsidy figures are.
//
// PROVENANCE. Every RP-1 member was read out of an ilspycmd disassembly of the
// installed RP-1 v4.7.0.0 RP0.dll and is pinned by the installed-compatibility
// suite. Nothing here has been exercised against a running game, so every hop is
// null-safe.
//
// MAIN THREAD. IsUnlocked runs a predicate compiled from a config's
// REQUIREMENTS block, which reaches tech, contract and facility state, and
// DeactivateCost and the Subsidy query read Planetarium and fire currency
// modifier events.
using System;
using System.Collections;
using System.Collections.Generic;
using System.Reflection;

namespace GonogoRp1Uplink
{
    /// <summary>
    /// Reads every RP-1 leader and what appointing or dismissing it would cost,
    /// and answers whether RP-1 would offer one for appointment.
    /// </summary>
    public sealed class Rp1LeadersReflection
    {
        private const double SecondsPerDay = 86400d;

        /// <summary>RP-1's Julian year, the one its subsidy curve is stated over.</summary>
        private const double DaysPerYear = 365.25d;

        private const string StrategySystemTypeName = "Strategies.StrategySystem";
        private const string MaintenanceTypeName = "RP0.MaintenanceHandler";
        private const string CurrencyUtilsTypeName = "RP0.CurrencyUtils";
        private const string TransactionReasonsTypeName = "RP0.TransactionReasonsRP0";

        /// <summary>KSP's own, global-namespaced.</summary>
        private const string ReputationTypeName = "Reputation";

        private readonly Type? _strategySystem;
        private readonly Type? _strategyRp0;
        private readonly Type? _programStrategy;
        private readonly Type? _programHandler;
        private readonly Type? _subsidyDetails;
        private readonly Type? _transactionReasons;
        private readonly Type? _reputation;
        private readonly MethodInfo? _fillSubsidyDetails;
        private readonly MethodInfo? _funds;

        public Rp1LeadersReflection()
        {
            _strategySystem = Rp1Types.Find(StrategySystemTypeName);
            _strategyRp0 = Rp1Types.Find(Rp1StrategyWrites.StrategyRp0TypeName);
            _programStrategy = Rp1Types.Find(Rp1StrategyWrites.ProgramStrategyTypeName);
            _programHandler = Rp1Types.Find(Rp1StrategyWrites.ProgramHandlerTypeName);
            _subsidyDetails = Rp1Types.Find(MaintenanceTypeName + "+SubsidyDetails");
            _transactionReasons = Rp1Types.Find(TransactionReasonsTypeName);
            _reputation = Rp1Types.Find(ReputationTypeName);

            var maintenance = Rp1Types.Find(MaintenanceTypeName);
            if (maintenance != null)
            {
                _fillSubsidyDetails = Rp1Types.StaticMethod(maintenance, "FillSubsidyDetails", 3);
            }
            var currency = Rp1Types.Find(CurrencyUtilsTypeName);
            if (currency != null)
            {
                // includeHidden is last and defaulted, which a reflected call does
                // not supply, so it is passed explicitly.
                _funds = Rp1Types.StaticMethod(currency, "Funds", 3);
            }
        }

        /// <summary>RP-1's strategy types resolved, so a roster can be told apart from Programs.</summary>
        public bool IsAvailable => _strategySystem != null && _strategyRp0 != null && _programStrategy != null;

        /// <summary>
        /// Every leader on the career's roster, or null when there is no roster to
        /// read: the main menu, or a save RP-1 does not manage.
        /// </summary>
        public Rp1LeadersRaw? Read(double ut)
        {
            if (!IsAvailable)
            {
                return null;
            }
            var system = Rp1Types.StaticValue(_strategySystem!, "Instance");
            if (system == null)
            {
                return null;
            }
            var handler = _programHandler == null ? null : Rp1Types.StaticValue(_programHandler, "Instance");
            var reputation = Reputation();

            var raw = new Rp1LeadersRaw { Ut = ut, Available = true };
            foreach (var strategy in Rp1Types.Enumerate(Rp1Types.Member(system, "Strategies")))
            {
                if (!_strategyRp0!.IsInstanceOfType(strategy)
                    || Rp1StrategyWrites.IsProgramStrategy(strategy, _programStrategy))
                {
                    continue;
                }
                raw.Leaders.Add(ReadLeader(strategy, handler, reputation, ut));
            }
            return raw;
        }

        private Rp1LeaderRaw ReadLeader(object strategy, object? handler, double? reputation, double ut)
        {
            var config = Config(strategy);
            var active = Rp1Types.ReadBool(strategy, "IsActive");
            var cooldown = Rp1Types.ReadDouble(config, "ReactivateCooldown");
            var leader = new Rp1LeaderRaw
            {
                StrategyId = Rp1Types.ReadString(config, "Name"),
                Title = Rp1Types.ReadString(config, "Title"),
                Department = Rp1Types.ReadString(strategy, "DepartmentName"),
                Active = active,
                RemoveOnDeactivate = Rp1Types.ReadBool(config, "RemoveOnDeactivate"),
                ReactivateCooldown = cooldown,
            };
            ReadSetupCosts(config, leader);

            if (active == true)
            {
                ReadDismissal(strategy, leader, reputation, ut);
                return leader;
            }

            var verdict = AppointVerdict(strategy, handler);
            leader.CanAppoint = verdict.Refusal == null;
            leader.AppointBlockedReason = verdict.Refusal;
            if (verdict.DismissedUt is double dismissed && cooldown is double wait && wait > 0)
            {
                leader.RehireFromUt = dismissed + wait;
            }
            return leader;
        }

        /// <summary>
        /// <c>SetupCosts</c>, the one price <c>PerformActivate</c> charges. A
        /// currency the dictionary does not name is a zero RP-1 charges, which is
        /// every currency on every shipped leader; the whole set stays absent only
        /// when the dictionary could not be read.
        /// </summary>
        private static void ReadSetupCosts(object? config, Rp1LeaderRaw leader)
        {
            if (!(Rp1Types.Member(config, "SetupCosts") is IDictionary costs))
            {
                return;
            }
            leader.SetupFunds = 0d;
            leader.SetupScience = 0d;
            leader.SetupReputation = 0d;
            leader.SetupConfidence = 0d;
            foreach (DictionaryEntry entry in costs)
            {
                var amount = Rp1Types.ToDouble(entry.Value);
                switch (entry.Key?.ToString())
                {
                    case "Funds":
                        leader.SetupFunds = amount;
                        break;
                    case "Science":
                        leader.SetupScience = amount;
                        break;
                    case "Reputation":
                        leader.SetupReputation = amount;
                        break;
                    case "Confidence":
                        leader.SetupConfidence = amount;
                        break;
                }
            }
        }

        /// <summary>
        /// What dismissing a serving leader takes, and when it can be done at all.
        /// </summary>
        /// <remarks>
        /// The two instants are stock's <c>LeastDuration</c> (below which stock's
        /// <c>CanBeDeactivated</c> refuses) and RP-1's <c>RemovePenaltyDuration</c>
        /// (from which <c>DeactivateCost</c> is zero), both counted from
        /// <c>DateActivated</c>.
        /// </remarks>
        private void ReadDismissal(object strategy, Rp1LeaderRaw leader, double? reputation, double ut)
        {
            var activated = Rp1Types.ReadDouble(strategy, "DateActivated");
            if (activated != null)
            {
                var least = Rp1Types.ReadDouble(strategy, "LeastDuration");
                leader.CanRemoveFromUt = least == null ? null : activated + Math.Max(least.Value, 0d);
                var penalty = Rp1Types.ReadDouble(strategy, "RemovePenaltyDuration");
                leader.FreeToRemoveFromUt = penalty == null ? null : activated + penalty;
            }

            var cost = Finite(Invoke(strategy, "DeactivateCost"));
            leader.DeactivateReputation = cost;
            if (cost != null && reputation != null)
            {
                var now = SubsidyPerDay(ut, reputation.Value);
                var after = SubsidyPerDay(ut, reputation.Value - cost.Value);
                leader.DismissSubsidyLossPerDay = now == null || after == null ? null : Finite(now - after);
            }
        }

        /// <summary>
        /// Whether RP-1 would offer this inactive leader for appointment, with the
        /// refusal in words when it would not.
        /// </summary>
        /// <remarks>
        /// <para>Asks the same three things RP-1's Administration list filter
        /// does, in its order: <c>IsDisabled</c>, then <c>IsUnlocked()</c>, then
        /// <c>IsAvailable(dateDeactivated)</c>. <c>IsAvailable</c> ends by asking
        /// <c>IsUnlocked</c> again, so it is asked first on its own to tell a
        /// locked leader from one in its cooldown.</para>
        ///
        /// <para>A question RP-1 would not answer refuses rather than passing:
        /// an appointment made on an unanswered rule is one the game might never
        /// have allowed.</para>
        /// </remarks>
        public static Rp1LeaderVerdict AppointVerdict(object strategy, object? programHandler)
        {
            var config = Config(strategy);
            if (config == null)
            {
                return Rp1LeaderVerdict.Refuse("RP-1's configuration for this leader could not be read");
            }
            if (Rp1Types.ReadBool(config, "IsDisabled") == true)
            {
                return Rp1LeaderVerdict.Refuse("RP-1 has disabled this leader in its configuration");
            }

            object? unlocked;
            object? available;
            try
            {
                unlocked = Rp1Types.InstanceMethod(config, "IsUnlocked", 0)?.Invoke(config, Array.Empty<object?>());
                if (!(unlocked is bool))
                {
                    return Rp1LeaderVerdict.Refuse("RP-1 would not say whether this leader's requirements are met");
                }
                if (!(bool)unlocked)
                {
                    return Rp1LeaderVerdict.Refuse("RP-1 has not unlocked this leader: its requirements are not met yet");
                }

                var dateDeactivated = Rp1Types.ReadDouble(strategy, "DateDeactivated") ?? 0d;
                available = Rp1Types.InstanceMethod(config, "IsAvailable", 1)
                    ?.Invoke(config, new object?[] { dateDeactivated });
            }
            catch (Exception ex)
            {
                return Rp1LeaderVerdict.Refuse("RP-1 threw while judging whether this leader is offered: "
                    + Rp1Types.ExceptionReason(ex));
            }

            if (!(available is bool offered))
            {
                return Rp1LeaderVerdict.Refuse("RP-1 would not say whether this leader can be hired again");
            }
            var dismissed = LastDismissed(config, programHandler);
            if (offered)
            {
                return new Rp1LeaderVerdict(null, dismissed);
            }

            var cooldown = Rp1Types.ReadDouble(config, "ReactivateCooldown");
            if (dismissed != null && cooldown is double wait && wait > 0)
            {
                return new Rp1LeaderVerdict(
                    $"RP-1 lets a dismissed leader be re-hired only {Days(wait)} after the dismissal, and that has not passed",
                    dismissed);
            }
            if (dismissed != null)
            {
                return new Rp1LeaderVerdict("RP-1 does not let this leader be hired again once dismissed", dismissed);
            }
            return new Rp1LeaderVerdict("RP-1 does not offer this leader for appointment now", null);
        }

        /// <summary>
        /// When this leader, or any leader sharing its <c>removeOnDeactivateTag</c>,
        /// was last dismissed: the later of the two <c>ActivatedStrategies</c>
        /// stamps <c>IsAvailable</c> itself compares, or null when neither records
        /// a dismissal. RP-1 stamps -1 on appointment, so only a positive instant
        /// is a dismissal.
        /// </summary>
        private static double? LastDismissed(object config, object? programHandler)
        {
            if (!(Rp1Types.Member(programHandler, "ActivatedStrategies") is IDictionary stamps))
            {
                return null;
            }
            double? latest = null;
            foreach (var key in new[] { Rp1Types.ReadString(config, "Name"), Rp1Types.ReadString(config, "RemoveOnDeactivateTag") })
            {
                if (string.IsNullOrEmpty(key) || !stamps.Contains(key!))
                {
                    continue;
                }
                var at = Rp1Types.ToDouble(stamps[key!]);
                if (at is double stamp && stamp > 0 && (latest == null || stamp > latest))
                {
                    latest = stamp;
                }
            }
            return latest;
        }

        private static object? Config(object strategy) => Rp1Types.Member(strategy, "ConfigRP0");

        private static string Days(double seconds)
        {
            var days = Math.Round(seconds / SecondsPerDay);
            return days == 1 ? "1 day" : $"{days:0} days";
        }

        private double? Reputation()
        {
            var instance = _reputation == null ? null : Rp1Types.StaticValue(_reputation, "Instance");
            return instance == null ? null : Rp1Types.ReadDouble(instance, "reputation");
        }

        /// <summary>
        /// The subsidy per day RP-1 pays at this reputation today, after the
        /// career's modifiers: <c>FillSubsidyDetails</c>' yearly figure through the
        /// Subsidy query, over RP-1's Julian year. Null when any hop will not
        /// answer, which leaves the leader's subsidy loss absent.
        /// </summary>
        private double? SubsidyPerDay(double ut, double reputation)
        {
            if (_fillSubsidyDetails == null || _subsidyDetails == null || _funds == null || _transactionReasons == null)
            {
                return null;
            }
            try
            {
                // A ref struct travels boxed in the args array: the method writes
                // into the box and the box is read back.
                var args = new object?[] { Activator.CreateInstance(_subsidyDetails), ut, reputation };
                _fillSubsidyDetails.Invoke(null, args);
                var perYear = Rp1Types.ReadDouble(args[0], "subsidy");
                if (perYear == null)
                {
                    return null;
                }
                var reason = Enum.Parse(_transactionReasons, "Subsidy");
                var queried = Rp1Types.ToDouble(_funds.Invoke(null, new object[] { reason, perYear.Value, false }));
                return queried == null ? null : Finite(queried.Value / DaysPerYear);
            }
            catch (Exception)
            {
                return null;
            }
        }

        private static double? Invoke(object target, string name)
        {
            try
            {
                return Rp1Types.ToDouble(Rp1Types.InstanceMethod(target, name, 0)?.Invoke(target, Array.Empty<object?>()));
            }
            catch (Exception)
            {
                return null;
            }
        }

        /// <summary>A number JSON can carry.</summary>
        private static double? Finite(double? value) =>
            value == null || double.IsNaN(value.Value) || double.IsInfinity(value.Value) ? null : value;
    }

    /// <summary>
    /// RP-1's answer to "would it offer this leader now", and when the leader was
    /// last dismissed, which dates a cooldown.
    /// </summary>
    public readonly struct Rp1LeaderVerdict
    {
        public Rp1LeaderVerdict(string? refusal, double? dismissedUt)
        {
            Refusal = refusal;
            DismissedUt = dismissedUt;
        }

        /// <summary>Why not, in a sentence, or null when RP-1 offers the leader.</summary>
        public string? Refusal { get; }

        public double? DismissedUt { get; }

        public static Rp1LeaderVerdict Refuse(string refusal) => new Rp1LeaderVerdict(refusal, null);
    }
}
