// Starting a NEW design building, from one of the save's own craft files. No
// compile-time reference to RP0.dll, the same arm's-length reflection pattern as
// Rp1ScReflection, whose header carries the provenance rules this file follows.
//
// WHAT WAS WRONG. rp1.build.repeat is the only build command there was, and it
// COPIES: it resolves an existing vehicle by id, refuses when RP-1 holds no
// stored design for it, and appends the copy to that vehicle's own complex.
// Nothing in it can start from a craft file. So an operator could order a second
// Atlas and could never order a first one, which is a dead end rather than a gap:
// every career begins with nothing built, and the surface offered no way out of
// that state at all.
//
// WHAT THIS IS A COPY OF. RP-1's own editor path,
// KCTUtilities.TryAddVesselToBuildList(launchSite), whose body is
//
//     new VesselProject(EditorLogic.fetch.ship, launchSite, EditorLogic.FlagURL,
//                       storeConstruct: true)
//
// handed to VesselBuildValidator, and its Build Plans window's row, which is the
// same construction with TryAddVesselToBuildList(vp, skipPartChecks: true,
// overrideLC) so the vehicle lands at a complex chosen rather than at whichever
// one happens to be active. Both are reproduced here. The validator itself is
// NOT called, for the reason Rp1BuildCommands gives at length: it is a Unity
// coroutine that takes an InputLockManager lock and asks its questions through
// PopupDialog, and there is nobody to answer a popup on a command dispatched from
// another machine. Its checks are made here instead and its success action,
// KCTUtilities.AddVesselToBuildList, is called directly.
//
// THE FOUR CHECKS THE VALIDATOR MAKES, AND WHAT EACH BECAME. Unlike the repeat
// build, which passes skipPartChecks because a copy of an integrated vehicle has
// already been through them, a craft file has been through NONE of them. So all
// four are asked:
//
//   ProcessFacilityChecks   MeetsFacilityRequirements, INVOKED, as the repeat
//                           build invokes it and for the same reason: this is a
//                           command running at the moment of a press, which is
//                           exactly where RP-1's own button calls it
//   ProcessPartAvailability REFUSES, naming the parts. RP-1's own arm offers to
//                           spend funds unlocking them through a popup, and a
//                           command that answered that popup on an operator's
//                           behalf would spend money nobody asked it to
//   ProcessPartConfigs      REFUSES, quoting each module. Rp1PartConfigs walks
//                           the loaded craft's live part modules the way RP-1's
//                           GetConfigErrorsDict does, resolving what RP-1
//                           resolves without asking and refusing on the rest,
//                           because RP-1's own arm offers to pay for those
//                           through a popup
//   ProcessFundsChecks      the currency query, mandatory, and an unreadable one
//                           REFUSES. KCTUtilities.SpendFunds performs NO
//                           affordability test of its own: its whole body is a
//                           Funding.Instance.AddFunds of the negative amount, so
//                           a handler that skipped this would drive a career into
//                           negative funds and RP-1 would never complain
//
// ProcessUntooledParts is the fifth and is not reproduced, because it cannot
// fire: its own condition is HighLogic.LoadedSceneIsEditor, and it is a reminder
// that charges nothing. ProcessExcessEC is a popup that offers to drain
// batteries, and it refuses nothing.
//
// WHERE THE CRAFT FILE COMES FROM, and why not from here. Opening one means
// ShipConstruction.GetShipsPathFor, ConfigNode.Load and ShipConstruct.LoadShip,
// the last of which INSTANTIATES a Unity part per PART node and leaves the
// GameObjects for somebody to destroy. This assembly holds no KSP or Unity
// reference at all, deliberately, and managing Unity object lifetime through
// MethodInfo.Invoke from an assembly that cannot name UnityEngine.Object is how a
// scene ends up with a craft standing at the world origin. So that half is
// core's own craftCatalogue capability, an ICraftCatalogue resolved through
// host.Kernel the same way the craft LISTING already was, and the handle it
// returns is never opened here: it goes straight into RP-1's constructor and
// straight back to Release. With no catalogue elected the command's gate is
// dark and names the reason.
//
// WHAT IS READ, and why each is safe:
//
//   SpaceCenterManagement.Instance / .enabledForSave / .KSCs
//                                    the same three reads Rp1ScReflection opens
//                                    with, vouched for there
//   LCSpaceCenter.LaunchComplexes    [Persistent] list
//   LaunchComplex.ID/.Name/.IsOperational/.LCType
//                                    plain fields and one-line reads of _lcData
//   Funding.Instance.Funds           read ONLY to put a number beside a refusal
//   the craft's part modules         through Rp1PartConfigs, whose header lists
//                                    what it reads, invokes and writes
//
// WHAT IS INVOKED, each a write RP-1 itself performs on the same click:
//
//   new VesselProject(ShipConstruct, string, string, bool)
//                                    RP-1's ONLY constructor that measures a
//                                    craft: mass, size, cost, effective cost,
//                                    build points, part names, human rating and
//                                    stage counts all come off the live parts,
//                                    and the craft node is stored. There is no
//                                    node-only route to the same object, and
//                                    assembling one field by field would be this
//                                    Uplink guessing at RP-1's arithmetic
//   VesselProject.LCID = complex.ID  the same assignment RP-1's own overrideLC
//                                    argument makes, and the whole of how a
//                                    vehicle is built somewhere other than the
//                                    active complex
//   VesselProject.MeetsFacilityRequirements(List<string>)
//   VesselProject.GetTotalCost()
//   CurrencyModifierQueryRP0.RunQuery / .CanAfford / .GetTotal
//   KCTUtilities.AddVesselToBuildList(vp, spendFunds)
//
// PROVENANCE. Every member named above was read out of an ilspycmd disassembly of
// the INSTALLED RP-1 v4.6.0.0 RP0.dll. The disassembly verifies SHAPE and never
// VALUE: nothing here has been exercised against a running game, so every hop is
// null-safe and every failure to read refuses the command rather than guessing at
// it.
using System;
using System.Collections.Generic;
using Sitrep.Contract;

