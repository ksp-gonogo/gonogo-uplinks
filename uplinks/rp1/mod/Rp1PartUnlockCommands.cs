// Buying the parts a saved craft uses that the career has researched and not yet
// bought. The same sequence RP-1's Integrate button runs before it queues a
// vehicle, read from the shipped RP-1 v4.8.1.0 RP0.dll (VesselBuildValidator
// .ProcessPartAvailability), without the popup:
//
//   1  KCTUtilities.GetPartsWithPurchasability(parts) splits the craft's parts
//      into Purchased, Purchasable (researched, not bought) and Unavailable
//   2  ECMHelper.FindUnlockCost(parts) prices the Purchasable ones. The class is
//      internal and the method public, so reflection reaches it
//   3  UnlockCreditHandler.GetPrePostCostAndAffordability prices the same amount
//      through the currency modifiers, applies unlock credit first and answers
//      whether the funds that remain can be paid
//   4  KCTUtilities.UnlockExperimentalParts(parts) spends credit then funds,
//      marks the parts bought and saves the game
//
// The spend is up front and in two currencies: credit first, funds for what the
// credit does not cover. It is refused, never slowed, when the funds remainder
// cannot be met, so every refusal here is made before step 4 and step 4 is the
// only thing that changes the career.
//
// This is its own command and not a flag on rp1.build.start. The game spends the
// unlock before it checks the vehicle's own price and leaves the parts bought if
// that check fails; a build command that did both would have to order them and
// sum the two affordability checks, and the operator would be billed more than
// the build price they confirmed. Separate presses put each price in front of
// the operator before it is charged.
using System;
using System.Collections;
using System.Collections.Generic;
using System.Globalization;
using Sitrep.Contract;

namespace GonogoRp1Uplink
{
    public sealed partial class Rp1BuildStartCommands
    {
        /// <summary>Unlock the researched parts a craft uses. Must match the client's constant.</summary>
        public const string UnlockCommand = "rp1.parts.unlock";

        /// <summary>Ask what <c>rp1.parts.unlock</c> would cost, without unlocking. Must match the client's constant.</summary>
        public const string UnlockQuoteCommand = "rp1.parts.unlock.quote";

        private const string EcmHelperTypeName = "RP0.ECMHelper";
        private const string CreditTypeName = "RP0.UnlockCreditHandler";
        private const string ReasonsTypeName = "RP0.TransactionReasonsRP0";
        private const string UnlockReasonName = "PartOrUpgradeUnlock";
        private const string PartLoaderTypeName = "PartLoader";
        private const string AvailablePartTypeName = "AvailablePart";
        private const string PurchasableStatus = "Purchasable";
        private const string UnavailableStatus = "Unavailable";

        private readonly Type? _ecmHelper = Rp1Types.Find(EcmHelperTypeName);
        private readonly Type? _credit = Rp1Types.Find(CreditTypeName);
        private readonly Type? _reasons = Rp1Types.Find(ReasonsTypeName);
        private readonly Type? _partLoader = Rp1Types.Find(PartLoaderTypeName);
        private readonly Type? _availablePart = Rp1Types.Find(AvailablePartTypeName);

        /// <summary>
        /// Every RP-1 type the unlock needs resolved. Its own flag beside
        /// <see cref="IsAvailable"/>, because the unlock reaches types the build
        /// does not and a rename of one should withdraw the unlock only.
        /// </summary>
        public bool IsUnlockAvailable =>
            _scm != null && _utilities != null && _ecmHelper != null && _credit != null
            && _reasons != null && _partLoader != null && _availablePart != null;

