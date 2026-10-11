// RP-1's staffing write surface: move engineers between a centre's unassigned
// pool and one of its launch complexes, and hire or fire staff by a count.
//
// WHAT WAS WRONG WITHOUT IT. Assignment is the fact the whole space-centre view
// exists to make visible: RP-1 advances a complex's work at
// Engineers / MaxEngineers, so a complex with nobody assigned builds NOTHING
// however many engineers the career has hired, and an engineer assigned to
// nothing draws salary for no work. An operator could read both of those from
// this Uplink and then had to go into the game to act on either.
//
// ASSIGNING AND HIRING ARE KEPT APART. Hiring spends funds, raises the standing
// payroll and goes through KCTUtilities.HireStaff, which bills HireCost per
// applicant short. That is a purchase, so the client puts it behind an
// arm-then-confirm and beside a balance. Assignment spends nothing at the moment
// it lands: the engineers are already on the books, and all that changes is
// which complex they work at. Keeping the two apart is what lets assignment be a
// single press.
//
// HIRE AND FIRE DO WHAT RP-1'S STAFFING WINDOW DOES (KCT_GUI.RenderHireFire,
// read on RP0.dll 4.6.0.0 and 4.7.0.0, identical in both):
//
//   hire    KCTUtilities.HireStaff(isResearch, n, null). It charges
//           max(0, n - Applicants) * SettingsSC.HireCost, adds the heads to the
//           ACTIVE centre's pool or to the researchers, and consumes applicants
//   fire    researchers: KCTUtilities.ChangeResearchers(-n), then
//           SpaceCenterManagement.UpdateTechTimes(). Engineers:
//           KCTUtilities.ChangeEngineers(ActiveSC, -n), then
//           ActiveSC.RecalculateBuildRates(false). No fee
//
// The window greys Fire beyond the researchers or the active centre's
// UNASSIGNED engineers and greys Hire when funds fall short of the charge. It
// does not stop a press on either, only styles it, so both limits are asked
// here and refused with a sentence. Firing past the unassigned pool would drive
// it negative, the same corruption the assignment clamp below guards against.
//
// THE MEMBERS IT TOUCHES, each read off the shipped RP-1 v4.6.0.0 RP0.dll:
//
//   LaunchComplex.Engineers        a plain [Persistent] public int, RP-1's own
//                                  window assigns straight into it
//   LaunchComplex.MaxEngineers     pure arithmetic over the complex's mass and
//                                  size envelope; the ceiling a complex can hold
//   LaunchComplex.IsOperational    false for the whole of a construction or
//                                  modification
//   LaunchComplex.KSC              the owning centre, a plain backing field
//   LCSpaceCenter.UnassignedEngineers
//                                  DERIVED: the centre's hired count minus the
//                                  sum of its complexes' assigned counts, so it
//                                  is what the pool has left rather than a
//                                  stored figure
//   KCTUtilities.ChangeEngineers(LaunchComplex, int)
//                                  the write, via Rp1ComplexWrites for the
//                                  overload hazard
//
// THE CLAMP IS OURS TO DO. ChangeEngineers adds the delta and clamps nothing:
// RP-1's own window works the legal move out first, as
// Math.Min(KSC.UnassignedEngineers, MaxEngineers - Engineers) going up and the
// complex's own count going down. This file asks the same two questions and
// REFUSES rather than clamping, because a clamp reports success for a crew size
// the operator did not ask for.
//
// A NON-OPERATIONAL COMPLEX IS REFUSED, and that is a decision rather than a
// limitation. RP-1 takes a complex's crew off when construction or modification
// starts, records how many it took as engineersToReadd, and puts them back
// itself on completion with ChangeEngineers(lc, min(readd, max, unassigned)).
// That re-add ADDS, so a crew assigned while the work was in flight is still
// there when it lands and the complex can finish above its own maximum. The safe
// direction of a state we would be racing is not to write.
using System;
using System.Globalization;
using System.Reflection;
using Sitrep.Contract;

namespace GonogoRp1Uplink
{
    /// <summary>
    /// The handlers for <c>rp1.personnel.assign</c>, <c>rp1.personnel.hire</c>
    /// and <c>rp1.personnel.fire</c>.
    /// </summary>
    public sealed class Rp1PersonnelCommands
    {
        /// <summary>Set how many engineers a launch complex has assigned to it.</summary>
        public const string AssignCommand = "rp1.personnel.assign";