namespace GonogoRp1Uplink
{
    /// <summary>
    /// The handler for <c>rp1.build.start</c>, and the gate that darkens it when
    /// no craft catalogue is elected.
    /// </summary>
    public sealed class Rp1BuildStartCommands : ICommandGateEvaluator
    {
        /// <summary>Start integrating a design RP-1 has never held. Must match the client's constant.</summary>
        public const string StartCommand = "rp1.build.start";

        /// <summary>Ask what <c>rp1.build.start</c> would charge, without starting. Must match the client's constant.</summary>
        public const string QuoteCommand = "rp1.build.quote";

        /// <summary>
        /// The gate kind this command adds to the one every other build command
        /// declares. Its own kind rather than a quantity on <c>rp1.build</c>,
        /// because it is answered by a different evaluator holding a different
        /// thing: core's craft catalogue rather than RP-1's model.
        /// </summary>
        public const string GateKind = "rp1.buildStart";

        /// <summary>
        /// The one quantity: this install can open the save's craft files.
        ///
        /// <para>Static, with no <see cref="CommandRequirement.Needs"/>, which is
        /// the whole reason it is worth declaring: the engine evaluates it with
        /// an empty argument bag, so on an install with no craft catalogue
        /// elected the control is drawn dark with its reason rather than
        /// answering a press with a refusal nobody expected.</para>
        /// </summary>
        public const string CraftCatalogue = "craftCatalogue";

        private const string ScmTypeName = "RP0.SpaceCenterManagement";
        private const string VesselProjectTypeName = "RP0.VesselProject";
        private const string UtilitiesTypeName = "RP0.KCTUtilities";
        private const string ToolingDatabaseTypeName = "RP0.ToolingDatabase";

        /// <summary>
        /// The launch site RP-1 stamps on a rocket, and the one its own
        /// <c>AddVesselToBuildList</c> overwrites a moment later. Passed because
        /// the constructor takes it; never relied on.
        /// </summary>
        private const string PadLaunchSite = "LaunchPad";

        /// <summary>The same, for a craft built in the SPH.</summary>
        private const string RunwayLaunchSite = "Runway";

        /// <summary>
        /// The flag a vehicle started this way flies. Empty rather than the
        /// player's chosen one: the choice lives on <c>EditorLogic.FlagURL</c>,
        /// which is a live editor and is not there, and RP-1 falls back to the
        /// mission flag for an empty string.
        /// </summary>
        private const string NoFlag = "";

