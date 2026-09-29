/*
 * What RP-1 calls a space centre, read by reflection. No compile-time reference
 * to RP0.dll or Assembly-CSharp.
 *
 * PROVENANCE. Both members below were read out of ilspycmd disassemblies of the
 * shipped RP-1 v4.6.0.0 and v4.7.0.0 RP0.dll and of KSP 1.12's Assembly-CSharp.
 *
 *   KSCSwitcherInterop.GetAvailableSites
 *       null when KSCSwitcher is absent, else one (name, displayName) pair per
 *       site in KSCSwitcher's config, with the name substituted for a missing
 *       displayName, sorted. It hands back the config value as written, and
 *       under RSS that is a localisation tag (#RSS_Site_cape_canaveral_name):
 *       KSP's GameDatabase never translates a value on load.
 *
 *   MaintenanceGUI.LocalizeSiteName
 *       the Budget tab's own answer, and the rule reproduced here. It walks the
 *       same KSCSWITCHER config, puts a displayName starting with '#' through
 *       Localizer.Format, and falls back to the id. It is private and on a GUI
 *       object, so it is copied rather than called.
 *
 *   KSP.Localization.Localizer.Format(string)
 *       a lookup into the loaded language's tag table, "" before the Localizer
 *       exists.
 */
using System;
using System.Collections.Generic;

namespace GonogoRp1Uplink
{
    /// <summary>
    /// Space centre id to the name RP-1's Budget tab prints for it, built once:
    /// KSCSwitcher's site list is config loaded at game start and does not move.
    /// </summary>
    public sealed class Rp1SiteNames
    {
        private const string KscSwitcherInteropTypeName = "RP0.KSCSwitcherInterop";
        private const string LocalizerTypeName = "KSP.Localization.Localizer";

        private Dictionary<string, string>? _names;

        /// <summary>
        /// What to call a space centre, or null.
        /// </summary>
        /// <remarks>
        /// Null on three conditions, all real. KSCSwitcher not installed is a
        /// whole class of RP-1 career and RP-1 answers null for it. A site with
        /// no display name of its own is the second, and RP-1 substitutes the id
        /// there: that substitution is dropped rather than republished, because a
        /// name field carrying <c>us_cape_canaveral</c> is the bug this field
        /// exists to fix, wearing the fix's name. A tag the Localizer cannot
        /// resolve is the third, for the same reason. A client falls back to the
        /// id in all three and gets what the game shows.
        /// </remarks>
        public string? For(string? kscName)
        {
            if (kscName == null)
            {
                return null;
            }
            return Names().TryGetValue(kscName, out var display) ? display : null;
        }

        private Dictionary<string, string> Names()
        {
            if (_names != null)
            {
                return _names;
            }
            var map = new Dictionary<string, string>(StringComparer.Ordinal);
            try
            {
                var interop = Rp1Types.Find(KscSwitcherInteropTypeName);
                var sites = interop == null
                    ? null
                    : Rp1Types.StaticMethod(interop, "GetAvailableSites", 0)?.Invoke(null, null);
                var localizer = Rp1Types.Find(LocalizerTypeName);
                var format = localizer == null ? null : Rp1Types.StaticMethod(localizer, "Format", 1);
                foreach (var site in Rp1Types.Enumerate(sites))
                {
                    // A ValueTuple of (id, displayName), so the pair arrives as
                    // two public fields rather than as anything named.
                    var id = Rp1Types.Member(site, "Item1") as string;
                    var display = Localize(format, Rp1Types.Member(site, "Item2") as string);
                    if (!string.IsNullOrEmpty(id)
                        && !string.IsNullOrEmpty(display)
                        && display![0] != '#'
                        && !string.Equals(id, display, StringComparison.Ordinal))
                    {
                        map[id!] = display;
                    }
                }
            }
            catch (Exception)
            {
                // fail-soft: an unreadable site list leaves every centre naming
                // itself by its id, which is where RP-1's own fallback lands too
            }
            _names = map;
            return map;
        }

        private static string? Localize(System.Reflection.MethodInfo? format, string? display)
        {
            if (string.IsNullOrEmpty(display) || display![0] != '#' || format == null)
            {
                return display;
            }
            try
            {
                return format.Invoke(null, new object[] { display }) as string;
            }
            catch (Exception)
            {
                return null;
            }
        }
    }
}
