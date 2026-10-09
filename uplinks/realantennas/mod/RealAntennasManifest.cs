using System.Collections.Generic;
using Sitrep.Contract;

namespace Gonogo.RealAntennasUplink
{
    /// <summary>
    /// What <c>RealAntennasUplink</c> declares, kept apart from it because the
    /// Uplink itself reaches CommNet and so cannot compile in the headless Tests
    /// project, and the declarations are worth checking there.
    /// </summary>
    public static class RealAntennasManifest
    {
        public const string LinkQualityTopic = "comms.linkQuality";
        public const string DataRateTopic = "comms.dataRate";
        public const string LinkMarginTopic = "comms.linkMargin";

        /// <summary>
        /// The per-hop forward-rate annotation channel: a bare ARRAY of
        /// <see cref="RealAntennasHopRate"/>, one per hop that has a readable rate,
        /// keyed by the same node ids <c>comms.path</c> carries. RA's relay graph
        /// subclasses stock CommNet's, so this only embellishes each existing hop
        /// with its bitrate: it never republishes the topology. The client joins it
        /// onto the route the core CommSignal schedule already renders.
        /// </summary>
        public const string HopRatesTopic = "realantennas.hopRates";

        /// <summary>
        /// The Domain presence gate: a bare-boolean TrueNow channel emitting
        /// <c>true</c> whenever RealAntennas is loaded. The RA client augments bind
        /// this via <c>requires: "realantennas"</c>, so its detail composes into
        /// CommSignal only on an install that actually runs RA.
        /// </summary>
        public const string AvailableTopic = "realantennas.available";

        /// <summary>
        /// The per-antenna targeting channel: a bare ARRAY of
        /// <see cref="RealAntennasAntennaState"/>, one entry per antenna on the
        /// scoped craft, carrying what each antenna is, what modes its tech level
        /// has earned, and where it is currently pointed.
        ///
        /// <para>Per-ANTENNA because that is the granularity RealAntennas stores:
        /// there is no vessel-level target and no primary antenna, and the link
        /// solver considers every compatible antenna pair, so two dishes aimed
        /// two ways are two candidate links rather than a conflict to resolve.</para>
        ///
        /// <para>DELAYED: this describes the craft, and the two commands that
        /// write to it are delayed too.</para>
        /// </summary>
        public const string AntennasTopic = "realantennas.antennas";

        /// <summary>
        /// The per-antenna fallback-chain channel: a bare ARRAY of
        /// <see cref="RealAntennasAntennaChain"/>, one entry per antenna of the
        /// scoped craft that is holding a chain, carrying the list, which entry is
        /// in place, and why.
        ///
        /// <para>DELAYED, like the antenna channel beside it and for the same
        /// reason: this is state held on the craft, and the walk that changes it
        /// happens there rather than here.</para>
        ///
        /// <para>Scoped to the reported craft even though the walk covers every
        /// craft in the game, because a delayed channel is delayed by the reported
        /// vessel's own light-time and cannot carry another craft's state at the
        /// right age.</para>
        ///
        /// <para><b>Two segments, not three, and that is not a style choice.</b>
        /// The SDK splits a dotted read at the longest topic id it knows
        /// STATICALLY, and it deliberately does not consult the registry an
        /// Uplink self-registers into, because a split that changed answer when a
        /// bundle loaded would resolve one subscription differently from the
        /// next. So a three-segment Uplink topic resolves to its first two
        /// segments plus a field path: this channel was spelled with a third
        /// segment first, and was read as a field of a two-segment channel
        /// nothing publishes, so both the read and the subscription came back
        /// empty forever. Every channel here is two segments for that reason;
        /// the COMMANDS beside them are free to be three, and are.</para>
        /// </summary>
        public const string ChainsTopic = "realantennas.antennaChains";

        /// <summary>
        /// The state of dish turning for every craft that has any: a bare ARRAY of
        /// <see cref="RealAntennasVesselRetargeting"/>, one entry per craft that is
        /// opted out, has a dish on loan, or has had one. Two segments, as every
        /// channel here is (see <see cref="ChainsTopic"/>).
        /// </summary>
        public const string RetargetingTopic = "realantennas.retargeting";

        /// <summary>
        /// Allow or forbid a craft turning an idle dish on its own to carry a message.
        /// Args: <see cref="RealAntennasSetAutoRetargetArgs"/>. Addressed to the craft
        /// by id and delayed to that craft, whichever craft is reported.
        /// </summary>
        public const string SetAutoRetargetCommand = "realantennas.vessel.setAutoRetarget";

        /// <summary>Point one antenna at one thing. Args: <see cref="RealAntennasTargetArgs"/>.</summary>
        public const string TargetCommand = "realantennas.antenna.target";