        /// <summary>RP-1's own name for a spaceplane project, read off the vehicle it just built.</summary>
        private const string SphProject = "SPH";

        private readonly Func<ICraftCatalogue?> _catalogue;

        private readonly Type? _scm;
        private readonly Type? _vesselProject;
        private readonly Type? _utilities;
        private readonly Type? _toolingDatabase;
        private readonly Rp1QuoteCache _quotes = new Rp1QuoteCache();
        private readonly Rp1Pricing _pricing = new Rp1Pricing();

        /// <summary>
        /// Takes core's craft catalogue as a factory rather than an instance, so
        /// the gate and the handler ask at the moment of the press and a
        /// catalogue that is elected or withdrawn is seen at once. Providers
        /// register during registration and the Kernel elects afterwards, so
        /// anything resolved in a constructor would be null for the life of the
        /// game.
        /// </summary>
        public Rp1BuildStartCommands(Func<ICraftCatalogue?> catalogue)
        {
            _catalogue = catalogue ?? throw new ArgumentNullException(nameof(catalogue));
            _scm = Rp1Types.Find(ScmTypeName);
            _vesselProject = Rp1Types.Find(VesselProjectTypeName);
            _utilities = Rp1Types.Find(UtilitiesTypeName);
            _toolingDatabase = Rp1Types.Find(ToolingDatabaseTypeName);
        }

        /// <summary>
        /// Every RP-1 type this command needs resolved, the pricing types
        /// included: a handler that could add to a build list but not price it is
        /// one that overdraws a career.
        /// </summary>
        public bool IsAvailable =>
            _scm != null && _vesselProject != null && _utilities != null && _pricing.IsAvailable;

        /// <summary>The requirement <c>rp1.build.start</c> adds to the shared one.</summary>
        public static CommandRequirement Requirement() =>
            new CommandRequirement { Kind = GateKind, Quantity = CraftCatalogue };

        public string Kind => GateKind;

        public GateVerdict Evaluate(CommandRequirement requirement, IGateArguments arguments)
        {
            var quantity = requirement?.Quantity ?? "";
            if (quantity != CraftCatalogue)
            {
                return GateVerdict.Unknown($"RP-1 imposes no build condition called \"{quantity}\"");
            }

            if (Resolve() == null)
            {
                return GateVerdict.Fail(
                    CommandErrorCode.ModeUnavailable,
                    "this install cannot open the save's craft files, so a build can only be started "
                    + "from a design the space centre already holds");
            }

            return GateVerdict.Pass();
        }

        /// <summary>
        /// Starts integrating the craft file named by
        /// <see cref="Rp1BuildStartArgs.CraftFile"/> at the complex named by
        /// <see cref="Rp1BuildStartArgs.LcId"/>, charging the career for it.
        ///
        /// <para>Runs on the game's main thread: the host is constructed with
        /// <c>executeCommandsOnMainThread</c>, and both the craft load and every
        /// RP-1 invoke below would be illegal anywhere else.</para>
        ///
        /// <para>Ordered so that nothing is loaded until a refusal that needs no
        /// craft has had its chance, and nothing is charged until every refusal
        /// has. The load comes after the complex is resolved because it
        /// instantiates a part per part node, and there is no sense building a
        /// craft to find out its complex is still under construction.</para>
        /// </summary>
        public CommandResult Start(Rp1BuildStartArgs? args)
        {
            var refusal = ResolveTarget(args?.CraftFile, args?.LcId, out var target);
            if (refusal != null)
            {
                return refusal;
            }

            refusal = OpenCraft(target!, args!.Facility, out var load);
            if (refusal != null)
            {
                return refusal;
            }

            try
            {
                return Integrate(load!, target!.Complex, target.ComplexName, args.Facility);
            }
            finally
            {
                // Whatever happened, the parts go back. A refusal that returned
                // without releasing would leave a craft standing at the world
                // origin, once per press, and a press an operator repeats after a
                // refusal is exactly the one that repeats the leak.
                Release(target!.Catalogue, load!.Ship!);
            }
        }

