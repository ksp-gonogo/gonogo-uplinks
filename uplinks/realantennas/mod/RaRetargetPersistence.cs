using System.Globalization;

namespace Gonogo.RealAntennasUplink
{
    /// <summary>
    /// ConfigNode round trip for <see cref="RaRetargetRegister"/>: the opt-outs,
    /// every open loan with what the dish must go back to, and each craft's last
    /// finished loan. Loaded into the process's existing register, as the chains
    /// are, so a command handler registered once keeps writing to the register
    /// the current save is in.
    ///
    /// <para>A loan that will not parse is skipped rather than thrown on: the
    /// cost of dropping one is a dish left on its borrowed aim until the operator
    /// moves it, the cost of throwing is every other record in the module.</para>
    /// </summary>
    internal static class RaRetargetPersistence
    {
        private const string RootNodeName = "REALANTENNAS_RETARGET";
        private const string LoanNodeName = "BORROW";
        private const string OptOutNodeName = "OPTOUT";
        private const string PreviousNodeName = "PREVIOUS";

        public static void Save(RaRetargetRegister register, ConfigNode node)
        {
            if (register == null || node == null)
            {
                return;
            }
            var root = node.AddNode(RootNodeName);
            foreach (var vessel in register.OptedOut)
            {
                root.AddNode(OptOutNodeName).AddValue("vessel", vessel);
            }
            foreach (var borrow in Everything(register))
            {
                var loan = root.AddNode(LoanNodeName);
                loan.AddValue("id", borrow.Id);
                loan.AddValue("dish", borrow.DishId);
                loan.AddValue("peer", borrow.PeerId);
                loan.AddValue("dishName", borrow.DishName);
                loan.AddValue("previousLabel", borrow.PreviousLabel);
                loan.AddValue("turnedUt", borrow.TurnedUt.ToString("R", CultureInfo.InvariantCulture));
                loan.AddValue("outcome", ((int)borrow.Outcome).ToString(CultureInfo.InvariantCulture));
                if (!double.IsNaN(borrow.SettledUt))
                {
                    loan.AddValue("settledUt", borrow.SettledUt.ToString("R", CultureInfo.InvariantCulture));
                }
                RaChainPersistence.WriteStep(loan.AddNode(PreviousNodeName), borrow.Previous);
            }
        }

        public static void Load(RaRetargetRegister register, ConfigNode node)
        {
            var root = node?.GetNode(RootNodeName);
            if (register == null || root == null)
            {
                return;
            }
            foreach (var optOut in root.GetNodes(OptOutNodeName))
            {
                var vessel = optOut.GetValue("vessel");
                if (!string.IsNullOrEmpty(vessel))
                {
                    register.SetAllowed(vessel, false);
                }
            }
            foreach (var loan in root.GetNodes(LoanNodeName))
            {
                var id = loan.GetValue("id");
                var dish = loan.GetValue("dish");
                var previousNode = loan.GetNode(PreviousNodeName);
                var previous = previousNode == null ? null : RaChainPersistence.ReadStep(previousNode);
                if (string.IsNullOrEmpty(id) || string.IsNullOrEmpty(dish) || previous == null
                    || !RaDishIds.TryParse(dish, out var nodeId, out _, out _)
                    || !double.TryParse(loan.GetValue("turnedUt"), NumberStyles.Float, CultureInfo.InvariantCulture, out var turnedUt)
                    || !int.TryParse(loan.GetValue("outcome"), NumberStyles.Integer, CultureInfo.InvariantCulture, out var outcome))
                {
                    continue;
                }
                var settled = double.NaN;
                if (double.TryParse(loan.GetValue("settledUt"), NumberStyles.Float, CultureInfo.InvariantCulture, out var settledUt))
                {
                    settled = settledUt;
                }
                register.Restore(new RaRetargetRegister.Borrow
                {
                    Id = id!,
                    DishId = dish!,
                    VesselId = RaDishIds.VesselGuid(nodeId) ?? nodeId,
                    PeerId = loan.GetValue("peer") ?? "",
                    DishName = loan.GetValue("dishName") ?? "",
                    Previous = previous,
                    PreviousLabel = loan.GetValue("previousLabel") ?? "",
                    TurnedUt = turnedUt,
                    Outcome = (RaBorrowOutcome)outcome,
                    SettledUt = settled,
                });
            }
        }

        private static System.Collections.Generic.IEnumerable<RaRetargetRegister.Borrow> Everything(RaRetargetRegister register)
        {
            var seen = new System.Collections.Generic.HashSet<string>();
            foreach (var borrow in register.Open)
            {
                if (seen.Add(borrow.Id))
                {
                    yield return borrow;
                }
            }
            foreach (var borrow in register.LastEnded.Values)
            {
                if (seen.Add(borrow.Id))
                {
                    yield return borrow;
                }
            }
        }
    }
}
