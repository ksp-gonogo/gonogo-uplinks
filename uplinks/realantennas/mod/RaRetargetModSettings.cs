using System;
using System.Collections.Generic;
using Sitrep.Contract;

namespace Gonogo.RealAntennasUplink
{
    /// <summary>
    /// The save-wide automatic retargeting choice as a mod setting Gonogo can
    /// read and set. It lives in <see cref="RaRetargetRegister"/>, so it is saved
    /// with the game and every command centre sees a change at once.
    ///
    /// <para>KSP-free: turning it off hands the crafts it now stops to a callback,
    /// so every branch can be checked without a game.</para>
    /// </summary>
    internal sealed class RaRetargetModSettings : IModSettingsSource, IModSettingsWriter
    {
        public const string AutoRetargetId = "autoRetarget";

        private static readonly IReadOnlyList<ModSetting> Listed = new[]
        {
            ModSetting.Bool(
                AutoRetargetId,
                "Automatic retargeting",
                ModSettingRefresh.Live,
                description: "A craft with its own Automatic retargeting switch keeps it. Every other craft follows this",
                writable: true),
        };

        private readonly RaRetargetRegister _register;
        private readonly Action _onTurnedOff;

        /// <param name="register">Holds the choice for the loaded save.</param>
        /// <param name="onTurnedOff">Called after the choice goes from on to off, to put back any dish a craft it now stops has on loan.</param>
        public RaRetargetModSettings(RaRetargetRegister register, Action onTurnedOff)
        {
            _register = register ?? throw new ArgumentNullException(nameof(register));
            _onTurnedOff = onTurnedOff ?? throw new ArgumentNullException(nameof(onTurnedOff));
        }

        public IReadOnlyList<ModSetting> ListModSettings() => Listed;

        public ModSettingValue ReadModSetting(string id) =>
            id == AutoRetargetId
                ? ModSettingValue.Of(_register.AllowedByDefault)
                : ModSettingValue.Unavailable("not a RealAntennas setting");

        public CommandResult WriteModSetting(string id, ModSettingValue value)
        {
            if (id != AutoRetargetId || value.Kind != SettingKind.Bool)
            {
                return CommandResult.Fail(CommandErrorCode.NotFound);
            }

            var was = _register.AllowedByDefault;
            _register.AllowedByDefault = value.AsBool;
            if (was && !value.AsBool)
            {
                _onTurnedOff();
            }

            return CommandResult.Ok();
        }
    }
}