        /// <summary>
        /// What RP-1 would charge to start the craft file named by
        /// <see cref="Rp1BuildQuoteArgs.CraftFile"/> at the complex named by
        /// <see cref="Rp1BuildQuoteArgs.LcId"/>, and whether the career's funds
        /// cover it. Starts nothing and charges nothing.
        ///
        /// <para>Every refusal the press makes before it charges is made here, in
        /// the same order and by the same code, so a craft the press would refuse
        /// is refused by the quote in the same words. The price is
        /// <see cref="Rp1Pricing.Price"/>, the one the press charges.</para>
        ///
        /// <para>Loading a craft instantiates a part per PART node, so a price is
        /// kept in <see cref="Rp1QuoteCache"/> against the build and the career's
        /// state, and a repeat quote of the same build loads nothing. Only a
        /// price is kept: the balance is read fresh each time, so a cached quote
        /// still says whether the career can afford it now. A refusal is never
        /// kept, because the thing that caused it is the thing an operator fixes
        /// next.</para>
        /// </summary>
        public CommandResult<Rp1BuildQuote> Quote(Rp1BuildQuoteArgs? args)
        {
            var refusal = ResolveTarget(args?.CraftFile, args?.LcId, out var target);
            if (refusal != null)
            {
                return Refused(refusal);
            }

            var stamp = CareerStamp();
            var key = KeyFor(target!, args!.Facility);
            if (key != null && stamp != null && _quotes.TryGet(key, stamp, out var cached))
            {
                return Quoted(cached);
            }

            refusal = OpenCraft(target!, args.Facility, out var load);
            if (refusal != null)
            {
                return Refused(refusal);
            }

            try
            {
                var failure = Prepare(load!, target!.Complex, target.ComplexName, args.Facility, out var vessel);
                if (failure != null)
                {
                    return Refused(failure);
                }

                var price = _pricing.Price(vessel!, out _, out var priceFailure);
                if (priceFailure != null)
                {
                    return Refused(priceFailure);
                }

                var modified = load!.Measured?.Modified;
                if (stamp != null && modified != null)
                {
                    _quotes.Put(
                        Rp1QuoteCache.KeyOf(target.File, args.Facility, modified.Value, target.LcId),
                        stamp,
                        price);
                }

                return Quoted(price);
            }
            finally
            {
                Release(target!.Catalogue, load!.Ship!);
            }
        }

        private static CommandResult<Rp1BuildQuote> Refused(CommandResult refusal) =>
            CommandResult<Rp1BuildQuote>.Fail(refusal.ErrorCode!, refusal.Detail);

        private static CommandResult<Rp1BuildQuote> Quoted(double price)
        {
            var balance = Rp1Pricing.FundsBalance();
            return CommandResult<Rp1BuildQuote>.Ok(new Rp1BuildQuote
            {
                Price = price,
                Balance = balance,
                Affordable = balance != null && balance.Value >= price,
            });
        }

        /// <summary>
        /// Everything the price depends on besides the craft and the complex: the
        /// tooling database's generation, which moves whenever a tooling is bought
        /// or the database is reloaded, and what a vehicle purchase costs once
        /// leaders and strategies have had their say, read as the charge for a
        /// fixed probe amount. Null when either could not be read, which stops a
        /// price being kept rather than keeping one nothing can invalidate.
        /// </summary>
        private string? CareerStamp()
        {
            var tooling = _toolingDatabase == null
                ? null
                : Rp1Types.ToDouble(Rp1Types.StaticValue(_toolingDatabase, "Generation"));
            var probe = _pricing.ModifierProbe();
            if (tooling == null || probe == null)
            {
                return null;
            }

            return tooling.Value.ToString("R", System.Globalization.CultureInfo.InvariantCulture)
                + "|" + probe.Value.ToString("R", System.Globalization.CultureInfo.InvariantCulture);
        }

        /// <summary>
        /// The cache key for the build, or null when the catalogue has no record of
        /// the file's write time: nothing then says the file is unchanged, so no
        /// price is kept.
        /// </summary>
        private static string? KeyFor(Target target, KspEditorFacility? facility)
        {
            ICraftCatalogue catalogue = target.Catalogue;
            IReadOnlyList<CraftFileRecord> listing;
            try
            {
                listing = catalogue.Craft();
            }
            catch (Exception)
            {
                return null;
            }

            foreach (var record in listing)
            {
                if (record.File == target.File && record.Facility == facility && record.Modified != null)
                {
                    return Rp1QuoteCache.KeyOf(target.File, facility, record.Modified.Value, target.LcId);
                }
            }

            return null;
        }

