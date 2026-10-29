// GonogoKosUplink: GPLv3. See GonogoKosUplink.csproj's header comment for the
// licence/linkage rationale.

namespace Gonogo.KosUplink
{
    /// <summary>
    /// Decides on which processor passes the CPU list is republished as a
    /// keyframe: the passes right after the active vessel changes.
    ///
    /// <para>The host withdraws every recorded delayed topic of the active
    /// craft when the active vessel changes, and an unchanged list would then
    /// stay withdrawn until its next periodic keyframe. Forcing a keyframe
    /// brings it back at once. The force is held for two passes because the
    /// withdrawal and the first pass after the change can land in the same
    /// tick, with the withdrawal recorded last.</para>
    ///
    /// <para>KSP-free by construction, so it is exercised headlessly.</para>
    /// </summary>
    public sealed class KosSwitchKeyframe
    {
        private const int PassesHeld = 2;

        private bool _seen;
        private string? _activeVesselId;
        private int _remaining;

        /// <summary>
        /// Records the active vessel seen by one pass. Returns true when this
        /// pass's publish should be a forced keyframe. The first vessel ever
        /// seen is not a change.
        /// </summary>
        public bool Observe(string? activeVesselId)
        {
            if (!_seen)
            {
                _seen = true;
                _activeVesselId = activeVesselId;
                return false;
            }
            if (activeVesselId != _activeVesselId)
            {
                _activeVesselId = activeVesselId;
                _remaining = PassesHeld;
            }
            if (_remaining == 0)
            {
                return false;
            }
            _remaining--;
            return true;
        }
    }
}
