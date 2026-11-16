using System;
using System.Collections;
using System.Diagnostics;
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
    ///
    /// <para>The game only creates that scenario in sandbox, science, career and
    /// mission games. In any other game, such as one of its built-in scenarios
    /// or tutorials, the scenario never loads, so Kerbalism is never set up and
    /// whatever it holds from a game loaded earlier belongs to that game: see
    /// <see cref="IsMissingFromGame"/>.</para>
    /// </summary>
    public sealed class KerbalismReadiness
    {
        private const BindingFlags AnyStatic = BindingFlags.Public | BindingFlags.NonPublic | BindingFlags.Static;

        private readonly Func<bool>? _coreInitDone;
        private readonly Func<bool>? _saveInitDone;
        private readonly FieldInfo? _suns;
        private readonly Func<bool> _sceneStands;
        private readonly Func<bool> _scenarioMissing;
        private readonly Func<bool> _sceneRunsKerbalism;
        private readonly Func<double> _seconds;
        private readonly object _stallLock = new();
        private double? _standingSince;
        private volatile bool _sunsListed;

        /// <summary>How many seconds a scene Kerbalism runs in may stand before Kerbalism is called stalled.</summary>
        public const double StallLimitSeconds = 30;

        private static readonly Stopwatch Clock = Stopwatch.StartNew();

        /// <param name="kerbalism">Kerbalism's scenario type, <c>KERBALISM.Kerbalism</c>, or null when the build has none.</param>
        /// <param name="sim">Kerbalism's <c>KERBALISM.Sim</c> type, or null when the build has none.</param>
        /// <param name="sceneStands">Whether the scene has finished loading.</param>
        /// <param name="scenarioMissing">Whether a game is loaded, in a scene Kerbalism runs in, that does not hold Kerbalism's scenario. Null when that cannot be told, which reads as never missing.</param>
        /// <param name="sceneRunsKerbalism">Whether the current scene is one Kerbalism's scenario runs in (flight, space centre, tracking station, editor). Null reads as always.</param>
        /// <param name="seconds">A monotonic clock in seconds. Null uses the process clock.</param>
        public KerbalismReadiness(
            Type? kerbalism,
            Type? sim,
            Func<bool> sceneStands,
            Func<bool>? scenarioMissing = null,
            Func<bool>? sceneRunsKerbalism = null,
            Func<double>? seconds = null)
        {
            _coreInitDone = StaticBool(kerbalism, "IsCoreGameInitDone");
            _saveInitDone = StaticBool(kerbalism, "IsSaveGameInitDone");
            _suns = sim?.GetField("suns", AnyStatic);
            _sceneStands = sceneStands;
            _scenarioMissing = scenarioMissing ?? (() => false);
            _sceneRunsKerbalism = sceneRunsKerbalism ?? (() => true);
            _seconds = seconds ?? (() => Clock.Elapsed.TotalSeconds);
        }

        /// <summary>
        /// True once a scene Kerbalism runs in has stood for
        /// <see cref="StallLimitSeconds"/> without Kerbalism setting itself up, in
        /// a game that holds its scenario. The count starts the first time this is
        /// asked while the scene stands and restarts if the scene stops standing
        /// or Kerbalism becomes ready, so a Kerbalism that finishes late reads as
        /// not stalled again. Never throws.
        /// </summary>
        public bool IsStalled
        {
            get
            {
                try
                {
                    var counting = _sceneStands() && _sceneRunsKerbalism() && !_scenarioMissing() && !IsReady;
                    lock (_stallLock)
                    {
                        if (!counting)
                        {
                            _standingSince = null;
                            return false;
                        }
                        var now = _seconds();
                        _standingSince ??= now;
                        return now - _standingSince.Value >= StallLimitSeconds;
                    }
                }
                catch
                {
                    return false;
                }
            }
        }

        /// <summary>
        /// True once the scene has finished loading in a game that does not hold
        /// Kerbalism's scenario, so Kerbalism will not set itself up however long
        /// it is waited for. Never throws.
        /// </summary>
        public bool IsMissingFromGame
        {
            get
            {
                try
                {
                    return _sceneStands() && _scenarioMissing();
                }
                catch
                {
                    return false;
                }
            }
        }

        /// <summary>True once Kerbalism can be asked. Never throws.</summary>
        public bool IsReady
        {
            get
            {
                try
                {
                    if (IsMissingFromGame)
                    {
                        return false;
                    }
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