        /// <summary>What a build is aimed at once every refusal that needs no craft has passed.</summary>
        private sealed class Target
        {
            public ICraftCatalogue Catalogue = null!;
            public object Complex = null!;
            public string ComplexName = "";
            public string File = "";
            public string LcId = "";
        }

        /// <summary>
        /// The refusals that need no craft: arguments, RP-1's model, the catalogue
        /// and the complex. Null when the build can go on to open the file.
        /// </summary>
        private CommandResult? ResolveTarget(string? file, string? lcId, out Target? target)
        {
            target = null;
            if (string.IsNullOrWhiteSpace(file))
            {
                return CommandResult.Fail(
                    CommandErrorCode.NotFound,
                    "the command named no craft file, and the save holds several");
            }

            if (string.IsNullOrWhiteSpace(lcId))
            {
                return CommandResult.Fail(
                    CommandErrorCode.NotFound,
                    "the command named no launch complex. A complex decides the mass and size a "
                    + "vehicle may be and how fast it is built, so there is no complex this could "
                    + "have meant");
            }

            if (!IsAvailable)
            {
                return CommandResult.Fail(
                    CommandErrorCode.Unreadable,
                    "RP-1's build model could not be resolved, so nothing was started");
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
                    "this install cannot open the save's craft files, so nothing was started");
            }

            if (!TryFindComplex(scm, lcId!, out var complex))
            {
                return CommandResult.Fail(
                    CommandErrorCode.NotFound,
                    "no launch complex at any space centre carries that id");
            }

            var complexName = Rp1Types.ReadString(complex, "Name") ?? "the launch complex";
            if (Rp1Types.ReadBool(complex, "IsOperational") != true)
            {
                return CommandResult.Fail(
                    Rp1ErrorCodes.NotReady,
                    complexName + " is being built or renovated, so it cannot start a vehicle yet");
            }

            target = new Target
            {
                Catalogue = catalogue,
                Complex = complex,
                ComplexName = complexName,
                File = file!,
                LcId = lcId!,
            };
            return null;
        }

        /// <summary>
        /// Opens the craft file into live parts. The caller owns the result and
        /// gives it back through <see cref="Release"/>.
        /// </summary>
        private static CommandResult? OpenCraft(Target target, KspEditorFacility? facility, out CraftLoad? load)
        {
            load = null;
            CraftLoad opened;
            try
            {
                opened = target.Catalogue.Load(target.File, facility);
            }
            catch (Exception ex)
            {
                return CommandResult.Fail(
                    CommandErrorCode.ModeUnavailable,
                    "the craft file could not be opened, so nothing was started: "
                    + Rp1Types.ExceptionReason(ex));
            }

            if (opened == null || opened.Ship == null)
            {
                return CommandResult.Fail(
                    CommandErrorCode.NotFound,
                    opened?.Failure ?? "the craft file could not be opened");
            }

            load = opened;
            return null;
        }

        /// <summary>
        /// Everything from a loaded craft to a vehicle on the complex's build
        /// list, with the parts still alive throughout.
        /// </summary>
        private CommandResult Integrate(
            CraftLoad load, object complex, string complexName, KspEditorFacility? facility)
        {
            var failure = Prepare(load, complex, complexName, facility, out var vessel);
            if (failure != null)
            {
                return failure;
            }

            var price = _pricing.Price(vessel!, out var affordable, out var priceFailure);
            if (priceFailure != null)
            {
                return priceFailure;
            }

            if (!affordable)
            {
                return CommandResult.Fail(CommandErrorCode.InsufficientFunds, new LimitBreach
                {
                    Facility = complexName,
                    FacilityName = complexName,
                    Quantity = "funds",
                    Actual = price,
                    Limit = Rp1Pricing.FundsBalance(),
                    Unit = Units.Funds,
                });
            }

            try
            {
                var add = Rp1Types.StaticMethod(_utilities!, "AddVesselToBuildList", 2);
                if (add == null)
                {
                    return CommandResult.Fail(Rp1ErrorCodes.BuildUnrecognised,
                        "this RP-1 build has no build-list add this Uplink recognises");
                }
                add.Invoke(null, new object[] { vessel!, true });
            }
            catch (Exception ex)
            {
                // The add spends before it appends, so a throw from inside it can
                // leave the career charged for a vehicle that is not on any list.
                // Said plainly rather than reported as a plain refusal, because an
                // operator who reads "refused" and retries would pay twice.
                return CommandResult.Fail(
                    CommandErrorCode.ModeUnavailable,
                    "RP-1 failed part-way through starting this build, so check the queue and the "
                    + "balance before retrying: " + Rp1Types.ExceptionReason(ex));
            }

            return CommandResult.Ok();
        }

