using System.Collections.Generic;

namespace Gonogo.ScansatUplink
{
    /// <summary>
    /// The opaque payload the SCANsat uplink's MAIN-THREAD capture produces
    /// and hands to its COURIER-THREAD handle (see
    /// <see cref="Sitrep.Contract.IUplinkHost.AddSampledSource"/> and
    /// <see cref="ScansatUplink"/>'s <c>CaptureOnMain</c>/<c>HandleOnCourier</c>).
    /// This is deliberately PLAIN, self-contained data, no live KSP/Unity
    /// object references (no <c>CelestialBody</c>, no SCANsat handles), so
    /// every KSP-facing read has already happened on the main thread by the
    /// time the Courier-side handle (<see cref="ScanPublications.Compute"/>)
    /// runs. That KSP-free-ness is what lets the whole Courier-side path be
    /// compiled and exercised in the headless test project with no SCANsat/KSP
    /// DLLs present at all.
    /// </summary>
    internal sealed class ScanCapture
    {
        /// <summary>UT the capture was taken at (from the tick's snapshot), every publication rides this timestamp.</summary>
        public double Ut;

        /// <summary>The active vessel's main body name: the sub-topic body component for every channel.</summary>
        public string BodyName = "";

        /// <summary>
        /// A per-read SNAPSHOT of the body's SCANdata coverage grid (already
        /// copied off the live array on the main thread), or null when SCANsat
        /// has no data for this body yet (never scanned), in which case no
        /// coverage/mask is published.
        /// </summary>
        public short[,]? Coverage;

        /// <summary>
        /// Per client SCANtype bit -> coverage PERCENTAGE [0,100]
        /// (<c>SCANUtil.GetCoverage</c>), captured on the main thread. Null iff
        /// <see cref="Coverage"/> is null.
        ///
        /// <para>A per-type value is itself nullable, for the type whose
        /// percentage SCANsat refused to answer. "0% scanned" is the figure an
        /// operator plans a whole mapping campaign around, and one substituted
        /// for a read that failed says the body is untouched: they fly a survey
        /// that was already done.</para>
        /// </summary>
        public Dictionary<short, double?>? CoveragePercents;

        /// <summary>
        /// True the FIRST time this body is visited: the (expensive, ~64800-
        /// point) stock PQS height + BiomeMap grids were built on the main
        /// thread and are carried below for a one-shot keyframe. False on every
        /// later visit (near-static, per spec §2.2) so the grids are neither
        /// rebuilt nor re-published.
        /// </summary>
        public bool IncludeHeightBiome;

        /// <summary>
        /// Valid iff <see cref="IncludeHeightBiome"/>: the packed stock-PQS
        /// elevation grid, or null when the body's PQS controller could not be
        /// reached (see <see cref="ScanGrids.BuildHeights"/> for why no grid
        /// beats a flat one). The biome keyframe beside it still publishes: a
        /// byte-per-cell index grid CAN spell an unread cell, as 0xFF.
        /// </summary>
        public ScanGrids.HeightGrid? HeightGrid;

        /// <summary>Valid iff <see cref="IncludeHeightBiome"/>: the body's biome legend entries.</summary>
        public List<object?>? BiomeEntries;

        /// <summary>Valid iff <see cref="IncludeHeightBiome"/>: the packed per-cell biome index grid.</summary>
        public byte[]? BiomeIndices;

        /// <summary>
        /// The body's SCANsat anomalies (<c>SCANdata.Anomalies</c>), already
        /// shaped into wire dicts via <see cref="ScanAnomalies.Build"/>,
        /// null iff <see cref="Coverage"/> is null (no SCANdata for this body
        /// yet, same gate as coverage/mask). Republished alongside
        /// coverage/mask whenever the body's coverage-grid hash changes (see
        /// <see cref="ScanPublications.Compute"/>) since Known/Detail are
        /// themselves derived from that same grid.
        /// </summary>
        public List<object?>? Anomalies;
    }
}