        /// <summary>
        /// What unlocking the craft's researched parts would cost and whether the
        /// career can pay it. Unlocks nothing and charges nothing.
        ///
        /// <para>Every refusal the press makes before it charges is made here by
        /// the same code, so a craft the press would refuse is refused by the quote
        /// in the same words.</para>
        /// </summary>
        public CommandResult<Rp1PartUnlockQuote> UnlockQuote(Rp1PartUnlockQuoteArgs? args)
        {
            var refusal = PlanUnlock(args?.CraftFile, args?.Facility, out var plan);
            if (refusal != null)
            {
                return RefusedUnlock(refusal);
            }

            return CommandResult<Rp1PartUnlockQuote>.Ok(new Rp1PartUnlockQuote
            {
                PartCount = plan!.PartCount,
                Price = plan.Price,
                CreditApplied = plan.Credit,
                FundsToPay = plan.FundsToPay,
                CreditBalance = CreditBalance(),
                Balance = Rp1Pricing.FundsBalance(),
                Affordable = plan.CanAfford,
            });
        }

        /// <summary>
        /// Buys the researched parts of the craft named by
        /// <see cref="Rp1PartUnlockArgs.CraftFile"/>, spending unlock credit first
        /// and funds for the rest.
        ///
        /// <para>Runs on the game's main thread. Nothing is spent until the plan
        /// has been priced and the funds remainder has been found affordable, and
        /// the craft's parts have been given back before RP-1's own unlock
        /// runs.</para>
        /// </summary>
        public CommandResult Unlock(Rp1PartUnlockArgs? args)
        {
            var refusal = PlanUnlock(args?.CraftFile, args?.Facility, out var plan);
            if (refusal != null)
            {
                return refusal;
            }

            if (!plan!.CanAfford)
            {
                return CommandResult.Fail(
                    CommandErrorCode.InsufficientFunds,
                    "the career cannot unlock these parts: they cost " + Funds(plan.Price)
                    + " funds, " + Funds(plan.Credit) + " of unlock credit covers it and the remaining "
                    + Funds(plan.FundsToPay) + " funds is more than the balance of "
                    + BalanceText(Rp1Pricing.FundsBalance()));
            }

            // Resolved before the call, because everything after it has spent.
            var unlock = Rp1Types.StaticMethod(_utilities!, "UnlockExperimentalParts", 1);
            if (unlock == null)
            {
                return CommandResult.Fail(Rp1ErrorCodes.BuildUnrecognised,
                    "this RP-1 build has no part unlock this Uplink recognises, so nothing was unlocked");
            }

            try
            {
                unlock.Invoke(null, new object[] { plan.Parts });
            }
            catch (Exception ex)
            {
                // The unlock spends before it marks the parts bought, so a throw
                // from inside it can leave the career charged. Said plainly,
                // because an operator who reads "refused" and retries could pay
                // twice.
                return CommandResult.Fail(
                    CommandErrorCode.ModeUnavailable,
                    "RP-1 failed part-way through unlocking these parts, so check the balance and "
                    + "the parts before retrying: " + Rp1Types.ExceptionReason(ex));
            }

            return CommandResult.Ok();
        }

        /// <summary>What an unlock would buy and cost, with RP-1's own part list to hand to the unlock.</summary>
        private sealed class UnlockPlan
        {
            public object Parts = null!;
            public int PartCount;
            public double Price;
            public double Credit;
            public double FundsToPay;
            public bool CanAfford;
        }

