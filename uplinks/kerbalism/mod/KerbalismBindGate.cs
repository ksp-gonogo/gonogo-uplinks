using System;
using System.Reflection;

namespace Gonogo.KerbalismUplink
{
    /// <summary>
    /// Builds a set of reflection handles against the Kerbalism assembly once it
    /// is found, and publishes the finished set through one volatile reference,
    /// so a reader on any thread sees either no handles or all of them. A build
    /// that throws publishes nothing and leaves the locator's retry interval in
    /// force, so a Kerbalism that cannot be bound is retried every few seconds
    /// rather than on every call. Used by <see cref="KerbalismReflection"/>.
    /// </summary>
    public sealed class KerbalismBindGate<T> where T : class
    {
        private readonly KerbalismAssemblyLocator _locator;
        private readonly Func<Assembly, T> _build;
        private readonly object _lock = new();
        private volatile T? _published;

        public KerbalismBindGate(KerbalismAssemblyLocator locator, Func<Assembly, T> build)
        {
            _locator = locator;
            _build = build;
        }

        /// <summary>The published handle set, or null when none is bound yet. Never probes or builds.</summary>
        public T? Peek => _published;

        /// <summary>
        /// The published handle set, probing for the assembly and building the set
        /// when none is bound yet. Null while Kerbalism is absent, inside the
        /// retry interval, or after a failed build.
        /// </summary>
        public T? Resolve()
        {
            var published = _published;
            if (published != null) return published;
            lock (_lock)
            {
                if (_published != null) return _published;
                var found = _locator.Probe();
                if (found == null) return null;
                try { _published = _build(found); }
                catch { _locator.Forget(); }
                return _published;
            }
        }
    }
}
