using System;
using System.Collections.Generic;
using Sitrep.Contract;

namespace Gonogo.KerbalismUplink
{
    /// <summary>
    /// Kerbalism's reliability reader: the summary, the parts listing and the
    /// repair, for the craft core's <c>activeVessel</c> capability reports. The
    /// reflection and the mapping are done by <see cref="KerbalismReflection"/>
    /// and <see cref="KerbalismReliabilityMap"/>.
    ///
    /// <para><b>The vessel comes from core's <c>activeVessel</c> capability
    /// rather than from KSP directly.</b> Those stopped being the same answer
    /// when core began reporting the craft an EVA kerbal stepped out of. The
    /// parts listing an operator picks a part id off is the CRAFT's; KSP's own
    /// answer is the kerbal, which has one part, so every id resolved against
    /// the wrong vehicle and came back <c>no-such-part</c>. Going outside to fix
    /// a failed part is exactly when a repair is wanted, so the path was dead in
    /// the one situation it exists for.</para>
    /// </summary>
    public sealed class KerbalismReliabilityBackend
    {
        private readonly KerbalismReflection _k;
        private readonly Kernel? _kernel;

        /// <param name="kernel">
        /// Core's capability registry, for the <c>activeVessel</c> resolution
        /// described above. Optional, and null means no vessel is resolved: the
        /// reads then report a craft they could not see, which is the honest
        /// degradation, rather than the wrong craft.
        /// </param>
        public KerbalismReliabilityBackend(KerbalismReflection k, Kernel? kernel = null)
        {
            _k = k;
            _kernel = kernel;
        }

        /// <summary>
        /// The vessel every read here and the repair below are scoped to, or
        /// null when there is no flight and when core does not publish the
        /// capability (an older core, or one whose declaration failed).
        ///
        /// <para>Queried per call rather than held, as
        /// <see cref="IActiveVessel"/> requires: the answer changes on a vessel
        /// switch, a dock, an undock, and on both ends of an EVA.</para>
        /// </summary>
        private Vessel? ScopedVessel() => _kernel.ReportedVessel() as Vessel;

        public string ProviderId => "kerbalism";

        /// <summary>
        /// Three gates, in order, and none of them collapses into another.
        ///
        /// <para>The <c>mtbfFailures</c> gate is load-bearing and is not optional.
        /// With <c>Features.Reliability</c> ON and
        /// <c>PreferencesReliability.Instance.mtbfFailures</c> OFF the entire
        /// wear-and-break path is skipped (Kerbalism's own <c>Reliability</c>
        /// FixedUpdate guards on it): the failure deadline is never rolled, nothing
        /// wears, nothing ever breaks by MTBF, and every part reads clean. Without
        /// this gate the operator would be told the craft is watched and healthy
        /// while nothing at all is being modelled.</para>
        ///
        /// <para>It is also the reason <c>Indeterminate</c> is reachable at all:
        /// <c>KERBALISM.Features.Reliability</c> is a public static bool, so
        /// whenever the Features type resolves the key is present, and a tri-state
        /// cut only there would be cut at a seam nothing crosses.</para>
        /// </summary>
        public string Coverage =>
            KerbalismReliabilityMap.ComputeCoverage(
                _k.Features(), _k.ReliabilityPreferences());

        /// <summary>
        /// Whether Kerbalism is modelling reliability at all: false only when
        /// the feature or <c>mtbfFailures</c> is definitely off, so an
        /// indeterminate switch still serves and says so through
        /// <see cref="Coverage"/>.
        /// </summary>
        public static bool CanServe(KerbalismReflection k) =>
            KerbalismReliabilityMap.CanServe(
                k.Features(), k.ReliabilityPreferences());

        public ReliabilitySummary Summary()
        {
            // ONE Coverage computation per call rather than one per gate: the
            // property reflects.
            var coverage = Coverage;
            var v = ScopedVessel();
            var raw = v != null ? _k.Reliability(v) : new ReliabilityRaw();
            return KerbalismReliabilityMap.Summary(raw, _k.ReliabilityPreferences(), coverage);
        }

        /// <summary>
        /// One repair, whole intent, single call. See
        /// <see cref="KerbalismReflection.AttemptRepair"/> for the mechanism and
        /// for why the kit guard has to be held off around it.
        ///
        /// <para>Refuses when this save is not modelling failures at all,
        /// rather than reaching for a module that will not be there.</para>
        /// </summary>
        public CommandResult<RepairOutcome> Repair(string partId, string crewName)
        {
            if (Coverage != ReliabilityCoverage.Modeled)
            {
                return CommandResult<RepairOutcome>.Fail(RepairRefusal.NotModelled);
            }

            var v = ScopedVessel();
            if (v == null)
            {
                return CommandResult<RepairOutcome>.Fail(RepairRefusal.NoSuchPart);
            }

            var raw = _k.AttemptRepair(v, partId, crewName);
            if (!raw.Repaired)
            {
                return CommandResult<RepairOutcome>.Fail(raw.Refusal ?? CommandErrorCode.ModeUnavailable);
            }
            return CommandResult<RepairOutcome>.Ok(new RepairOutcome
            {
                Repaired = true,
                KitsUsed = raw.KitsUsed,
                KitsFrom = raw.KitsFrom,
            });
        }

        public IReadOnlyList<ReliabilityPartEntry> Parts()
        {
            var coverage = Coverage;
            var v = ScopedVessel();
            var raw = v != null ? _k.Reliability(v) : new ReliabilityRaw();
            // The kit requirement is an install PREFERENCE, not a per-part fact,
            // so it is read here beside Coverage rather than carried on every
            // part of the capture.
            return KerbalismReliabilityMap.Parts(
                raw,
                coverage,
                _k.ReliabilityPreferences().RequireRepairKits);
        }
    }
}