        /// <summary>Hire engineers or researchers by a count, paid up front.</summary>
        public const string HireCommand = "rp1.personnel.hire";

        /// <summary>Fire engineers or researchers by a count, free.</summary>
        public const string FireCommand = "rp1.personnel.fire";

        private const string ScmTypeName = "RP0.SpaceCenterManagement";
        private const string UtilitiesTypeName = "RP0.KCTUtilities";
        private const string DatabaseTypeName = "RP0.Database";
        private const string CentreTypeName = "RP0.LCSpaceCenter";

        private readonly Type? _scm;
        private readonly Type? _utilities;
        private readonly Type? _database;

        public Rp1PersonnelCommands()
        {
            _scm = Rp1Types.Find(ScmTypeName);
            _utilities = Rp1Types.Find(UtilitiesTypeName);
            _database = Rp1Types.Find(DatabaseTypeName);
        }

        /// <summary>
        /// The command can run: RP-1's space centre and its static helpers
        /// resolved.
        ///
        /// <para>TYPES ONLY, for the reason
        /// <see cref="Rp1VehicleCommands.IsAvailable"/> spells out at length: a
        /// method-level gate on the MANIFEST cannot say why it fired, because a
        /// command that was never declared looks exactly like one nobody wrote.
        /// The method lookup happens at the press and refuses with a sentence
        /// naming what was not recognised.</para>
        /// </summary>
        public bool IsAvailable => _scm != null && _utilities != null;

        /// <summary>
        /// Whether the one member this command invokes resolved, as a sentence for
        /// a health fact. The same reasoning as
        /// <see cref="Rp1VehicleCommands.MethodDiagnosis"/>: a withheld command
        /// and an absent one are indistinguishable from outside, and naming the
        /// member is the difference between "nobody wrote this" and "RP-1 renamed
        /// ChangeEngineers".
        /// </summary>
        public string MethodDiagnosis()
        {
            if (_scm == null || _utilities == null)
            {
                return "RP-1 space-centre types not found";
            }
            try
            {
                if (Rp1ComplexWrites.ChangeEngineers(_utilities) == null)
                {
                    return "assignment will refuse at the press: KCTUtilities.ChangeEngineers(LaunchComplex, int) not found";
                }
                if (Rp1Types.StaticMethod(_utilities, "HireStaff", 3) == null)
                {
                    return "hiring will refuse at the press: KCTUtilities.HireStaff(bool, int, LaunchComplex) not found";
                }
                if (Rp1Types.StaticMethod(_utilities, "ChangeResearchers", 1) == null
                    || CentreChangeEngineers() == null)
                {
                    return "firing will refuse at the press: KCTUtilities.ChangeResearchers or ChangeEngineers(LCSpaceCenter, int) not found";
                }
                return "every invoked member resolved";
            }
            catch (Exception ex)
            {
                // Runs from Health, on the Courier thread. A diagnostic that takes
                // the health surface down with it is worse than no diagnostic.
                return "assignment will refuse at the press: KCTUtilities.ChangeEngineers threw on lookup: "
                    + Rp1Types.ExceptionReason(ex);
            }
        }

