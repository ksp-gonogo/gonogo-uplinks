using System;
using System.Collections.Generic;
using GonogoKerbalismUplink;

namespace Gonogo.KerbalismUplink
{
    /// <summary>
    /// Starts or stops a Kerbalism-driven SCANsat scanner through whichever
    /// members of Kerbalism's SCANsat bridge the installed build has. KSP-free:
    /// the live half resolves the members and hands them in as delegates, so the
    /// decision is tested for each API shape without a vessel.
    ///
    /// <para>Start and stop are the only members a switch cannot do without.
    /// Reading the scanning state and locating the scanner each have a fallback,
    /// so a build lacking either still switches.</para>
    /// </summary>
    public static class KerbalismScannerSwitch
    {
        public const string NoSwitchBridge =
            "this Kerbalism build has no scanner start or stop, so its scanners cannot be switched";

        public const string NoScannerModule =
            "this part has no SCANsat scanner module for Kerbalism's scanner to drive";

        /// <param name="locate">The SCANsat module on the part, or null when it has none</param>
        /// <param name="start">Kerbalism's start, or null when the build has none</param>
        /// <param name="stop">Kerbalism's stop, or null when the build has none</param>
        /// <param name="isScanning">Whether the scanner module is scanning, or null when that cannot be read</param>
        public static RunSwitchRaw Run(
            Func<object?> locate,
            Action<object>? start,
            Action<object>? stop,
            Func<object, bool?> isScanning,
            bool run)
        {
            var switchTo = run ? start : stop;
            if (switchTo == null) return new RunSwitchRaw { Outcome = RunSwitchOutcome.Unavailable, Reason = NoSwitchBridge };

            try
            {
                var scanner = locate();
                if (scanner == null) return new RunSwitchRaw { Outcome = RunSwitchOutcome.Unavailable, Reason = NoScannerModule };

                var before = isScanning(scanner);
                if (before == run) return new RunSwitchRaw { Outcome = RunSwitchOutcome.AlreadyThere, Running = run };

                switchTo(scanner);

                var after = isScanning(scanner);
                if (after == null) return new RunSwitchRaw { Outcome = RunSwitchOutcome.Switched, Running = run };
                return new RunSwitchRaw
                {
                    Outcome = after == run ? RunSwitchOutcome.Switched : RunSwitchOutcome.NotSwitched,
                    Running = after.Value,
                };
            }
            catch
            {
                return new RunSwitchRaw { Outcome = RunSwitchOutcome.NotSwitched };
            }
        }

        /// <summary>
        /// The scanner module among a part's modules, the way Kerbalism's own
        /// scanner module picks it: a SCANsat scanner module, preferring the one
        /// whose sensor type matches when a part carries several.
        /// </summary>
        public static T? Choose<T>(IEnumerable<T> modules, Func<T, string?> moduleName, Func<T, int?> sensorType, int wantedSensorType)
            where T : class
        {
            T? first = null;
            foreach (var module in modules)
            {
                var name = moduleName(module);
                if (name != "SCANsat" && name != "ModuleSCANresourceScanner") continue;
                if (sensorType(module) == wantedSensorType) return module;
                first ??= module;
            }
            return first;
        }
    }
}