        /// <summary>
        /// Every refusal the press makes before it asks for a price, ending with
        /// RP-1's own measurement of the loaded craft bound to the chosen
        /// complex. Null on success, with that measurement in
        /// <paramref name="vessel"/>. Shared by the press and the quote, so a craft
        /// the one refuses the other refuses in the same words.
        /// </summary>
        private CommandResult? Prepare(
            CraftLoad load, object complex, string complexName, KspEditorFacility? facility, out object? vessel)
        {
            vessel = null;
            // The FILE's own editor, not the argument's. The argument decided
            // which folder was opened; RP-1's constructor reads shipFacility off
            // the craft itself to decide whether this is a VAB or an SPH project,
            // so the check that the complex is the right kind has to ask the same
            // thing it will. The argument stands in only when the file did not
            // say.
            var spaceplane = (load.Measured?.Facility ?? facility) == KspEditorFacility.SPH;
            var kindRefusal = Rp1Envelope.WrongComplexKind(
                spaceplane, Rp1Types.ReadEnumName(complex, "LCType"));
            if (kindRefusal != null)
            {
                return CommandResult.Fail(
                    Rp1ErrorCodes.NotReady,
                    complexName + " will not integrate this craft: " + kindRefusal);
            }

            var partsRefusal = PartRefusal(load);
            if (partsRefusal != null)
            {
                return CommandResult.Fail(Rp1ErrorCodes.NotReady, partsRefusal);
            }

            object built;
            try
            {
                var constructor = Rp1Types.Constructor(_vesselProject!, 4);
                if (constructor == null)
                {
                    return CommandResult.Fail(Rp1ErrorCodes.BuildUnrecognised,
                        "this RP-1 build has no craft-measuring step this Uplink recognises");
                }
                built = constructor.Invoke(new object?[]
                {
                    load.Ship,
                    spaceplane ? RunwayLaunchSite : PadLaunchSite,
                    NoFlag,
                    true,
                })!;
            }
            catch (Exception ex)
            {
                return CommandResult.Fail(
                    CommandErrorCode.ModeUnavailable,
                    "RP-1 could not measure this craft: " + Rp1Types.ExceptionReason(ex));
            }

            // Before anything asks what the complex thinks of it, because the
            // vehicle is born bound to whichever complex happened to be active
            // and every question below is about the one that was chosen. The same
            // assignment RP-1's own overrideLC argument makes.
            if (!Rp1Types.WriteMember(built, "LCID", Rp1Types.Member(complex, "ID")))
            {
                return CommandResult.Fail(Rp1ErrorCodes.BuildUnrecognised,
                    "this RP-1 build has no way to bind a vehicle to a chosen complex, "
                    + "so nothing was started");
            }

            // Asked a second time on the vehicle RP-1 measured, because the
            // client's own answer came off a craft file and could not know
            // whether the craft is human-rated or what resources it needs. This
            // one is RP-1's and is the one that decides.
            var failedChecks = FacilityRefusals(built);
            if (failedChecks != null)
            {
                return CommandResult.Fail(
                    Rp1ErrorCodes.NotReady,
                    "RP-1 will not integrate this craft at " + complexName + ": " + failedChecks);
            }

            vessel = built;
            return null;
        }

