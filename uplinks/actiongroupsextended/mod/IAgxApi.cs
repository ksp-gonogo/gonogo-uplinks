using System.Collections.Generic;

namespace Gonogo.ActionGroupsExtendedUplink
{
    /// <summary>
    /// KSP-free, Sitrep.Contract-free pure plumbing seam onto Action Groups
    /// Extended. <see cref="AgxReflection"/> is the only real implementation,
    /// it carries the arm's-length GPL3 reflection boundary, but the
    /// mapping logic in <see cref="AgxActionGroupsBackend"/> is written
    /// against this interface so it is unit-testable with a fake, exactly
    /// the extra TDD step the RA uplink does not take (RA leaves its backend
    /// untested; AGX goes one step further here).
    /// </summary>
    public interface IAgxApi
    {
        /// <summary>Whether the AGExt assembly is loaded and its surface resolved (the election gate).</summary>
        bool IsAvailable { get; }

        /// <summary>
        /// Every group AGExt reports assigned on the active vessel, in
        /// whatever order the underlying call returns them. Null means "no
        /// data this tick" / a read failure, the contract's documented
        /// typed absence, mirroring <c>IActionGroupsBackend.Groups()</c>'s
        /// null contract: and must NEVER be conflated with an empty list
        /// (which would assert "this vessel has zero groups").
        ///
        /// <para><b>The failure is whole-tick because that is the only shape
        /// available.</b> AGExt reads each group's state through its own
        /// surface, so one group can fail while the rest answer, and the honest
        /// reading of that is a PER-GROUP absence: the entry present with an
        /// unknown state, rather than the whole list withheld along with nine
        /// groups that read fine. It cannot be spelled through
        /// <see cref="AgxGroup.State"/> while
        /// <c>Sitrep.Contract.ActionGroupState.State</c> is a plain bool, which
        /// is what the vendored contract this Uplink compiles against carries.
        /// Widening <see cref="AgxGroup.State"/> on its own does not build: the
        /// assignment in <c>AgxActionGroupsBackend.Groups</c> fails CS0266.
        /// Widen both together once a contract with a three-valued
        /// <c>State</c> is published, and let a single group fail alone.</para>
        /// </summary>
        IReadOnlyList<AgxGroup>? AssignedGroups();

        /// <summary>Sets one group by AGExt's own 1-based index. Returns AGExt's own success bool.</summary>
        bool Activate(int index, bool on);
    }

    /// <summary>One AGX-assigned group: AGExt's own index, its player-given name (or null if unnamed), and its current on/off state.</summary>
    public readonly struct AgxGroup
    {
        public int Index { get; }
        public string? Name { get; }
        public bool State { get; }

        public AgxGroup(int index, string? name, bool state)
        {
            Index = index;
            Name = name;
            State = state;
        }
    }
}
