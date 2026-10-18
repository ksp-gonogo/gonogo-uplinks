using System;
using Sitrep.Contract;

namespace Gonogo.KerbcastUplink
{
    /// <summary>
    /// The Gonogo setting that has Kerbcast's camera feeds listen wherever
    /// Gonogo's own stream does, so any device the Gonogo app reaches KSP from
    /// can open them. Offered among the first-run setup's recommended settings.
    ///
    /// <para>Kerbcast's settings file is the authority. At start-up the setting
    /// is read from it and nothing is written, so an address set by hand stays
    /// as it is until the player changes this setting.</para>
    /// </summary>
    public sealed class KerbcastFollowGonogoSetting
    {
        public const string Name = "feedsFollowGonogo";

        public const string Label = "Serve camera feeds wherever Gonogo is reachable";

        public const string Description =
            "Kerbcast listens on every address of this computer, as Gonogo does, so Gonogo on another device "
            + "can show the camera feeds. Off, only this computer can. Turning it on replaces an address you set by hand "
            + "in Kerbcast's settings. Anyone on your network who can reach this computer can watch the feeds: "
            + "Kerbcast has no sign-in. Takes effect at the first flight after KSP starts; if you have flown since, restart KSP.";

        private readonly KerbcastBindAddress _address;
        private readonly Action<string> _warn;

        /// <param name="address">Kerbcast's bind address, read and written through its settings files.</param>
        /// <param name="warn">Where a failed read or write is reported.</param>
        public KerbcastFollowGonogoSetting(KerbcastBindAddress address, Action<string> warn)
        {
            _address = address;
            _warn = warn;
        }

        /// <summary>Declares the row, takes its value from Kerbcast's settings, and writes them on every later change.</summary>
        public void Declare(IUplinkSettings settings)
        {
            settings.Declare(UplinkSettingRow.Bool(Name, false, Label, Description).Tagged(SettingTags.Setup));

            var follows = _address.FollowsGonogo();
            if (follows == null)
            {
                _warn("Kerbcast's settings could not be read, so whether its camera feeds follow Gonogo is unknown");
            }
            else if (follows.Value != (bool.TryParse(settings.Stored(Name), out var stored) && stored))
            {
                settings.Migrate(Name, follows.Value ? "True" : "False");
            }

            // Runs once as Declare returns, when the value already matches the file and Apply writes nothing.
            settings.OnChanged(changed =>
            {
                var outcome = _address.Apply(changed.Bool(Name));
                if (!string.IsNullOrEmpty(outcome))
                {
                    _warn("Kerbcast's bind address could not be written: " + outcome);
                }
            });
        }
    }
}