        /// <summary>
        /// Sets a launch complex's assigned engineer count.
        ///
        /// <para>A SET, so re-sending it is harmless and it lands on the count
        /// that was asked for however stale the operator's view was. A target
        /// already met changes nothing and succeeds: the asked-for state is the
        /// state.</para>
        /// </summary>
        public CommandResult Assign(Rp1PersonnelAssignArgs? args)
        {
            var lcId = args?.LcId;
            if (string.IsNullOrWhiteSpace(lcId))
            {
                return CommandResult.Fail(
                    CommandErrorCode.NotFound,
                    "the command named no launch complex");
            }

            var target = args?.Engineers;
            if (target == null)
            {
                // Refused rather than defaulted. Neither zero nor the complex's
                // maximum is a guess worth making about a crew.
                return CommandResult.Fail(
                    CommandErrorCode.Range,
                    "the command did not say how many engineers to leave at the complex");
            }

            if (target.Value < 0)
            {
                return CommandResult.Fail(
                    CommandErrorCode.Range,
                    "a launch complex cannot have fewer than no engineers");
            }

            if (!IsAvailable)
            {
                return CommandResult.Fail(
                    CommandErrorCode.Unreadable,
                    "RP-1's space-centre model could not be resolved, so nothing was changed");
            }

            var scm = Rp1Types.StaticValue(_scm!, "Instance");
            if (scm == null)
            {
                return CommandResult.Fail(Rp1ErrorCodes.SpaceCentreNotLoaded);
            }

            if (Rp1Types.ReadBool(scm, "enabledForSave") != true)
            {
                return CommandResult.Fail(Rp1ErrorCodes.NotManaging);
            }

            if (!Rp1ComplexWrites.TryFind(scm, lcId!, out var complex))
            {
                return CommandResult.Fail(
                    CommandErrorCode.NotFound,
                    "no launch complex with that id exists at any space centre");
            }

            var name = Rp1Types.ReadString(complex, "Name") ?? "the launch complex";

            if (Rp1Types.ReadBool(complex, "IsOperational") != true)
            {
                // See this file's header: RP-1 holds this complex's crew itself
                // until the work finishes and then puts them back by ADDING, so a
                // crew assigned now would still be there when the re-add lands.
                return CommandResult.Fail(
                    CommandErrorCode.ModeUnavailable,
                    name + " is being built or modified, and RP-1 puts its crew back itself when that finishes");
            }

            var current = ReadCount(complex, "Engineers");
            var max = ReadCount(complex, "MaxEngineers");
            if (current == null || max == null)
            {
                return CommandResult.Fail(
                    CommandErrorCode.Unreadable,
                    "RP-1 would not say how many engineers " + name + " has or can hold");
            }

            if (target.Value > max.Value)
            {
                return CommandResult.Fail(
                    CommandErrorCode.Range,
                    name + " holds at most " + Number(max.Value) + " engineers, and the command asked for "
                    + Number(target.Value));
            }

            var delta = target.Value - current.Value;
            if (delta == 0)
            {
                return CommandResult.Ok();
            }

            if (delta > 0)
            {
                var centre = Rp1Types.Member(complex, "KSC");
                var unassigned = ReadCount(centre, "UnassignedEngineers");
                if (unassigned == null)
                {
                    return CommandResult.Fail(
                        CommandErrorCode.Unreadable,
                        "RP-1 would not say how many engineers are unassigned at " + CentreName(centre));
                }
                if (delta > unassigned.Value)
                {
                    return CommandResult.Fail(
                        CommandErrorCode.Range,
                        "that would take " + Number(delta) + " engineers off the pool at "
                        + CentreName(centre) + ", which has " + Number(unassigned.Value)
                        + " unassigned. Hiring is a separate act and this command does not do it");
                }
            }

            MethodInfo? changeEngineers;
            try
            {
                changeEngineers = Rp1ComplexWrites.ChangeEngineers(_utilities);
            }
            catch (Exception ex)
            {
                return CommandResult.Fail(
                    CommandErrorCode.Unreadable,
                    "this RP-1 build's engineer assignment could not be resolved: " + Rp1Types.ExceptionReason(ex));
            }

            if (changeEngineers == null)
            {
                return CommandResult.Fail(Rp1ErrorCodes.BuildUnrecognised,
                    "this RP-1 build has no engineer assignment this Uplink recognises, so nothing was changed");
            }

            try
            {
                changeEngineers.Invoke(null, new object[] { complex, delta });
            }
            catch (Exception ex)
            {
                // The write and the recalculation are one RP-1 call, so a throw
                // here leaves a state this Uplink cannot narrow: the count may
                // have moved before the events fired. Said rather than reported as
                // a plain refusal, because an operator who reads "refused" would
                // expect the crew not to have moved.
                return CommandResult.Fail(
                    CommandErrorCode.ModeUnavailable,
                    "RP-1 failed part-way through moving " + name + "'s crew, so check the complex: "
                    + Rp1Types.ExceptionReason(ex));
            }

            return CommandResult.Ok();
        }

