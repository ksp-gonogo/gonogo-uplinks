using System;
using System.Collections;
using System.Reflection;

namespace Gonogo.KerbalismUplink
{
    /// <summary>
    /// Whether Kerbalism has finished setting itself up for the loaded game, so
    /// its API can be asked. Used by <see cref="KerbalismReflection"/> to hold
    /// every call back until it has.
    ///
    /// <para>Kerbalism does its setup in its scenario's <c>OnLoad</c>, which the
    /// game runs some frames into a scene, after the first telemetry sample of a
    /// process. Until then its list of suns is empty, and
    /// <c>Lib.GetParentPlanet</c> walks <c>referenceBody</c> until it meets a
    /// sun: the Sun is its own reference body, so with no suns listed the walk
    /// never ends and the game freezes. <c>API.StormIncoming</c> and
    /// <c>API.StormInProgress</c> reach that walk for any vessel not orbiting
    /// the Sun.</para>
    ///
    /// <para>A Kerbalism build that does not carry the members read here cannot
    /// say whether it is set up, so it is asked only once the scene stands.</para>
    /// </summary>
    public sealed class KerbalismReadiness
    {
        private const BindingFlags AnyStatic = BindingFlags.Public | BindingFlags.NonPublic | BindingFlags.Static;

        private readonly Func<bool>? _coreInitDone;
        private readonly Func<bool>? _saveInitDone;
        private readonly FieldInfo? _suns;
        private readonly Func<bool> _sceneStands;
        private volatile bool _sunsListed;

        /// <param name="kerbalism">Kerbalism's scenario type, <c>KERBALISM.Kerbalism</c>, or null when the build has none.</param>
        /// <param name="sim">Kerbalism's <c>KERBALISM.Sim</c> type, or null when the build has none.</param>
        /// <param name="sceneStands">Whether the scene has finished loading, asked only when Kerbalism cannot say it is set up.</param>
        public KerbalismReadiness(Type? kerbalism, Type? sim, Func<bool> sceneStands)
        {
            _coreInitDone = StaticBool(kerbalism, "IsCoreGameInitDone");
            _saveInitDone = StaticBool(kerbalism, "IsSaveGameInitDone");
            _suns = sim?.GetField("suns", AnyStatic);
            _sceneStands = sceneStands;
        }

        /// <summary>True once Kerbalism can be asked. Never throws.</summary>
        public bool IsReady
        {
            get
            {
                try
                {
                    if (_coreInitDone == null || _saveInitDone == null || _suns == null)
                    {
                        return _sceneStands();
                    }
                    return _coreInitDone() && _saveInitDone() && SunsListed();
                }
                catch
                {
                    return false;
                }
            }
        }

        /// <summary>
        /// <paramref name="bound"/> when there is one and Kerbalism can be asked,
        /// <paramref name="none"/> otherwise.
        /// </summary>
        public static T Usable<T>(T? bound, KerbalismReadiness? readiness, T none)
            where T : class =>
            bound != null && (readiness == null || readiness.IsReady) ? bound : none;

        private bool SunsListed()
        {
            /* Kerbalism only ever adds to the list, so one non-empty reading holds for the rest of the process. */
            if (_sunsListed)
            {
                return true;
            }
            if (_suns!.GetValue(null) is ICollection suns && suns.Count > 0)
            {
                _sunsListed = true;
                return true;
            }
            return false;
        }

        private static Func<bool>? StaticBool(Type? type, string name)
        {
            var getter = type?.GetProperty(name, AnyStatic)?.GetGetMethod(nonPublic: true);
            if (getter == null || getter.ReturnType != typeof(bool))
            {
                return null;
            }
            return (Func<bool>)Delegate.CreateDelegate(typeof(Func<bool>), getter);
        }
    }
}
