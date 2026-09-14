// mod/GonogoTestFlightUplink/TestFlightRepairScope.cs
// The KSP-free half of a TestFlight repair: which core a published part id
// names, and what a walk's counts mean. Carved out of TestFlightReflection so a
// headless test can enter it, the same discipline every other backend's
// repair-scope carve-out follows.
//
// Read off the INSTALLED TestFlight v2.12.0.0 (decompiled 2026-09-03):
//
//   ITestFlightFailure.CanAttemptRepair()  a per-failure-CLASS predicate, base
//       returns true, overridden to false by exactly three shipped modules
//       (Explode, DockingClamp, SolarMechFail). It is not a crew or situation
//       check, and TestFlight itself never calls it.
//   ITestFlightCore.ForceRepair(failure)   the only live repair path: calls the
//       failure's own ForceRepair() -> DoRepair(), removes it from the core's
//       list and recomputes hasMajorFailure.
//   ITestFlightFailure.AttemptRepair() / GetRepairTime()  declared, never called
//       by TestFlight, never overridden, base returns 0f from both.
//   RepairRequirements                     declared in TestFlightAPI, referenced
//       by nothing at all.
//
// So TestFlight's repair costs nothing, requires no crew, takes no time and has
// no EVA condition. The three refusals below are the only ones it can produce.
using System.Globalization;
using Sitrep.Contract;

namespace GonogoTestFlightUplink
{
    public static class TestFlightRepairScope
    {
        /// <summary>
        /// Split a published <c>reliability.parts</c> id back into the KSP
        /// flightID and the occurrence index within that part.
        ///
        /// <para>The id is minted as <c>"&lt;flightID&gt;:&lt;occurrence&gt;"</c>
        /// by <see cref="TestFlightReliabilityMap.Parts"/>, because one part can
        /// carry more than one active core and a bare flightID would merge the
        /// rows. A repair therefore has to undo the same join, and reading only
        /// the flightID would repair whichever core happened to come first.</para>
        /// </summary>
        public static bool TryParsePartId(string? partId, out uint flightId, out int occurrence)
        {
            flightId = 0;
            occurrence = 0;
            if (string.IsNullOrEmpty(partId)) return false;

            var colon = partId!.IndexOf(':');
            var idText = colon < 0 ? partId : partId.Substring(0, colon);
            if (!uint.TryParse(idText, NumberStyles.None, CultureInfo.InvariantCulture, out flightId))
            {
                return false;
            }
            if (colon < 0) return true;

            var tail = partId.Substring(colon + 1);
            // A bare flightID is a legitimate id for a single-core part, so a
            // missing occurrence means the first one rather than a parse failure.
            // A PRESENT but unreadable one is a different thing and refuses.
            if (tail.Length == 0) return true;
            return int.TryParse(tail, NumberStyles.None, CultureInfo.InvariantCulture, out occurrence);
        }

        /// <summary>
        /// Whether a TestFlight core is the one flying: TestFlight is running it,
        /// and it belongs to the active engine config rather than one of the many
        /// an RO part carries.
        ///
        /// <para>Both arguments are null when the property did not bind, the read
        /// threw, or the value was not a bool, and null answers false. This is a
        /// GUARD, so it fails CLOSED: a core we cannot confirm is live is not
        /// reported as a reliability model and is not repaired. Written
        /// <c>== false</c> it failed OPEN precisely when the binder had regressed,
        /// putting rated burn times and survival odds for a config the vessel is
        /// not flying on screen as extra rows, and pointing a repair at a core the
        /// operator never named.</para>
        ///
        /// <para>Shared so the listing walk and the repair walk cannot filter
        /// differently: two walks that number the cores differently mint an id
        /// against one and act on the other.</para>
        /// </summary>
        public static bool IsLiveCore(bool? testFlightEnabled, bool? activeConfiguration) =>
            testFlightEnabled == true && activeConfiguration == true;

        /// <summary>
        /// What a walk that reached the named core found, as a refusal token.
        /// Null means there is something to repair and the walk should go ahead.
        ///
        /// <para><paramref name="repairable"/> is the count of active failures
        /// whose <c>CanAttemptRepair()</c> is true. Nothing failed and a part
        /// whose every failure is terminal are different answers, and collapsing
        /// them would tell an operator whose engine has exploded to go looking
        /// for a part id that is sitting right there.</para>
        ///
        /// <para><paramref name="activeFailures"/> is null when the core's failure
        /// list could not be READ at all, which is not the same fact as an empty
        /// one and must not borrow its answer: counted as zero it told an operator
        /// whose row says <c>failed</c> that no such part exists, while the row and
        /// the button sat beside each other. It refuses as <c>not-modelled</c>,
        /// the same token an unbound failure-list member already produces.</para>
        /// </summary>
        public static string? RefusalFor(bool coreFound, int? activeFailures, int repairable)
        {
            if (!coreFound) return RepairRefusal.NoSuchPart;
            if (activeFailures == null) return RepairRefusal.NotModelled;
            if (activeFailures == 0) return RepairRefusal.NoSuchPart;
            if (repairable == 0) return RepairRefusal.Unrepairable;
            return null;
        }

        /// <summary>
        /// Whether the attempt worked, OBSERVED from the core's own failure list
        /// afterwards rather than from <c>ForceRepair</c>'s return value, which
        /// is <c>0f</c> on every path including the ones that do nothing.
        ///
        /// <para>Counted against the failures we asked it to clear rather than
        /// against zero: a part with one repairable failure and one terminal one
        /// is repaired when the first is gone, and judging it by an empty list
        /// would report a failure for a repair that did everything it could.</para>
        /// </summary>
        public static bool Cleared(int repairableBefore, int repairableAfter) =>
            repairableBefore > 0 && repairableAfter < repairableBefore;
    }
}