        /// <summary>
        /// Hires a count of engineers into the active centre's pool, or of
        /// researchers, paying up front for every head beyond the waiting
        /// applicants.
        ///
        /// <para>Refused, not clamped, when the balance does not cover the
        /// charge: a hire is a purchase RP-1 prices before it happens, and hiring
        /// fewer than asked would report success for a payroll nobody chose.</para>
        /// </summary>
        public CommandResult Hire(Rp1PersonnelHeadcountArgs? args)
        {
            var refusal = Resolve(args, out var research, out var count, out var scm, out var centre);
            if (refusal != null)
            {
                return refusal;
            }

            var applicants = ReadCount(scm, "Applicants");
            var settings = _database == null ? null : Rp1Types.StaticValue(_database, "SettingsSC");
            var hireCost = Rp1Types.ReadDouble(settings, "HireCost");
            if (applicants == null || hireCost == null)
            {
                return CommandResult.Fail(
                    CommandErrorCode.Unreadable,
                    "RP-1 would not say what a hire costs or how many applicants are waiting, so nobody was hired");
            }

            var charge = Math.Max(0, count - applicants.Value) * hireCost.Value;
            if (charge > 0)
            {
                var funds = Rp1Pricing.FundsBalance();
                if (funds == null)
                {
                    return CommandResult.Fail(
                        CommandErrorCode.Unreadable,
                        "the career's balance could not be read, so nobody was hired");
                }
                if (funds.Value < charge)
                {
                    return CommandResult.Fail(
                        CommandErrorCode.InsufficientFunds,
                        "hiring " + Number(count) + " " + Kind(research) + " costs " + Funds(charge)
                        + " and the balance is " + Funds(funds.Value));
                }
            }

            var hireStaff = Rp1Types.StaticMethod(_utilities!, "HireStaff", 3);
            if (hireStaff == null)
            {
                return CommandResult.Fail(Rp1ErrorCodes.BuildUnrecognised,
                    "this RP-1 build has no hiring step this Uplink recognises, so nobody was hired");
            }

            try
            {
                // No complex, as RP-1's window passes none: the heads land in the
                // active centre's pool, and assigning them is a separate press.
                hireStaff.Invoke(null, new object?[] { research, count, null });
            }
            catch (Exception ex)
            {
                // HireStaff charges first and adds the heads after, so a throw can
                // leave the balance down with nobody on the books.
                return CommandResult.Fail(
                    CommandErrorCode.ModeUnavailable,
                    "RP-1 failed part-way through hiring, so check the balance and the payroll: "
                    + Rp1Types.ExceptionReason(ex));
            }

            return CommandResult.Ok();
        }

        /// <summary>
        /// Fires a count of researchers, or of the active centre's unassigned
        /// engineers. Free, and refused beyond the heads there are to fire.
        /// </summary>
        public CommandResult Fire(Rp1PersonnelHeadcountArgs? args)
        {
            var refusal = Resolve(args, out var research, out var count, out var scm, out var centre);
            if (refusal != null)
            {
                return refusal;
            }

            var available = research ? ReadCount(scm, "Researchers") : ReadCount(centre, "UnassignedEngineers");
            if (available == null)
            {
                return CommandResult.Fail(
                    CommandErrorCode.Unreadable,
                    "RP-1 would not say how many " + Kind(research) + " there are to fire");
            }
            if (count > available.Value)
            {
                return CommandResult.Fail(
                    CommandErrorCode.Range,
                    research
                        ? "the career has " + Number(available.Value) + " researchers, and the command asked to fire "
                          + Number(count)
                        : CentreName(centre) + " has " + Number(available.Value)
                          + " unassigned engineers, and only unassigned engineers can be fired");
            }

            var change = research
                ? Rp1Types.StaticMethod(_utilities!, "ChangeResearchers", 1)
                : CentreChangeEngineers();
            if (change == null)
            {
                return CommandResult.Fail(Rp1ErrorCodes.BuildUnrecognised,
                    "this RP-1 build has no staff change this Uplink recognises, so nobody was fired");
            }

            try
            {
                if (research)
                {
                    change.Invoke(null, new object[] { -count });
                    // RP-1's window re-times the queue after a fire, as HireStaff
                    // does after a hire: fewer researchers make every node slower.
                    Rp1Types.InstanceMethod(scm, "UpdateTechTimes", 0)?.Invoke(scm, null);
                }
                else
                {
                    change.Invoke(null, new object[] { centre!, -count });
                    Rp1Types.InstanceMethod(centre!, "RecalculateBuildRates", 1)?.Invoke(centre, new object[] { false });
                }
            }
            catch (Exception ex)
            {
                return CommandResult.Fail(
                    CommandErrorCode.ModeUnavailable,
                    "RP-1 failed part-way through firing, so check the payroll: " + Rp1Types.ExceptionReason(ex));
            }

            return CommandResult.Ok();
        }

