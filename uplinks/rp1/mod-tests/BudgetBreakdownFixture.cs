using System;
using System.Collections.Generic;

// The members RP-1's Facilities, Astronauts and Programs tabs call, on the
// stand-ins the other fixtures declare. Names, arities and parameter shapes are
// the shipped v4.6.0.0 ones. GetNautCost keeps RP-1's own branch structure (a
// kerbal in flight adds the flight rate to base pay and skips proficiency pay,
// an inactive one on the ground takes a cut) over settable rates, because which
// branch a kerbal takes is the thing under test.
namespace RP0
{
    public partial class MaintenanceHandler
    {
        public readonly Dictionary<SpaceCenterFacility, double> FacilityMaintenanceCosts =
            new Dictionary<SpaceCenterFacility, double>();

        public readonly SpaceCenterFacility[] FacilitiesForMaintenance =
        {
            SpaceCenterFacility.Administration,
            SpaceCenterFacility.AstronautComplex,
            SpaceCenterFacility.MissionControl,
            SpaceCenterFacility.TrackingStation,
        };

        /// <summary>Ground pay per year at the Astronaut Complex's current tier.</summary>
        public double NautYearlyUpkeep = 3652.5;

        /// <summary>The proficiency upkeep per year a kerbal adds to ground pay, by name.</summary>
        public readonly Dictionary<string, double> NautProficiencyYearly = new Dictionary<string, double>();

        public double NautInFlightDailyRate = 50.0;

        public double NautInactiveMult = 0.5;

        /// <summary>Kerbals RP-1 will not price, so one line can be left unreadable.</summary>
        public readonly HashSet<string> UnpriceableNauts = new HashSet<string>();

        public void GetNautCost(ProtoCrewMember k, out double baseCostPerDay, out double flightCostPerDay)
        {
            if (UnpriceableNauts.Contains(k.name))
            {
                throw new InvalidOperationException("GetNautCost unreadable");
            }
            flightCostPerDay = 0d;
            baseCostPerDay = NautYearlyUpkeep;
            if (k.rosterStatus == ProtoCrewMember.RosterStatus.Assigned)
            {
                flightCostPerDay = NautInFlightDailyRate;
            }
            else
            {
                baseCostPerDay += NautProficiencyYearly.TryGetValue(k.name, out var extra) ? extra : 0d;
                if (k.inactive)
                {
                    baseCostPerDay *= NautInactiveMult;
                }
            }
            baseCostPerDay /= 365.25d;
        }
    }

    public sealed partial class SpaceCenterSettings
    {
        public List<double> nautYearlyUpkeepPerFacLevel = new List<double>();
        public List<double> nautTrainingCostPerFacLevel = new List<double>();
        public double nautTrainingTypeCostMult = 0.25d;
        public Dictionary<string, double> nautYearlyUpkeepPerTraining = new Dictionary<string, double>();
        public List<string> nautUpkeepTrainings = new List<string>();
        public List<bool> nautUpkeepTrainingBools = new List<bool>();

        /// <summary>How many times the scratch list was reset, so a test can hold that every fill is followed by one.</summary>
        public int ResetBoolsCalls;

        public void ResetBools()
        {
            ResetBoolsCalls++;
            for (var i = nautUpkeepTrainingBools.Count; i-- > 0;)
            {
                nautUpkeepTrainingBools[i] = false;
            }
        }

        /// <summary>RP-1's own pairing of the two lists, built from the dictionary's keys as its Load builds them.</summary>
        public void TrainingUpkeep(params (string Training, double PerYear)[] upkeep)
        {
            nautYearlyUpkeepPerTraining.Clear();
            nautUpkeepTrainings.Clear();
            nautUpkeepTrainingBools.Clear();
            foreach (var (training, perYear) in upkeep)
            {
                nautYearlyUpkeepPerTraining[training] = perYear;
                nautUpkeepTrainings.Add(training);
                nautUpkeepTrainingBools.Add(false);
            }
        }

        public void ResetBreakdown()
        {
            nautYearlyUpkeepPerFacLevel = new List<double>();
            nautTrainingCostPerFacLevel = new List<double>();
            nautTrainingTypeCostMult = 0.25d;
            TrainingUpkeep();
            ResetBoolsCalls = 0;
        }
    }
}

namespace RP0.Crew
{
    /// <summary>
    /// RP-1's training graph, reduced to what FillBools answers: which of the
    /// upkeep-bearing proficiencies a training target counts as holding.
    /// </summary>
    public class TrainingDatabase
    {
        /// <summary>Per target, the proficiencies it fills in.</summary>
        public static readonly Dictionary<string, string[]> Fills = new Dictionary<string, string[]>();

        public static void FillBools(string name, List<string> items, List<bool> bools)
        {
            if (!Fills.TryGetValue(name, out var filled))
            {
                return;
            }
            for (var i = 0; i < items.Count; i++)
            {
                if (Array.IndexOf(filled, items[i]) >= 0)
                {
                    bools[i] = true;
                }
            }
        }
    }
}

namespace RP0.Programs
{
    public partial class Program
    {
        /// <summary>What the Program will have paid by a universal time, less what it has already paid.</summary>
        public Func<double, double> FundsAtUt = _ => 0.0;

        /// <summary>The universal times asked about, in order.</summary>
        public readonly List<double> FundsAsks = new List<double>();

        public double GetFundsForFutureTimestamp(double ut)
        {
            FundsAsks.Add(ut);
            return FundsAtUt(ut);
        }
    }
}

public partial class ProtoCrewMember
{
    public enum RosterStatus
    {
        Available,
        Assigned,
        Dead,
        Missing,
    }

    public enum KerbalType
    {
        Crew,
        Applicant,
        Unowned,
        Tourist,
    }

    public RosterStatus rosterStatus { get; set; }

    public KerbalType type { get; set; }
}

public partial class KerbalRoster
{
    /// <summary>KSP's crew-type enumeration, every status included.</summary>
    public IEnumerable<ProtoCrewMember> Crew
    {
        get
        {
            foreach (var kerbal in _kerbals)
            {
                if (kerbal.type == ProtoCrewMember.KerbalType.Crew)
                {
                    yield return kerbal;
                }
            }
        }
    }
}
