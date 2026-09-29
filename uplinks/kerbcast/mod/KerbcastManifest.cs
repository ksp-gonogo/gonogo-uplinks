using System.Collections.Generic;
using Sitrep.Contract;

namespace Gonogo.KerbcastUplink
{
    /// <summary>
    /// What <c>KerbcastUplink</c> declares, kept apart from it because
    /// the Uplink itself touches live KSP types and so cannot compile in the
    /// headless Tests project, and the declarations are worth checking there.
    /// </summary>
    public static class KerbcastManifest
    {
        public const string AvailableTopic = "kerbcast.available";
        public const string CamerasTopic = "kerbcast.cameras";
        public const string SetFieldOfViewCommand = "kerbcast.setFieldOfView";
        public const string SetPanCommand = "kerbcast.setPan";

        public static UplinkManifest Build() => new UplinkManifest
        {
            Id = "kerbcast",
            Version = "1.0.0",
            Channels = new List<ChannelDeclaration>
            {
                // Whether the kerbcast mod is installed at all, a GROUND-side
                // fact about the INSTALL, not vessel telemetry, so TrueNow:
                // the same disposition every other mod-presence and uplink-health
                // channel carries. This is the presence gate a client augment
                // declares `requires: "kerbcast"` against.
                new ChannelDeclaration
                {
                    Topic = AvailableTopic,
                    Delivery = Delivery.LossyLatest,
                    Emission = new EmissionPolicy(keyframeIntervalUt: 30, quantum: EmissionQuantum.Absolute(0)),
                    Delay = DelayRole.TrueNow,
                },
                // The camera inventory IS vessel telemetry, an observation of
                // hardware on the craft, learned over the comms link, so it is
                // Delayed like any other vessel channel. This is also what keeps
                // the control plane honest against the WebRTC video: the feed is
                // played out through the same delay authority, so the camera list
                // and the picture it describes reveal together rather than the
                // list racing ahead of the image.
                new ChannelDeclaration
                {
                    Topic = CamerasTopic,
                    Delivery = Delivery.LossyLatest,
                    Emission = new EmissionPolicy(keyframeIntervalUt: 30, quantum: EmissionQuantum.Absolute(0)),
                    Delay = DelayRole.Delayed,
                },
            },
            Commands = new List<CommandDeclaration>
            {
                // Delay disposition lives on each args class's own
                // [SitrepCommand] tag in KerbcastPayloads.cs (default
                // DelayRole.Delayed: aiming or zooming a camera is an
                // instruction to hardware on the craft, so it rides the
                // signal-delay Courier exactly like a staging or SAS
                // command). Restating it here is banned by
                // styleguide-command-delay-single-source.test.ts.
                //
                // Each names kerbcast.cameras as its Subject: the camera it
                // aims is one that channel lists, so the order rides the same
                // craft's light-time the inventory does.
                new CommandDeclaration { Command = SetFieldOfViewCommand, Subject = CamerasTopic },
                new CommandDeclaration { Command = SetPanCommand, Subject = CamerasTopic },
            },
        };
    }
}