        /// <summary>
        /// Every refusal that needs no spend, then the price. Null on success with
        /// the plan set. The craft is opened only to measure it and is given back
        /// before this returns, so the plan holds no live parts.
        /// </summary>
        private CommandResult? PlanUnlock(string? file, KspEditorFacility? facility, out UnlockPlan? plan)
        {
            plan = null;
            if (string.IsNullOrWhiteSpace(file))
            {
                return CommandResult.Fail(
                    CommandErrorCode.NotFound,
                    "the command named no craft file, so nothing was unlocked");
            }

            if (!IsUnlockAvailable)
            {
                return CommandResult.Fail(
                    CommandErrorCode.Unreadable,
                    "RP-1's part unlock could not be resolved, so nothing was unlocked");
            }

            var scm = ScmInstance();
            if (scm == null)
            {
                return CommandResult.Fail(Rp1ErrorCodes.SpaceCentreNotLoaded);
            }

            if (Rp1Types.ReadBool(scm, "enabledForSave") != true)
            {
                return CommandResult.Fail(Rp1ErrorCodes.NotManaging);
            }

            var catalogue = Resolve();
            if (catalogue == null)
            {
                return CommandResult.Fail(
                    CommandErrorCode.ModeUnavailable,
                    "this install cannot open the save's craft files, so nothing was unlocked");
            }

            var target = new Target { Catalogue = catalogue, File = file! };
            var refusal = OpenCraft(target, facility, out var load);
            if (refusal != null)
            {
                return refusal;
            }

            string[] unpurchased;
            try
            {
                var measured = load!.Measured;
                if (measured == null)
                {
                    return CommandResult.Fail(
                        CommandErrorCode.Unreadable,
                        "the craft's parts could not be measured, so nothing was unlocked");
                }

                var missing = Named(measured.MissingParts);
                if (missing != null)
                {
                    return CommandResult.Fail(
                        Rp1ErrorCodes.NotReady,
                        "this install does not have every part the craft is made of: " + missing
                        + ", so nothing was unlocked");
                }

                var locked = Named(measured.LockedParts);
                if (locked != null)
                {
                    return CommandResult.Fail(
                        Rp1ErrorCodes.NotReady,
                        "the craft still uses parts whose tech is not researched: " + locked
                        + ", so nothing was unlocked");
                }

                unpurchased = Distinct(measured.UnpurchasedParts);
            }
            finally
            {
                Release(catalogue, load!.Ship!);
            }

            return PriceUnlock(unpurchased, out plan);
        }

        /// <summary>
        /// Resolves the names to RP-1's parts, keeps the ones RP-1 itself calls
        /// purchasable, and prices them the way its Integrate button does.
        /// </summary>
        private CommandResult? PriceUnlock(string[] names, out UnlockPlan? plan)
        {
            plan = null;
            try
            {
                var candidates = NewPartList();
                var getInfo = Rp1Types.StaticMethod(_partLoader!, "getPartInfoByName", 1);
                if (getInfo == null)
                {
                    return CommandResult.Fail(
                        CommandErrorCode.Unreadable,
                        "RP-1's part lookup could not be reached, so nothing was unlocked");
                }

                foreach (var name in names)
                {
                    var part = getInfo.Invoke(null, new object[] { name });
                    if (part == null)
                    {
                        return CommandResult.Fail(
                            Rp1ErrorCodes.NotReady,
                            "this install does not have every part the craft is made of: " + name
                            + ", so nothing was unlocked");
                    }
                    candidates.Add(part);
                }

                var purchasability = PurchasabilityOf(candidates);
                if (purchasability == null)
                {
                    return CommandResult.Fail(
                        CommandErrorCode.Unreadable,
                        "RP-1's part purchasability could not be read, so nothing was unlocked");
                }

                var purchasable = NewPartList();
                var stillLocked = new List<string>();
                foreach (DictionaryEntry entry in purchasability)
                {
                    var status = Rp1Types.ReadEnumName(entry.Value, "Status");
                    if (status == PurchasableStatus)
                    {
                        purchasable.Add(entry.Key);
                    }
                    else if (status == UnavailableStatus)
                    {
                        stillLocked.Add(Rp1Types.ReadString(entry.Key, "name") ?? "an unnamed part");
                    }
                }

                if (stillLocked.Count > 0)
                {
                    return CommandResult.Fail(
                        Rp1ErrorCodes.NotReady,
                        "the craft still uses parts whose tech is not researched: "
                        + string.Join(", ", stillLocked.ToArray()) + ", so nothing was unlocked");
                }

                if (purchasable.Count == 0)
                {
                    return CommandResult.Fail(
                        CommandErrorCode.WrongState,
                        "none of this craft's parts need unlocking");
                }

                return PriceParts(purchasable, out plan);
            }
            catch (Exception ex)
            {
                return CommandResult.Fail(
                    CommandErrorCode.Unreadable,
                    "RP-1's unlock price for this craft's parts could not be read, so nothing was "
                    + "unlocked: " + Rp1Types.ExceptionReason(ex));
            }
        }

