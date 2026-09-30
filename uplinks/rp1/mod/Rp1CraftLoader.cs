using Sitrep.Contract;

namespace GonogoRp1Uplink
{
    /// <summary>
    /// Opens one of the save's craft files into live parts for
    /// <c>rp1.build.start</c>, and destroys them again.
    ///
    /// <para>Every member is main-thread only: the load instantiates a Unity part
    /// per PART node, and those objects must be given back to
    /// <see cref="Release"/> whether the command used them or refused part-way.
    /// This assembly holds no KSP or Unity reference, so the loader is handed in
    /// by whoever can manage that lifetime. When nothing can, the command's gate
    /// draws it dark with the reason.</para>
    /// </summary>
    public interface IRp1CraftLoader
    {
        /// <summary>
        /// Loads one craft, addressed by <see cref="CraftFileRecord.File"/> and the
        /// facility whose folder holds it. The facility is required rather than
        /// searched for: the VAB and SPH folders may each hold a file of the same
        /// name.
        /// </summary>
        Rp1CraftLoad Load(string? file, KspEditorFacility? facility);

        /// <summary>
        /// Destroys the parts a <see cref="Load"/> instantiated. Safe to call with
        /// null and safe to call twice.
        /// </summary>
        void Release(object? ship);
    }

    /// <summary>
    /// A craft loaded into live parts, or the reason it was not. Two fields
    /// rather than a nullable handle, because "there is no such craft" and "the
    /// file is corrupt" are different sentences to put in front of an operator.
    /// </summary>
    public sealed class Rp1CraftLoad
    {
        /// <summary>
        /// The loaded craft as an opaque handle: a KSP <c>ShipConstruct</c>,
        /// handed to RP-1 by reflection without naming the type.
        /// </summary>
        public object? Ship { get; set; }

        /// <summary>Why nothing was loaded, in words an operator can act on. Null on success.</summary>
        public string? Failure { get; set; }

        /// <summary>
        /// The craft measured from the parts just loaded rather than from the
        /// cached listing, so a part unlocked since the last rescan counts.
        /// </summary>
        public CraftFileRecord? Measured { get; set; }

        /// <summary>
        /// What the craft's own part modules say is wrong with their
        /// configuration, or null when none said anything.
        /// </summary>
        public string[]? ConfigErrors { get; set; }

        /// <summary>A failed load carrying the reason.</summary>
        public static Rp1CraftLoad Failed(string reason) => new Rp1CraftLoad { Failure = reason };
    }
}
