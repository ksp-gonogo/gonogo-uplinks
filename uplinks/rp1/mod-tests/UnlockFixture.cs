// RP-1's part-unlock surface, declared in RP-1's own namespaces with the shipped
// signatures (v4.8.1.0) so the production walk resolves it the way it resolves
// the real assembly. ECMHelper is INTERNAL with a public method, as shipped:
// the Uplink reaches it by reflection and a fixture that made the class public
// would hide the one thing worth proving about that reach.
using System;
using System.Collections;
using System.Collections.Generic;
using System.Linq;

namespace RP0
{
    public enum PurchasabilityStatus
    {
        Unavailable,
        Purchasable,
        Purchased,
    }

    public struct PartPurchasability
    {
        public PurchasabilityStatus Status;
        public int PartCount;

        public PartPurchasability(PurchasabilityStatus status, int partCount)
        {
            Status = status;
            PartCount = partCount;
        }
    }

    /// <summary>
    /// What a part costs to unlock and which of them the career has bought,
    /// keyed by part name. The entry cost is the part's own funds figure; the
    /// real helper sums them through RealFuels' entry-cost manager and truncates
    /// to an int, which is reproduced because the truncation is part of the price.
    /// </summary>
    internal static class UnlockWorld
    {
        public static readonly Dictionary<string, AvailablePart> Parts = new Dictionary<string, AvailablePart>();
        public static readonly Dictionary<string, double> EntryCosts = new Dictionary<string, double>();
        public static readonly HashSet<string> ResearchedTechs = new HashSet<string>();
        public static readonly HashSet<string> Purchased = new HashSet<string>();
        public static readonly List<List<string>> UnlockedBatches = new List<List<string>>();
        public static bool ThrowOnUnlock;

        public static void Reset()
        {
            Parts.Clear();
            EntryCosts.Clear();
            ResearchedTechs.Clear();
            Purchased.Clear();
            UnlockedBatches.Clear();
            ThrowOnUnlock = false;
            UnlockCreditHandler.Instance = null;
        }

        /// <summary>A part with a tech node and an entry cost, registered with the loader.</summary>
        public static AvailablePart Add(string name, string tech, double entryCost, bool researched = true)
        {
            var part = new AvailablePart(name) { TechRequired = tech };
            Parts[name] = part;
            EntryCosts[name] = entryCost;
            if (researched)
            {
                ResearchedTechs.Add(tech);
            }
            return part;
        }
    }

    internal static class ECMHelper
    {
        public static int FindUnlockCost(List<AvailablePart> availableParts)
        {
            double total = 0.0;
            foreach (var part in availableParts)
            {
                total += UnlockWorld.EntryCosts.TryGetValue(part.name, out var cost) ? cost : 0.0;
            }
            return (int)total;
        }
    }

    public partial class UnlockCreditHandler
    {
        /// <summary>
        /// Shipped body: the query's total is the price after the modifiers,
        /// credit is the smaller of that and the balance, and affordability is
        /// asked of what remains.
        /// </summary>
        public CurrencyModifierQueryRP0 GetPrePostCostAndAffordability(
            double cost,
            TransactionReasonsRP0 reason,
            out double preCreditCost,
            out double postCreditCost,
            out double credit,
            out bool canAfford)
        {
            var query = CurrencyModifierQueryRP0.RunQuery(reason, 0.0 - cost, 0.0, 0.0);
            preCreditCost = 0.0 - query.GetTotal(CurrencyRP0.Funds);
            credit = Math.Min(preCreditCost, TotalCredit);
            postCreditCost = preCreditCost - credit;
            canAfford = postCreditCost <= (Funding.Instance?.Funds ?? 0.0);
            return query;
        }

        /// <summary>Shipped order: credit is drawn first and the excess leaves funds.</summary>
        public void SpendCreditAndCost(List<AvailablePart> parts)
        {
            GetPrePostCostAndAffordability(
                ECMHelper.FindUnlockCost(parts),
                TransactionReasonsRP0.PartOrUpgradeUnlock,
                out var pre,
                out var post,
                out var credit,
                out _);
            _totalCredit -= credit;
            Funding.Instance!.Funds -= post;
        }
    }

    public static partial class KCTUtilities
    {
        public static Dictionary<AvailablePart, PartPurchasability> GetPartsWithPurchasability(List<AvailablePart> parts)
        {
            var result = new Dictionary<AvailablePart, PartPurchasability>();
            foreach (var part in parts)
            {
                var status = UnlockWorld.Purchased.Contains(part.name)
                    ? PurchasabilityStatus.Purchased
                    : UnlockWorld.ResearchedTechs.Contains(part.TechRequired)
                        ? PurchasabilityStatus.Purchasable
                        : PurchasabilityStatus.Unavailable;
                result[part] = new PartPurchasability(status, 1);
            }
            return result;
        }

        /// <summary>The overload over live parts, present because the real class declares both and arity alone cannot tell them apart.</summary>
        public static Dictionary<AvailablePart, PartPurchasability> GetPartsWithPurchasability(List<Part> parts) =>
            throw new InvalidOperationException("the Part overload must never be chosen");

        public static void UnlockExperimentalParts(List<AvailablePart> availableParts)
        {
            if (UnlockWorld.ThrowOnUnlock)
            {
                throw new InvalidOperationException("the unlock failed");
            }
            UnlockCreditHandler.Instance!.SpendCreditAndCost(availableParts);
            foreach (var part in availableParts)
            {
                UnlockWorld.Purchased.Add(part.name);
            }
            UnlockWorld.UnlockedBatches.Add(availableParts.Select(p => p.name).ToList());
        }
    }
}

/// <summary>KSP's part loader, reduced to the one lookup the unlock makes.</summary>
public static class PartLoader
{
    public static AvailablePart? getPartInfoByName(string partName) =>
        RP0.UnlockWorld.Parts.TryGetValue(partName, out var part) ? part : null;
}