        /// <summary>Price, credit applied, funds to pay and affordability for a list of RP-1 parts.</summary>
        private CommandResult? PriceParts(IList purchasable, out UnlockPlan? plan)
        {
            plan = null;
            var unreadable = CommandResult.Fail(
                CommandErrorCode.Unreadable,
                "RP-1's unlock price for this craft's parts could not be read, so nothing was unlocked");

            var cost = Rp1Types.ToDouble(
                Rp1Types.StaticMethod(_ecmHelper!, "FindUnlockCost", 1)?.Invoke(null, new object[] { purchasable }));
            var credit = Rp1Types.StaticValue(_credit!, "Instance");
            var method = credit == null ? null : Rp1Types.InstanceMethod(credit, "GetPrePostCostAndAffordability", 6);
            if (cost == null || credit == null || method == null)
            {
                return unreadable;
            }

            var arguments = new object?[]
            {
                cost.Value, Enum.Parse(_reasons!, UnlockReasonName), 0.0, 0.0, 0.0, false,
            };
            method.Invoke(credit, arguments);
            if (!(arguments[2] is double price) || !(arguments[3] is double toPay)
                || !(arguments[4] is double applied) || !(arguments[5] is bool canAfford)
                || !IsFinite(price) || !IsFinite(toPay) || !IsFinite(applied))
            {
                return unreadable;
            }

            plan = new UnlockPlan
            {
                Parts = purchasable,
                PartCount = purchasable.Count,
                Price = price,
                Credit = applied,
                FundsToPay = Math.Max(0.0, toPay),
                CanAfford = canAfford,
            };
            return null;
        }

        /// <summary>
        /// RP-1's own split of the parts into purchased, purchasable and
        /// unavailable. Two overloads share the name and arity, one over
        /// <c>Part</c> and one over <c>AvailablePart</c>, so the match is on the
        /// element type of the list.
        /// </summary>
        private IDictionary? PurchasabilityOf(IList parts)
        {
            foreach (var method in _utilities!.GetMethods(System.Reflection.BindingFlags.Public | System.Reflection.BindingFlags.Static))
            {
                if (method.Name != "GetPartsWithPurchasability")
                {
                    continue;
                }
                var parameters = method.GetParameters();
                if (parameters.Length == 1 && parameters[0].ParameterType.IsGenericType
                    && parameters[0].ParameterType.GetGenericArguments()[0] == _availablePart)
                {
                    return method.Invoke(null, new object[] { parts }) as IDictionary;
                }
            }
            return null;
        }

        /// <summary>The <c>List&lt;AvailablePart&gt;</c> RP-1's calls expect, built through the runtime type.</summary>
        private IList NewPartList() =>
            (IList)Activator.CreateInstance(typeof(List<>).MakeGenericType(_availablePart!))!;

        private static string[] Distinct(string[]? names)
        {
            var seen = new HashSet<string>(StringComparer.Ordinal);
            var kept = new List<string>();
            foreach (var name in names ?? new string[0])
            {
                if (!string.IsNullOrEmpty(name) && seen.Add(name))
                {
                    kept.Add(name);
                }
            }
            return kept.ToArray();
        }

        private double? CreditBalance()
        {
            var credit = Rp1Types.StaticValue(_credit!, "Instance");
            return Rp1Types.ReadDouble(credit, "TotalCredit");
        }

        private static bool IsFinite(double value) => !double.IsNaN(value) && !double.IsInfinity(value);

        private static string Funds(double amount) =>
            Math.Round(amount).ToString("N0", CultureInfo.InvariantCulture);

        private static string BalanceText(double? balance) =>
            balance == null ? "an unreadable balance" : Funds(balance.Value) + " funds";

        private static CommandResult<Rp1PartUnlockQuote> RefusedUnlock(CommandResult refusal) =>
            CommandResult<Rp1PartUnlockQuote>.Fail(refusal.ErrorCode!, refusal.Detail);
    }
}
