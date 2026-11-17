using System.Reflection;
using Gonogo.KosUplink;
using Sitrep.Contract;
using Sitrep.Contract.TestSupport;
using Xunit;

namespace GonogoKosUplink.Tests
{
    /// <summary>
    /// The per-Uplink half of the uplink-types-out-of-core plan's Unit guard
    /// (§5b): now that the nine <c>Kos*</c> payload and command-arg types live
    /// in their own assembly (<c>GonogoKosUplink.Contract</c>) instead of
    /// <c>Sitrep.Contract</c>, nothing forces a future property on this Uplink's
    /// own contract types to declare its unit. The sweep itself is
    /// <c>UnitCoverageAssertion.AssertExhaustive</c>, shared with every other
    /// relocated Uplink; this file names what is this Uplink's own.
    ///
    /// <para><b>Why no baseline file.</b> Every scalar property on all ten
    /// types is already annotated, so the surface starts, and must stay, entirely
    /// covered: same zero-pending starting point as every other relocated
    /// slice.</para>
    ///
    /// <para><b>No quantities at all.</b> Every property here is an
    /// <c>Id</c>/<c>Text</c>/<c>Flag</c>/<c>Count</c>, so the attribute gate does
    /// all the work: a bare <c>string LeaseToken</c> added to one of the terminal
    /// arg types would be invisible to any Value-based check and is caught here.
    /// The <c>Units.Count</c> pair on <see cref="KosTerminalResizeArgs"/> shows
    /// the two halves are separate: <c>Count</c> is deliberately not in
    /// <c>RtConfig.NonQuantityUnits</c>, so those two would retype on any
    /// non-args type, and they stay bare purely because of the inbound-only
    /// rule.</para>
    ///
    /// <para>This test only checks the attribute side (every scalar wire
    /// property carries <c>[SitrepUnit]</c>); the generated-file/import side is
    /// <c>generated-value-import.test.ts</c> in this Uplink's client package,
    /// and the runtime-registry side is <c>topics.test.ts</c> there.</para>
    /// </summary>
    public class KosUnitCoverageTests
    {
        [Fact]
        public void EveryScalarWirePropertyDeclaresAUnit() =>
            UnitCoverageAssertion.AssertExhaustive(
                typeof(KosProcessorInfo).Assembly,
                "Units.Count");

        /// <summary>
        /// All ten are reached by the sweep, and nothing else is.
        /// <see cref="EveryScalarWirePropertyDeclaresAUnit"/> passes vacuously on
        /// any type the sweep does not reach, and this slice spans three files, so
        /// one of them losing its <c>[SitrepContract]</c> tags wholesale would
        /// leave the remaining green looking untouched.
        /// </summary>
        [Fact]
        public void EveryRelocatedTypeIsReachedByTheCoverageScan() =>
            UnitCoverageAssertion.AssertContractTypesAreExactly(
                typeof(KosProcessorInfo).Assembly,
                nameof(KosProcessorInfo),
                nameof(KosTerminalFrame), nameof(KosTerminalOpenArgs),
                nameof(KosKeystrokeArgs), nameof(KosTerminalResizeArgs),
                nameof(KosTerminalCloseArgs),
                nameof(KosRunArgs), nameof(KosRunResult), nameof(KosCancelArgs), nameof(KosLogEntry),
                nameof(KosFilesListArgs), nameof(KosFilesReadArgs), nameof(KosFilesWriteArgs),
                nameof(KosFilesDeleteArgs), nameof(KosFilesRenameArgs));

        /// <summary>
        /// <see cref="KosRunResult.Fields"/> and <see cref="KosRunArgs.Args"/> are
        /// the properties in the slice the sweep must not demand a unit for: each
        /// holds whatever values a script hands back or is given, so there is no
        /// single dimension that could describe them. It is the contrast case to a name-keyed map of same-unit
        /// readings, where the annotation is the thing that makes the numbers
        /// renderable.
        /// </summary>
        [Fact]
        public void TheHeterogeneousFieldMapIsExemptAndDeliberatelyUnannotated()
        {
            var fields = typeof(KosRunResult).GetProperty(nameof(KosRunResult.Fields))!;

            Assert.False(
                UnitCoverageAssertion.RequiresUnit(fields),
                "A dictionary collapses to object: the sweep cannot demand an annotation.");
            Assert.Null(fields.GetCustomAttribute<SitrepUnitAttribute>());

            var args = typeof(KosRunArgs).GetProperty(nameof(KosRunArgs.Args))!;
            Assert.False(UnitCoverageAssertion.RequiresUnit(args));
            Assert.Null(args.GetCustomAttribute<SitrepUnitAttribute>());
        }
    }
}
