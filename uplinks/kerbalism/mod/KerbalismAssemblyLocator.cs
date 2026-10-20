using System;
using System.Collections.Generic;
using System.Diagnostics;
using System.Reflection;

namespace Gonogo.KerbalismUplink
{
    /// <summary>
    /// Finds the loaded Kerbalism assembly by name, and keeps looking until it
    /// appears. A plain Kerbalism.dll is loaded before any plugin starts, but a
    /// Kerbalism that loads through a bootstrap hands its real assembly to the
    /// AppDomain seconds after this plugin is constructed, so a single probe at
    /// construction misses it. Used by <see cref="KerbalismReflection"/>.
    /// </summary>
    public sealed class KerbalismAssemblyLocator
    {
        private readonly Func<IEnumerable<Assembly>> _assemblies;
        private readonly Func<long> _nowMs;
        private readonly long _retryIntervalMs;
        private static readonly Stopwatch Clock = Stopwatch.StartNew();
        private long _nextProbeMs;

        public KerbalismAssemblyLocator(
            Func<IEnumerable<Assembly>> assemblies,
            Func<long>? nowMs = null,
            long retryIntervalMs = 2000)
        {
            _assemblies = assemblies;
            _nowMs = nowMs ?? (Func<long>)(() => Clock.ElapsedMilliseconds);
            _retryIntervalMs = retryIntervalMs;
        }

        /// <summary>The Kerbalism assembly once found, otherwise null.</summary>
        public Assembly? Found { get; private set; }

        /// <summary>
        /// Looks for the assembly if it has not been found yet, at most once per
        /// retry interval so a caller on a hot path pays for one scan every few
        /// seconds while Kerbalism is absent. A source that throws counts as not found.
        /// </summary>
        public Assembly? Probe()
        {
            if (Found != null) return Found;
            var now = _nowMs();
            if (now < _nextProbeMs) return null;
            _nextProbeMs = now + _retryIntervalMs;
            try
            {
                foreach (var a in _assemblies())
                {
                    if (string.Equals(a.GetName().Name, "Kerbalism", StringComparison.OrdinalIgnoreCase))
                    {
                        Found = a;
                        break;
                    }
                }
            }
            catch
            {
                // an AppDomain enumeration that fails mid-load is retried on the next probe
            }
            return Found;
        }
    }
}