        /// <summary>
        /// Point one antenna at the home BODY'S CENTRE, RealAntennas' own default
        /// aim point. See <c>RaTargeting.TargetHome</c> for what that does
        /// and does not mean. Args: <see cref="RealAntennasAntennaArgs"/>.
        /// </summary>
        public const string TargetHomeCommand = "realantennas.antenna.targetHome";

        /// <summary>
        /// Hand one antenna an ordered list of targets, tried in order whenever
        /// the craft has no link. Args:
        /// <see cref="RealAntennasTargetChainArgs"/>.
        ///
        /// <para>Delayed like the two single-target commands, and that is the
        /// whole point of it: the chain rides light-time ONCE, and the craft then
        /// walks it with no delay at all. A ground-side evaluator watching
        /// connectivity and sending a fresh target could not act at the moment it
        /// was needed, because its command would have nowhere to arrive.</para>
        /// </summary>
        public const string TargetChainCommand = "realantennas.antenna.targetChain";

        /// <summary>
        /// A fact about the install rather than about any craft, known on the
        /// ground the moment it is true. Only the presence gate is one.
        /// </summary>
        private static ChannelDeclaration TrueNow(string topic) => new ChannelDeclaration
        {
            Requires = Requirement.None,
            Topic = topic,
            Delivery = Delivery.LossyLatest,
            Delay = DelayRole.TrueNow,
            Emission = new EmissionPolicy(keyframeIntervalUt: 30, quantum: EmissionQuantum.Absolute(0)),
        };

        /// <summary>
        /// A reading of the active craft or of its link: a command centre learns
        /// it one light-time after it was so. The link's margin, quality, rate
        /// and per-hop rates are readings of the far end of the link as much as
        /// the antennas are, so every one of them waits for the light.
        /// </summary>
        private static ChannelDeclaration Delayed(string topic) => new ChannelDeclaration
        {
            Requires = Requirement.None,
            Topic = topic,
            Delivery = Delivery.LossyLatest,
            Delay = DelayRole.Delayed,
            Emission = new EmissionPolicy(keyframeIntervalUt: 30, quantum: EmissionQuantum.Absolute(0)),
        };

        public static UplinkManifest Build() => new UplinkManifest
        {
            Id = "realantennas",
            Version = "1.0.0",
            // Null when the generated const is empty so the loader degrades to the
            // two-way check; a real sha256-... once the release build bakes it.
            Name = Provenance.Name,
            Author = Provenance.Author,
            Repo = Provenance.Repo,
            ExpectedClientHash = string.IsNullOrEmpty(ExpectedClientHash.Value) ? null : ExpectedClientHash.Value,
            // DevPath is null unless a dev build supplied one: the loader prefers it,
            // so a released DLL carrying one points every user at another machine.
            ClientSource = new UplinkClientSource
            {
                Url = ClientSource.Url,
                DevPath = string.IsNullOrEmpty(ClientSource.DevPath) ? null : ClientSource.DevPath,
            },
            Channels = new List<ChannelDeclaration>
            {
                TrueNow(AvailableTopic),
                Delayed(LinkQualityTopic),
                Delayed(DataRateTopic),
                Delayed(LinkMarginTopic),
                Delayed(HopRatesTopic),
                Delayed(AntennasTopic),
                Delayed(ChainsTopic),
                Delayed(RetargetingTopic),
            },
            Commands = new List<CommandDeclaration>
            {
                // Both Delayed: slewing a dish is a signal to the craft, the same
                // classification every other vessel-actuation command carries.
                // That is also why the channel beside them is delayed, and why an
                // antenna is addressed by a stable id rather than by its position
                // in a list that can change while the command is in flight.
                // Their Subject is the antenna channel they write to, so the
                // order rides the reported craft's light-time.
                new CommandDeclaration { Command = TargetCommand, Subject = AntennasTopic },
                new CommandDeclaration { Command = TargetHomeCommand, Subject = AntennasTopic },
                // Delayed for the same reason, and it is the one command here
                // whose whole value comes from arriving before it is needed: it
                // leaves the craft able to re-aim itself with no delay at all,
                // which is the only way a fallback can act while the link is
                // down.
                // Its Subject is the chain channel, for the same reason.
                new CommandDeclaration { Command = TargetChainCommand, Subject = ChainsTopic },
                // Delayed to the craft it names, not to the reported one: the Subject
                // is that craft's own node, which the "fleet." namespace core registers
                // resolves for any craft, one on rails included.
                new CommandDeclaration { Command = SetAutoRetargetCommand, Subject = "fleet.{args.Vessel}.retargeting" },
            },
        };
    }
}
