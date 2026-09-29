using System.Collections.Generic;

// The members the research rate table reads that no other stand-in declared,
// named and shaped as the shipped RP-1 v4.6.0.0 and v4.7.0.0 RP0.dll declare
// them.
namespace RP0
{
    public sealed partial class SpaceCenterSettings
    {
        /// <summary>The share of salary a researcher is paid while the queue is stopped. RP-1's compiled default.</summary>
        public double ResearcherIdleSalaryMult = 0.5;

        /// <summary>
        /// A <c>PersistentSortedListValueTypes&lt;int, double&gt;</c> on the real
        /// type: each key is the researcher count a tier runs up to, and the
        /// value is what each researcher in it earns towards Unlock Credit.
        /// </summary>
        public SortedList<int, double> researchersToUnlockCreditSalaryMultipliers = new SortedList<int, double>();
    }

    public partial class UnlockCreditHandler
    {
        /// <summary>Private on the real type, set from the difficulty settings on load.</summary>
        private double _unlockCredRate;

        public void SetUnlockCredRate(double rate) => _unlockCredRate = rate;

        /// <summary>
        /// RP-1's own CreditForTime, line for line, at the rate on the head of the
        /// queue: the figure the table's step at that rate has to reproduce.
        /// </summary>
        public double ShippedCreditForTime(double UT)
        {
            var scm = SpaceCenterManagement.Instance!;
            if (scm.TechList.Count == 0)
            {
                return 0.0;
            }
            var workRate = scm.TechList[0].workRate;
            if (workRate == 0.0)
            {
                return 0.0;
            }
            var num = UT * _unlockCredRate * workRate * Database.SettingsSC.salaryResearchers * 3.168808781402895E-08;
            var researchers = scm.Researchers;
            var num2 = 0;
            var num3 = 0.0;
            foreach (var tier in Database.SettingsSC.researchersToUnlockCreditSalaryMultipliers)
            {
                if (num2 >= researchers)
                {
                    break;
                }
                var num4 = tier.Key - num2;
                var num5 = researchers - num2;
                if (num4 > num5)
                {
                    num4 = num5;
                }
                num3 += num4 * tier.Value;
                num2 += num4;
            }
            return num3 * num;
        }
    }
}
