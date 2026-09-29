namespace Gonogo.MechJebUplink
{
    /// <summary>
    /// The three <c>mechjeb.*</c> command topic string constants, in one
    /// place (mirrors <c>GonogoKosUplink</c>'s <c>KosChannels.cs</c>). This
    /// Uplink is command-only, see <c>MechJebUplink.cs</c>'s class doc
    /// comment, so there are no channel topics to declare here, only the core
    /// one its commands name as their Subject.
    /// </summary>
    public static class MechJebChannels
    {
        /// <summary>Engage the ascent autopilot to a target altitude (<see cref="MechJebAscentArgs"/>).</summary>
        public const string EngageAscentAutopilotCommand = "mechjeb.engageAscentAutopilot";

        /// <summary>Execute the next maneuver node (<see cref="MechJebNoArgs"/>).</summary>
        public const string ExecuteNextNodeCommand = "mechjeb.executeNextNode";

        /// <summary>Autopilot land at the selected target (<see cref="MechJebNoArgs"/>).</summary>
        public const string LandAtTargetCommand = "mechjeb.landAtTarget";

        /// <summary>
        /// The Subject of all three commands: core's <c>vessel.control</c>, the
        /// active craft's control state an autopilot takes over. This Uplink
        /// publishes no channel of its own, so its orders route through core's,
        /// the same Subject core's own SAS and throttle commands name. A literal
        /// because this Uplink cannot reference the core provider that declares it.
        /// </summary>
        public const string ControlSubject = "vessel.control";
    }
}
