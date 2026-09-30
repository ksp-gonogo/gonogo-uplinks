// RP-1's part-config check, walked over a loaded craft. No compile-time reference
// to RP0.dll or to KSP, the same arm's-length reflection as Rp1ScReflection, whose
// header carries the provenance rules this file follows.
//
// WHAT THIS IS A COPY OF. VesselBuildValidator.GetConfigErrorsDict, the step
// RP-1's integrate button runs as ProcessPartConfigs. KSP has no notion of a part
// configuration being invalid; the convention is the part MODULE's, a public
//
//     bool Validate(out string error, out bool canBeResolved,
//                   out float costToResolve, out string techToResolve)
//
// which RealFuels' engine configs and a handful of other mods implement, and
// which RP-1 finds by exact signature on every module of every part. A module
// with no such method has nothing to say and is skipped.
//
// THE ONE THING RP-1 DOES WITHOUT ASKING. An error that can be resolved for at
// most 1.1 funds is resolved on the spot, by the module's own
// ResolveValidationError with RP0.Harmony.RFECMPatcher.techNode set to the
// error's tech, and only an error that survives that reaches RP-1's popup. It is
// reproduced here because refusing it would refuse a craft RP-1's own button
// integrates, and techNode is set because it is what routes the purchase through
// RP-1's patched path (unlock credit and currency modifiers) instead of
// RealFuels' raw one. When techNode cannot be written the resolve is not
// attempted, so the error stands and the craft is refused rather than bought on
// the wrong terms.
//
// WHAT IS NOT REPRODUCED. RP-1's popup offers to pay for anything dearer, and a
// command that answered it would spend an operator's funds on a question nobody
// asked it. Those errors are reported with their base cost instead.
//
// WHAT IS READ:
//
//   ShipConstruct.Parts / Part.Modules / Part.partInfo / AvailablePart.title
//                                    KSP's own, the same walk the tooling and
//                                    career-cost readings make over the editor's
//                                    ship
//
// WHAT IS INVOKED OR WRITTEN, each a thing RP-1 does on the same click:
//
//   <module>.Validate(out, out, out, out)
//   <module>.ResolveValidationError()
//   RFECMPatcher.techNode            internal static, set before the resolve and
//                                    cleared after it, as RP-1's PurchaseConfig
//                                    does
//
// PROVENANCE. Read out of an ilspycmd disassembly of the INSTALLED RP-1 RP0.dll.
// Shape, not value: nothing here has been exercised against a running game.
using System;
using System.Collections.Generic;
using System.Globalization;
using System.Reflection;

namespace GonogoRp1Uplink
{
    /// <summary>
    /// What a loaded craft's own part modules say is wrong with their
    /// configuration, after RP-1's free resolutions have been made.
    /// </summary>
    public static class Rp1PartConfigs
    {
        private const string PatcherTypeName = "RP0.Harmony.RFECMPatcher";

        /// <summary>
        /// The cost at or below which RP-1 resolves an error without asking,
        /// compared the way RP-1 compares it: the float widened to a double.
        /// </summary>
        private const double FreeResolveCeiling = 1.1;

        private static readonly Type[] ValidateSignature =
        {
            typeof(string).MakeByRefType(),
            typeof(bool).MakeByRefType(),
            typeof(float).MakeByRefType(),
            typeof(string).MakeByRefType(),
        };

        /// <summary>
        /// One line per error, each naming its part, or null when no module
        /// complained. A ship whose parts cannot be read is null too, as it is to
        /// RP-1: there is nothing to have walked.
        ///
        /// <para>Must run on the game's main thread with the craft's parts still
        /// alive, because it calls into the modules and may unlock a config.</para>
        /// </summary>
        public static string[]? Errors(object? ship)
        {
            var errors = new List<string>();
            foreach (var part in Rp1Types.Enumerate(Rp1Types.Member(ship, "Parts")))
            {
                foreach (var module in Rp1Types.Enumerate(Rp1Types.Member(part, "Modules")))
                {
                    var complaint = Complaint(module);
                    if (complaint == null)
                    {
                        continue;
                    }
                    if (complaint.CanBeResolved
                        && complaint.CostToResolve <= FreeResolveCeiling
                        && Resolve(module, complaint.TechToResolve))
                    {
                        continue;
                    }
                    errors.Add(PartTitle(part) + ": " + complaint.Describe());
                }
            }
            return errors.Count == 0 ? null : errors.ToArray();
        }

        /// <summary>
        /// One module's complaint, or null when it has none or declares no
        /// <c>Validate</c>. A check that throws is a complaint, because RP-1
        /// counts it as one: a module that cannot vouch for its configuration is
        /// not integrated.
        /// </summary>
        private static ConfigComplaint? Complaint(object module)
        {
            MethodInfo? validate;
            try
            {
                validate = module.GetType().GetMethod("Validate", BindingFlags.Instance | BindingFlags.Public, null, ValidateSignature, null);
            }
            catch (Exception)
            {
                return null;
            }
            if (validate == null)
            {
                return null;
            }

            var arguments = new object?[4];
            try
            {
                if (validate.Invoke(module, arguments) is bool ok && ok)
                {
                    return null;
                }
            }
            catch (Exception ex)
            {
                return new ConfigComplaint("its configuration check failed (" + Rp1Types.ExceptionReason(ex) + ")", false, 0f, null);
            }

            return new ConfigComplaint(
                arguments[0] as string,
                arguments[1] is bool resolvable && resolvable,
                arguments[2] is float cost ? cost : 0f,
                arguments[3] as string);
        }

        /// <summary>
        /// RP-1's PurchaseConfig: the module's own resolve, with the patcher
        /// pointed at the error's tech for exactly the length of the call. False
        /// on anything that did not report success, which leaves the error
        /// standing.
        /// </summary>
        private static bool Resolve(object module, string? tech)
        {
            var patcher = Rp1Types.Find(PatcherTypeName);
            if (patcher == null || !Rp1Types.WriteStatic(patcher, "techNode", tech))
            {
                return false;
            }
            try
            {
                var resolve = module.GetType().GetMethod("ResolveValidationError", BindingFlags.Instance | BindingFlags.Public);
                return resolve != null && resolve.Invoke(module, new object[0]) is bool ok && ok;
            }
            catch (Exception)
            {
                return false;
            }
            finally
            {
                Rp1Types.WriteStatic(patcher, "techNode", null);
            }
        }

        /// <summary>The part's display title, as RP-1's popup names it.</summary>
        private static string PartTitle(object part)
        {
            var title = Rp1Types.ReadString(Rp1Types.Member(part, "partInfo"), "title");
            return string.IsNullOrEmpty(title) ? "a part" : title!;
        }

        private sealed class ConfigComplaint
        {
            public ConfigComplaint(string? error, bool canBeResolved, float costToResolve, string? techToResolve)
            {
                Error = error;
                CanBeResolved = canBeResolved;
                CostToResolve = costToResolve;
                TechToResolve = techToResolve;
            }

            public string? Error { get; }

            public bool CanBeResolved { get; }

            public float CostToResolve { get; }

            public string? TechToResolve { get; }

            /// <summary>
            /// The module's own words, and for one that can be bought, what it
            /// costs before unlock credit, because that is the whole of what an
            /// operator needs to decide whether to go and buy it.
            /// </summary>
            public string Describe()
            {
                var said = string.IsNullOrEmpty(Error) ? "reports an invalid configuration" : Error!;
                return CanBeResolved
                    ? said + " (unlockable, base cost " + CostToResolve.ToString("N0", CultureInfo.InvariantCulture) + " funds)"
                    : said;
            }
        }
    }
}