        /// <summary>
        /// The checks hiring and firing share: the arguments, RP-1's state, and
        /// for engineers that the named centre is the active one.
        /// </summary>
        private CommandResult? Resolve(
            Rp1PersonnelHeadcountArgs? args,
            out bool research,
            out int count,
            out object scm,
            out object? centre)
        {
            research = false;
            count = 0;
            scm = null!;
            centre = null;

            if (args?.Research == null)
            {
                return CommandResult.Fail(
                    CommandErrorCode.Range,
                    "the command did not say whether it means engineers or researchers");
            }
            research = args.Research.Value;

            if (args.Count == null || args.Count.Value < 1)
            {
                return CommandResult.Fail(
                    CommandErrorCode.Range,
                    "the command must name at least one " + (research ? "researcher" : "engineer"));
            }
            count = args.Count.Value;

            if (!research && string.IsNullOrWhiteSpace(args.KscName))
            {
                return CommandResult.Fail(
                    CommandErrorCode.NotFound,
                    "the command named no space centre for the engineers");
            }

            if (!IsAvailable)
            {
                return CommandResult.Fail(
                    CommandErrorCode.Unreadable,
                    "RP-1's space-centre model could not be resolved, so nothing was changed");
            }

            var instance = Rp1Types.StaticValue(_scm!, "Instance");
            if (instance == null)
            {
                return CommandResult.Fail(Rp1ErrorCodes.SpaceCentreNotLoaded);
            }
            if (Rp1Types.ReadBool(instance, "enabledForSave") != true)
            {
                return CommandResult.Fail(Rp1ErrorCodes.NotManaging);
            }
            scm = instance;

            if (research)
            {
                return null;
            }

            var active = Rp1Types.Member(instance, "ActiveSC");
            if (active == null)
            {
                return CommandResult.Fail(
                    CommandErrorCode.Unreadable,
                    "RP-1 would not say which space centre is active");
            }
            if (!string.Equals(Rp1Types.ReadString(active, "KSCName"), args.KscName, StringComparison.Ordinal))
            {
                // RP-1 hires into and fires from the active centre only, so a
                // view that thinks another one is active is refused rather than
                // acted on at a place the operator did not name.
                return CommandResult.Fail(
                    CommandErrorCode.WrongState,
                    "RP-1 hires and fires engineers at the active space centre, which is "
                    + CentreName(active) + ", not the one the command named");
            }
            centre = active;
            return null;
        }

        /// <summary>
        /// <c>KCTUtilities.ChangeEngineers(LCSpaceCenter, int)</c>, by its first
        /// parameter's type: the same-arity complex overload beside it would move
        /// a complex's crew instead of the centre's pool.
        /// </summary>
        private MethodInfo? CentreChangeEngineers() =>
            _utilities == null
                ? null
                : Rp1Types.StaticMethodOn(_utilities, "ChangeEngineers", CentreTypeName, 2);

        private static string Kind(bool research) => research ? "researchers" : "engineers";

        /// <summary>A funds figure for a refusal sentence, grouped and whole.</summary>
        private static string Funds(double value) =>
            value.ToString("N0", CultureInfo.InvariantCulture) + " funds";

        /// <summary>
        /// A count RP-1 keeps as an int, whether as a field or as a derived
        /// property. Absent rather than zero when it could not be read: zero is a
        /// legitimate crew and a legitimate empty pool, and treating an unreadable
        /// member as either would let this command write against a number nobody
        /// answered with.
        /// </summary>
        private static int? ReadCount(object? target, string name)
        {
            switch (Rp1Types.Member(target, name))
            {
                case int i: return i;
                case long l: return (int)l;
                case short s: return s;
                default: return null;
            }
        }

        /// <summary>The centre's name for a refusal sentence, or a phrase that reads as one.</summary>
        private static string CentreName(object? centre) =>
            Rp1Types.ReadString(centre, "KSCName") ?? "that space centre";

        /// <summary>Grouped, because these are read by a person: 1,200 rather than 1200.</summary>
        private static string Number(int value) =>
            value.ToString("N0", CultureInfo.InvariantCulture);
    }
}
