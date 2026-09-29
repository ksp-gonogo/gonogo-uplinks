// Setting the work rate on a construction already under way, and cancelling one:
// the two controls RP-1 draws on every row of its own construction list
// (KCT_GUI.RenderConstructionList), the slider and the "X".
//
// BOTH ARE THE WHOLE OF WHAT RP-1 DOES, read on the shipped RP-1 v4.6.0.0 and
// v4.7.0.0 RP0.dll, which agree on every member below:
//
//   The slider    constructionProject.workRate =
//                     (float)Mathf.RoundToInt(slider * 20f) * 0.05f
//                 over 0 to 1.5, written every frame the list is drawn. Nothing
//                 else is called: GetBuildRate multiplies the stored workRate in
//                 on every read, and RushMultiplier reads it on every draw, so
//                 the new rate is RP-1's from the next tick on. The value is
//                 written the way the slider writes it, through a float, so a
//                 rate set here is bit-for-bit one the slider could have set
//
//   The "X"       a confirmation naming spentRushCost as already spent, then
//                 KCT_GUI.CancelConstruction(index), whose whole body is a log
//                 line and ConstructionProject.Cancel(). Cancel() runs the
//                 kind's own ProcessCancel: a facility upgrade leaves its centre's
//                 list, a new complex is deleted, a renovation puts the complex
//                 back in service with its pads repriced and its engineers
//                 returned, and a pad is removed from its complex. None of them
//                 refunds anything
//
// CancelConstruction indexes the ACTIVE centre's merged list, which is why it is
// not called: an index is a position in a list the operator is not looking at,
// and under KSCSwitcher the active centre need not be the one the construction
// belongs to. The project is found by its own id across every centre instead,
// and Cancel() is called on it directly, which is the only thing
// CancelConstruction does with it.
//
// NOTHING HERE IS REFUSED ON AFFORDABILITY. A construction is a progressive
// spend: ConstructionProject.AddProgress draws the funds as the work advances
// and throttles itself to what the career can meet. A higher rate is a faster
// drain, never a refused one.
using System;
using System.Collections.Generic;
using Sitrep.Contract;

namespace GonogoRp1Uplink
{
    /// <summary>
    /// <c>rp1.construction.setRate</c> and <c>rp1.construction.cancel</c>.
    /// </summary>
    public sealed class Rp1ConstructionCommands
    {
        public const string SetRateCommand = "rp1.construction.setRate";

        public const string CancelCommand = "rp1.construction.cancel";

        /// <summary>The top of RP-1's slider: half as fast again as the full rate.</summary>
        public const double MaxWorkRate = 1.5;

        /// <summary>RP-1's slider steps: twenty to the full rate.</summary>
        public const int StepsPerUnit = 20;

        private const string ScmTypeName = "RP0.SpaceCenterManagement";

        private readonly Type? _scm;

        public Rp1ConstructionCommands() => _scm = Rp1Types.Find(ScmTypeName);

        /// <summary>RP-1's space centre type resolved, so the commands can be offered at all.</summary>
        public bool IsAvailable => _scm != null;

        /// <summary>
        /// The slider step a rate names, or null when it is off RP-1's range or
        /// between two steps. Refused rather than rounded, so what lands is what
        /// the operator was shown.
        /// </summary>
        public static int? StepOf(double workRate)
        {
            if (double.IsNaN(workRate) || workRate < 0 || workRate > MaxWorkRate + 1e-9)
            {
                return null;
            }
            var step = Math.Round(workRate * StepsPerUnit);
            return Math.Abs(step - workRate * StepsPerUnit) > 1e-6 ? (int?)null : (int)step;
        }

        /// <summary>A slider step as the value RP-1's slider stores for it.</summary>
        public static double RateAt(int step) => (float)step * 0.05f;

        /// <summary>Set one construction's work rate.</summary>
        public CommandResult SetRate(Rp1ConstructionRateArgs? args)
        {
            try
            {
                if (args?.WorkRate == null)
                {
                    return CommandResult.Fail(CommandErrorCode.Range, "A work rate is required.");
                }
                var step = StepOf(args.WorkRate.Value);
                if (step == null)
                {
                    return CommandResult.Fail(
                        CommandErrorCode.Range,
                        "The work rate must be from 0% to 150% in steps of 5%, as RP-1's slider sets it.");
                }

                var found = Find(args.Id, out var refusal);
                if (found == null)
                {
                    return refusal!;
                }

                if (!Rp1Types.WriteDouble(found, "workRate", RateAt(step.Value)))
                {
                    return CommandResult.Fail(CommandErrorCode.ModeUnavailable, "RP-1's work rate could not be written.");
                }
                return CommandResult.Ok();
            }
            catch (Exception e)
            {
                return CommandResult.Fail(CommandErrorCode.WrongState, "Setting the work rate failed: " + e.Message);
            }
        }

