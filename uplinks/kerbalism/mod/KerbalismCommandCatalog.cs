using System.Collections.Generic;
using Sitrep.Contract;

namespace Gonogo.KerbalismUplink
{
    /// <summary>
    /// The commands the Kerbalism Uplink declares in its manifest. The list does
    /// not depend on whether Kerbalism has loaded: the host reads the manifest
    /// once, before Kerbalism may have appeared, and takes handlers only during
    /// registration, so a command declared late would never exist. A handler
    /// refuses with a typed code while Kerbalism is not modelling the thing it acts on.
    /// </summary>
    internal static class KerbalismCommandCatalog
    {
        /// <summary>
        /// Repair or service one part with one named kerbal, in a single command:
        /// the crew check, the kit fetch and the repair are resolved aboard, since
        /// each as its own command would cost a round trip.
        /// </summary>
        internal const string RepairCommand = "kerbalism.repair";

        internal const string ReliabilityPartsTopic = "kerbalism.reliabilityParts";

        internal const string DiagnosticsTopic = "kerbalism.diagnostics";

        /// <summary>
        /// The <c>science.experiments</c> channel topic every File Manager
        /// command's Subject resolves its node through: each command acts on a
        /// file/sample aboard the craft, the same craft that channel reads.
        /// Declared as a literal rather than referencing
        /// <c>Sitrep.Host.ScienceViewProvider.ExperimentsTopic</c>, which this
        /// Uplink cannot reference under the isolation rule.
        /// </summary>
        internal const string ScienceExperimentsSubject = "science.experiments";

        /// <summary>
        /// The five File Manager commands and the repair: every one actuates
        /// Kerbalism state on the vessel (flag a file, delete it, flag/dump a
        /// sample, move a sample to another drive, repair a part), so all ride
        /// the same signal delay every other vessel actuation does. Declared
        /// on their args types in this Uplink's contract slice, see
        /// SitrepCommandAttribute.Delay.
        /// </summary>
        internal static List<CommandDeclaration> All() => new()
        {
            Command(KerbalismFileCommandProvider.SendCommand, ScienceExperimentsSubject),
            Command(KerbalismFileCommandProvider.DeleteCommand, ScienceExperimentsSubject),
            Command(KerbalismFileCommandProvider.AnalyzeCommand, ScienceExperimentsSubject),
            Command(KerbalismFileCommandProvider.DumpCommand, ScienceExperimentsSubject),
            Command(KerbalismFileCommandProvider.MoveToLabCommand, ScienceExperimentsSubject),
            // Acts on a part the parts listing named, on the same craft it reads.
            Command(RepairCommand, ReliabilityPartsTopic),
            // Act on a device the diagnostics listing named, on the same craft it reads.
            Command(KerbalismDeviceCommandProvider.DeviceSetCommand, DiagnosticsTopic),
            Command(KerbalismDeviceCommandProvider.ScriptSetCommand, DiagnosticsTopic),
        };

        private static CommandDeclaration Command(string command, string subject) => new()
        {
            Command = command,
            Subject = subject,
        };
    }
}