        /// <summary>
        /// Why the craft's parts stop it being built, or null when they do not.
        ///
        /// <para>Four separate arms because the remedies are four different
        /// things and a refusal an operator cannot act on is worse than the gap
        /// it replaced: a part this install does not have needs the mod
        /// installing, a part whose tech is not researched needs the R&amp;D
        /// queue, a part researched but not bought needs money spending in a
        /// building, and a config a module reports locked needs unlocking in the
        /// editor. RP-1's own window collapses the last two into a popup that
        /// offers to spend, and a command that answered that popup would spend an
        /// operator's funds on a question nobody asked it.</para>
        ///
        /// <para>Measured at the press rather than taken off the listing, so a
        /// part unlocked since the last folder rescan counts.</para>
        /// </summary>
        private static string? PartRefusal(CraftLoad load)
        {
            var measured = load.Measured;
            var missing = Named(measured?.MissingParts);
            if (missing != null)
            {
                return "this install does not have every part the craft is made of, so nothing "
                    + "can build it: " + missing;
            }

            var locked = Named(measured?.LockedParts);
            if (locked != null)
            {
                return "the craft uses parts whose tech is not researched yet: " + locked;
            }

            var unpurchased = Named(measured?.UnpurchasedParts);
            if (unpurchased != null)
            {
                return "the craft uses parts that are researched but not bought. Unlock them at "
                    + "R&D first, because starting the build would spend funds on them without "
                    + "asking: " + unpurchased;
            }

            // Last, as RP-1 orders it, because the walk may unlock a free config
            // and there is no sense doing that for a craft already refused.
            var configs = Named(Rp1PartConfigs.Errors(load.Ship));
            if (configs != null)
            {
                return "the craft's own parts report a configuration this career has not unlocked: "
                    + configs;
            }

            return null;
        }

        /// <summary>
        /// The names joined into a clause, or null when there are none. An empty
        /// array and a null one mean the same thing to a reader and neither is a
        /// refusal.
        /// </summary>
        private static string? Named(string[]? names) =>
            names == null || names.Length == 0 ? null : string.Join(", ", names);

        /// <summary>
        /// RP-1's own reasons for refusing this vehicle at this complex, joined
        /// into a sentence, or null when it has none.
        ///
        /// <para>Invoked rather than reproduced, the same choice
        /// <see cref="Rp1BuildCommands"/> makes and for the same reason: the
        /// getters it calls memoise onto <c>[Persistent]</c> fields, which a
        /// sampled capture must not do and a command running at the moment of a
        /// press may, because that is exactly where RP-1's own button calls
        /// it.</para>
        ///
        /// <para>An unanswerable check proceeds, the opposite of the price check.
        /// Refusing on an unreadable price protects a career from being
        /// overdrawn with nothing to show; refusing on an unreadable envelope
        /// would kill the whole feature the first time RP-1 renames a member, for
        /// a check whose worst case is a vehicle built at a complex that will not
        /// fly it, which the launch gate still catches before it can
        /// matter.</para>
        /// </summary>
        private static string? FacilityRefusals(object vessel)
        {
            try
            {
                var meets = Rp1Types.InstanceMethod(vessel, "MeetsFacilityRequirements", 1);
                if (meets == null)
                {
                    return null;
                }
                var reasons = new List<string>();
                if (meets.Invoke(vessel, new object[] { reasons }) is bool ok && ok)
                {
                    return null;
                }
                return reasons.Count == 0
                    ? "it is outside the complex's limits"
                    : string.Join("; ", reasons.ToArray());
            }
            catch (Exception)
            {
                // See the doc comment: unanswerable means proceed here.
                return null;
            }
        }

        /// <summary>The complex carrying this id, across every centre.</summary>
        private static bool TryFindComplex(object scm, string lcId, out object complex)
        {
            foreach (var centre in Rp1Types.Enumerate(Rp1Types.Member(scm, "KSCs")))
            {
                foreach (var lc in Rp1Types.Enumerate(Rp1Types.Member(centre, "LaunchComplexes")))
                {
                    if (string.Equals(Rp1Types.ReadGuidString(lc, "ID"), lcId, StringComparison.OrdinalIgnoreCase))
                    {
                        complex = lc;
                        return true;
                    }
                }
            }
            complex = null!;
            return false;
        }

        /// <summary>
        /// Gives the parts back, swallowing whatever the release threw. There is
        /// nothing useful to tell an operator about a failed cleanup and a throw
        /// here would replace a result they can act on with one they cannot.
        /// </summary>
        private static void Release(ICraftCatalogue catalogue, object ship)
        {
            try
            {
                catalogue.Release(ship);
            }
            catch (Exception)
            {
            }
        }

        private ICraftCatalogue? Resolve()
        {
            try
            {
                return _catalogue();
            }
            catch (Exception)
            {
                return null;
            }
        }

        private object? ScmInstance() => _scm == null ? null : Rp1Types.StaticValue(_scm, "Instance");
    }
}
