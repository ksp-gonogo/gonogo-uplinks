// TestFlight's reliability reader: the summary, the engine listing and the repair,
// for the craft core's activeVessel capability reports.
using System.Collections.Generic;
using Sitrep.Contract;

namespace GonogoTestFlightUplink
{
    public sealed class TestFlightReliabilityBackend
    {
        private readonly TestFlightReflection _tf;
        private readonly Kernel? _kernel;

        /// <param name="kernel">
        /// Core's capability registry, for the <c>activeVessel</c> resolution
        /// described on <see cref="ScopedVessel"/>. Optional, and null resolves
        /// no vessel: the listing comes back empty and the repair refuses, rather
        /// than either answering for a craft this backend could not confirm.
        /// </param>
        public TestFlightReliabilityBackend(TestFlightReflection tf, Kernel? kernel = null)
        {
            _tf = tf;
            _kernel = kernel;
        }

        /// <summary>
        /// The craft this backend answers for, from core's <c>activeVessel</c>
        /// capability rather than from KSP.
        ///
        /// <para>During an EVA KSP's own active vessel is the kerbal, while
        /// <c>vessel.parts</c> lists the CRAFT's parts, so a part id the operator
        /// can see would resolve against a kerbal who has one part and come back
        /// unrepairable. Going outside to fix a failed
        /// engine is the whole reason the verb exists.</para>
        ///
        /// <para>Queried per call, as <see cref="IActiveVessel"/> requires: the
        /// answer changes on a vessel switch, a dock, an undock, and on both ends
        /// of an EVA.</para>
        /// </summary>
        private Vessel? ScopedVessel() => _kernel.ReportedVessel() as Vessel;

        /// <summary>
        /// A partially-bound binder stays <c>Modeled</c>: if part conditions are
        /// readable then reliability IS being modelled and reported, and missing
        /// rated-time reads only mean the budgets are absent. Absent is not the
        /// same as unreadable, and the difference is exactly which of the two is
        /// true. <c>Indeterminate</c> is reserved for the case where not even a
        /// part's condition can be read.
        /// </summary>
        public string Coverage
        {
            get
            {
                if (!_tf.IsAvailable) return ReliabilityCoverage.None;
                return _tf.BoundPartStatus
                    ? ReliabilityCoverage.Modeled
                    : ReliabilityCoverage.Indeterminate;
            }
        }

        /// <summary>
        /// MAIN-THREAD read of both payloads: TestFlight's cores are part modules.
        /// Null when TestFlight is not installed, which is the publish gate: the
        /// topics then say nothing rather than claim a craft of clean engines.
        /// </summary>
        public TestFlightReliabilityCapture? Capture()
        {
            var coverage = Coverage;
            if (coverage == ReliabilityCoverage.None) return null;

            var binding = _tf.Binding;
            var v = ScopedVessel();
            return new TestFlightReliabilityCapture
            {
                Summary = TestFlightReliabilityMap.Summary(coverage, binding),
                Parts = v == null
                    ? new List<TestFlightReliabilityPart>()
                    : TestFlightReliabilityMap.Parts(_tf.Engines(v)),
            };
        }

        /// <summary>
        /// TestFlight's own repair, driven through
        /// <c>ITestFlightCore.ForceRepair</c>: there is no repair button anywhere
        /// in the three TestFlight assemblies, only a public static
        /// <c>TestFlightInterface.ForceRepair</c> facade meant for exactly this.
        /// See <see cref="TestFlightReflection.Repair"/>.
        /// </summary>
        public CommandResult<TestFlightRepairOutcome> Repair(string partId) =>
            _tf.Repair(ScopedVessel(), partId);
    }

    /// <summary>Both reliability payloads from one capture, handed from the main thread to the Courier.</summary>
    public sealed class TestFlightReliabilityCapture
    {
        public TestFlightReliabilitySummary Summary = new();
        public List<TestFlightReliabilityPart> Parts = new();
    }
}
