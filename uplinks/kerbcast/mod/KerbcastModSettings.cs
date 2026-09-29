using System;
using System.Collections.Generic;
using Sitrep.Contract;

namespace Gonogo.KerbcastUplink
{
    /// <summary>
    /// Kerbcast's main-render throttle as a mod setting Gonogo can read and set.
    /// Kerbcast keeps it in the save's difficulty settings and applies a change
    /// within a frame, so the value read here is the one in force.
    ///
    /// <para>KSP-free: the save's settings node arrives through the readers
    /// handed in, so every branch can be checked without Kerbcast or a save.</para>
    /// </summary>
    public sealed class KerbcastModSettings : IModSettingsSource, IModSettingsWriter
    {
        public const string ThrottleId = "throttleMainRender";

        private static readonly IReadOnlyList<ModSetting> Listed = new[]
        {
            ModSetting.Bool(ThrottleId, "Throttle KSP main render", ModSettingRefresh.Live,
                description: "The main flight cameras stop rendering, leaving GPU headroom for Kerbcast streams",
                setIn: "Difficulty settings, Kerbcast",
                writable: true),
        };

        private readonly Func<string?> _unavailable;
        private readonly Func<bool?> _read;
        private readonly Func<bool, bool> _write;

        /// <param name="unavailable">Why the throttle cannot be reached right now, or null when it can.</param>
        /// <param name="read">The throttle the loaded save holds, or null when it could not be read.</param>
        /// <param name="write">Sets the loaded save's throttle; false when it could not be written.</param>
        public KerbcastModSettings(Func<string?> unavailable, Func<bool?> read, Func<bool, bool> write)
        {
            _unavailable = unavailable;
            _read = read;
            _write = write;
        }

        public IReadOnlyList<ModSetting> ListModSettings() => Listed;

        public ModSettingValue ReadModSetting(string id)
        {
            if (id != ThrottleId)
            {
                return ModSettingValue.Unavailable("not a Kerbcast setting");
            }

            var unavailable = _unavailable();
            if (unavailable != null)
            {
                return ModSettingValue.Unavailable(unavailable);
            }

            var on = _read();
            return on.HasValue
                ? ModSettingValue.Of(on.Value)
                : ModSettingValue.Unavailable("Kerbcast's throttle could not be read");
        }

        public CommandResult WriteModSetting(string id, ModSettingValue value)
        {
            if (id != ThrottleId || value.Kind != SettingKind.Bool)
            {
                return CommandResult.Fail(CommandErrorCode.NotFound);
            }

            var unavailable = _unavailable();
            if (unavailable != null)
            {
                return CommandResult.Fail(CommandErrorCode.ModeUnavailable, unavailable);
            }

            return _write(value.AsBool)
                ? CommandResult.Ok()
                : CommandResult.Fail(CommandErrorCode.ModeUnavailable, "Kerbcast's throttle could not be set");
        }
    }
}
