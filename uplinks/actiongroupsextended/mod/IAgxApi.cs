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
        /// <para><b>Two failures, two shapes, and which one you get depends on
        /// whether the group can still be identified.</b> AGExt reads each
        /// group's state through its own surface, so one group can fail while
        /// the rest answer. A group whose STATE cannot be read is returned
        /// present with a null <see cref="AgxGroup.State"/>, so the other nine
        /// are not withheld along with it and the operator still sees a group
        /// the vessel has. A group whose INDEX cannot be read has no identity
        /// to hang that unknown on — it cannot be placed in the list or
        /// commanded — so it still declines the whole tick rather than
        /// shortening the list silently.</para>
        /// </summary>
        IReadOnlyList<AgxGroup>? AssignedGroups();

        /// <summary>Sets one group by AGExt's own 1-based index. Returns AGExt's own success bool.</summary>
        bool Activate(int index, bool on);
    }

    /// <summary>
    /// One AGX-assigned group: AGExt's own index, its player-given name (or
    /// null if unnamed), and its current on/off state.
    /// </summary>
    public readonly struct AgxGroup
    {
        public int Index { get; }
        public string? Name { get; }

        /// <summary>
        /// The group's current state, or null when AGExt reported the group
        /// but its state could not be read. Null is carried to
        /// <c>Sitrep.Contract.ActionGroupState.State</c> unchanged, where the
        /// client draws the absent token and disables the toggle rather than
        /// showing a group as disengaged that nobody read.
        /// </summary>
        public bool? State { get; }

        public AgxGroup(int index, string? name, bool? state)
        {
            Index = index;
            Name = name;
            State = state;
        }
    }
}