        /// <summary>Stop building one construction. Nothing already spent comes back.</summary>
        public CommandResult Cancel(Rp1ConstructionCancelArgs? args)
        {
            try
            {
                var found = Find(args?.Id, out var refusal);
                if (found == null)
                {
                    return refusal!;
                }

                var cancel = Rp1Types.InstanceMethod(found, "Cancel", 0);
                if (cancel == null)
                {
                    return CommandResult.Fail(CommandErrorCode.ModeUnavailable, "RP-1's construction does not expose a cancel.");
                }

                cancel.Invoke(found, null);
                return CommandResult.Ok();
            }
            catch (Exception e)
            {
                return CommandResult.Fail(
                    CommandErrorCode.WrongState,
                    "Cancelling the construction failed: " + Rp1Types.ExceptionReason(e));
            }
        }

        /// <summary>
        /// The one construction carrying this id, or null with the refusal to
        /// return. Two carrying it is refused too: acting on either would be a
        /// guess about which the operator meant.
        /// </summary>
        private object? Find(string? id, out CommandResult? refusal)
        {
            refusal = null;
            if (string.IsNullOrEmpty(id))
            {
                refusal = CommandResult.Fail(CommandErrorCode.Range, "A construction id is required.");
                return null;
            }

            var instance = _scm == null ? null : Rp1Types.StaticValue(_scm, "Instance");
            if (instance == null)
            {
                refusal = CommandResult.Fail(Rp1ErrorCodes.SpaceCentreNotLoaded);
                return null;
            }

            object? match = null;
            foreach (var (project, kind) in Rp1ConstructionIds.All(instance))
            {
                if (!string.Equals(Rp1ConstructionIds.Of(project, kind), id, StringComparison.OrdinalIgnoreCase))
                {
                    continue;
                }
                if (match != null)
                {
                    refusal = CommandResult.Fail(CommandErrorCode.WrongState, "More than one construction carries that id, so nothing was changed.");
                    return null;
                }
                match = project;
            }

            if (match == null)
            {
                refusal = CommandResult.Fail(CommandErrorCode.NotFound, "No construction with that id is under way.");
            }
            return match;
        }
    }

    /// <summary>
    /// Where each kind of construction keeps its identity, and every construction
    /// under way.
    /// </summary>
    /// <remarks>
    /// RP-1 has no id on the base <c>ConstructionProject</c>, so each kind is
    /// keyed by the one it carries: a facility upgrade's own <c>uid</c>, the
    /// complex's <c>lcID</c> for a complex being built or renovated (RP-1 holds
    /// at most one such project per complex), and the pad's <c>id</c> for a pad,
    /// which is the id <c>PadConstructionProject.ProcessCancel</c> finds its pad
    /// by. An empty Guid is no id: a save that predates one would give every
    /// project the same.
    /// </remarks>
    public static class Rp1ConstructionIds
    {
        public static string? Of(object? project, string kind)
        {
            var field = kind switch
            {
                "FacilityUpgrade" => "uid",
                "LaunchComplex" => "lcID",
                "Pad" => "id",
                _ => null,
            };
            if (field == null)
            {
                return null;
            }
            var id = Rp1Types.ReadGuidString(project, field);
            return string.IsNullOrEmpty(id) || id == Guid.Empty.ToString() ? null : id;
        }

        /// <summary>
        /// Every construction at every centre with its kind, from the three lists
        /// RP-1 files them in. Pads hang off their complex rather than the centre.
        /// </summary>
        public static IEnumerable<(object Project, string Kind)> All(object spaceCentre)
        {
            foreach (var centre in Rp1Types.Enumerate(Rp1Types.Member(spaceCentre, "KSCs")))
            {
                foreach (var project in Rp1Types.Enumerate(Rp1Types.Member(centre, "FacilityUpgrades")))
                {
                    yield return (project, "FacilityUpgrade");
                }
                foreach (var project in Rp1Types.Enumerate(Rp1Types.Member(centre, "LCConstructions")))
                {
                    yield return (project, "LaunchComplex");
                }
                foreach (var lc in Rp1Types.Enumerate(Rp1Types.Member(centre, "LaunchComplexes")))
                {
                    foreach (var project in Rp1Types.Enumerate(Rp1Types.Member(lc, "PadConstructions")))
                    {
                        yield return (project, "Pad");
                    }
                }
            }
        }
    }
}
