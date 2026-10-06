using System.Collections.Generic;

namespace GonogoRp1Uplink
{
    /// <summary>
    /// Pure mapper: the lines under RP-1's Budget tab to the
    /// <c>rp1.budgetBreakdown</c> dict. KSP-free, RP-1-free and side-effect-free.
    /// </summary>
    public static class Rp1BudgetBreakdownCapture
    {
        /// <summary>The payload, or nothing when RP-1 is not running a career here.</summary>
        public static Dictionary<string, object?>? Build(Rp1BudgetBreakdownRaw? raw)
        {
            if (raw == null)
            {
                return null;
            }
            return new Dictionary<string, object?>
            {
                ["refreshedAt"] = raw.RefreshedAt,
                ["buildings"] = Rows(raw.Buildings, b => new Dictionary<string, object?>
                {
                    ["facility"] = b.Facility,
                    ["upkeep"] = Horizons(b.Upkeep),
                }),
                ["complexes"] = Rows(raw.Complexes, c => new Dictionary<string, object?>
                {
                    ["lcId"] = c.LcId,
                    ["name"] = c.Name,
                    ["kscName"] = c.KscName,
                    ["kscDisplayName"] = c.KscDisplayName,
                    ["operational"] = c.Operational,
                    ["upkeep"] = Horizons(c.Upkeep),
                }),
                ["crew"] = Rows(raw.Crew, k => new Dictionary<string, object?>
                {
                    ["name"] = k.Name,
                    ["inFlight"] = k.InFlight,
                    ["cost"] = Horizons(k.Cost),
                }),
                ["astronautBase"] = Horizons(raw.AstronautBase),
                ["nautBaseSalary"] = Horizons(raw.NautBaseSalary),
                ["astronautOperational"] = Horizons(raw.AstronautOperational),
                ["astronautTraining"] = Horizons(raw.AstronautTraining),
                ["courses"] = Rows(raw.Courses, c => new Dictionary<string, object?>
                {
                    ["id"] = c.Id,
                    ["students"] = c.Students,
                    ["cost"] = Horizons(c.Cost),
                }),
                ["trainingFees"] = Rows(raw.TrainingFees, f => new Dictionary<string, object?>
                {
                    ["templateId"] = f.TemplateId,
                    ["perStudent"] = Horizons(f.PerStudent),
                }),
                ["programs"] = Rows(raw.Programs, p => new Dictionary<string, object?>
                {
                    ["name"] = p.Name,
                    ["title"] = p.Title,
                    ["deadlineUt"] = p.DeadlineUt,
                    ["funding"] = Horizons(p.Funding),
                }),
                ["integrationTeams"] = Rows(raw.IntegrationTeams, t => new Dictionary<string, object?>
                {
                    ["kscName"] = t.KscName,
                    ["kscDisplayName"] = t.KscDisplayName,
                    ["unassigned"] = t.Unassigned,
                    ["lcId"] = t.LcId,
                    ["name"] = t.Name,
                    ["engineers"] = t.Engineers,
                    ["cost"] = Horizons(t.Cost),
                }),
                ["rollouts"] = Rows(raw.Rollouts, r => new Dictionary<string, object?>
                {
                    ["kscName"] = r.KscName,
                    ["kscDisplayName"] = r.KscDisplayName,
                    ["lcId"] = r.LcId,
                    ["lcName"] = r.LcName,
                    ["launchPadId"] = r.LaunchPadId,
                    ["type"] = r.Type,
                    ["associatedVesselId"] = r.AssociatedVesselId,
                    ["vesselName"] = r.VesselName,
                    ["cost"] = Horizons(r.Cost),
                }),
                ["constructions"] = Rows(raw.Constructions, c => new Dictionary<string, object?>
                {
                    ["id"] = c.Id,
                    ["kscName"] = c.KscName,
                    ["kscDisplayName"] = c.KscDisplayName,
                    ["kind"] = c.Kind,
                    ["name"] = c.Name,
                    ["cost"] = Horizons(c.Cost),
                }),
            };
        }

        private static Dictionary<string, object?>? Horizons(Rp1HorizonsRaw? h)
        {
            if (h == null)
            {
                return null;
            }
            return new Dictionary<string, object?>
            {
                ["day"] = h.Day,
                ["month"] = h.Month,
                ["year"] = h.Year,
            };
        }

        private static List<object?>? Rows<T>(List<T>? rows, System.Func<T, Dictionary<string, object?>> map)
        {
            if (rows == null)
            {
                return null;
            }
            var list = new List<object?>(rows.Count);
            foreach (var row in rows)
            {
                list.Add(map(row));
            }
            return list;
        }
    }
}
