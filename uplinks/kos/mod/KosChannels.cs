// GonogoKosUplink: GPLv3. See GonogoKosUplink.csproj's header comment for the
// licence/linkage rationale.

namespace Gonogo.KosUplink
{
    /// <summary>
    /// Pure (kOS/KSP-type-free) channel/command topic conventions for the
    /// kOS Uplink: the exact wire strings the client consumes,
    /// kept in one place so both the manifest wiring
    /// (<see cref="KosExtension"/>) and the headless tests reference the same
    /// constants.
    /// </summary>
    public static class KosChannels
    {
        /// <summary>Static channel: the list of live CPUs (was the telnet menu-scrape). Payload = <c>List&lt;KosProcessorInfo&gt;</c>.</summary>
        public const string ProcessorsTopic = "kos.processors";

        /// <summary>
        /// Dynamic namespace prefix for the interactive terminal screen
        /// downlink: <c>kos.terminal.&lt;coreId&gt;</c>
        /// (<c>Delivery.ReliableOrdered</c>, <c>DelayRole.Delayed</c>). Payload
        /// = <see cref="Sitrep.Contract.KosTerminalFrame"/>. Replaces the
        /// standalone telnet proxy's byte stream: the mod reads the CPU screen
        /// in-process and publishes xterm-ready diffs.
        /// </summary>
        public const string TerminalPrefix = "kos.terminal.";

        /// <summary>Command: acquire the single-owner write lease on a CPU terminal (<see cref="Sitrep.Contract.KosTerminalOpenArgs"/>).</summary>
        public const string TerminalOpenCommand = "kos.terminal.open";

        /// <summary>Command: type input into a leased CPU terminal (<see cref="Sitrep.Contract.KosKeystrokeArgs"/>).</summary>
        public const string KeystrokeCommand = "kos.keystroke";

        /// <summary>Command: resize a leased CPU terminal (<see cref="Sitrep.Contract.KosTerminalResizeArgs"/>).</summary>
        public const string TerminalResizeCommand = "kos.terminal.resize";

        /// <summary>Command: release the write lease on a CPU terminal (<see cref="Sitrep.Contract.KosTerminalCloseArgs"/>).</summary>
        public const string TerminalCloseCommand = "kos.terminal.close";

        /// <summary>The concrete downlink sub-topic (relative to <see cref="TerminalPrefix"/>) for one CPU: the <c>KOSCoreId</c> as a string.</summary>
        public static string TerminalSubTopic(int coreId) => coreId.ToString(System.Globalization.CultureInfo.InvariantCulture);

        /// <summary>The full downlink topic for one CPU: <c>kos.terminal.&lt;coreId&gt;</c>.</summary>
        public static string TerminalTopic(int coreId) => TerminalPrefix + TerminalSubTopic(coreId);

        /// <summary>
        /// The reverse of <see cref="TerminalTopic"/>: recovers the
        /// <c>coreId</c> from a concrete <c>kos.terminal.&lt;coreId&gt;</c>
        /// topic string. Used by the <see cref="TerminalPrefix"/> dynamic
        /// namespace's <c>IDynamicChannelSource.OnSubscribed</c> listener to
        /// translate the subscribed topic the engine hands back into the
        /// coreId <c>KosTerminalManager.NotifySubscribed</c> expects: see
        /// Gap A of the terminal-integrity adversarial review. Returns false for
        /// anything not under <see cref="TerminalPrefix"/> or whose
        /// sub-topic isn't a plain integer.
        /// </summary>
        public static bool TryParseTerminalCoreId(string topic, out int coreId)
        {
            coreId = 0;
            if (string.IsNullOrEmpty(topic) || !topic.StartsWith(TerminalPrefix, System.StringComparison.Ordinal))
            {
                return false;
            }
            var subTopic = topic.Substring(TerminalPrefix.Length);
            return int.TryParse(
                subTopic,
                System.Globalization.NumberStyles.Integer,
                System.Globalization.CultureInfo.InvariantCulture,
                out coreId);
        }

        /// <summary>
        /// Command: run the script at a path on a CPU, with arguments, and answer
        /// on <see cref="RunTopic"/> when it returns, fails or ends
        /// (<see cref="Sitrep.Contract.KosRunArgs"/>).
        /// </summary>
        public const string RunCommand = "kos.run";

        /// <summary>Command: abandon a <see cref="RunCommand"/> the caller stopped waiting for (<see cref="Sitrep.Contract.KosCancelArgs"/>).</summary>
        public const string CancelCommand = "kos.cancel";

        /// <summary>Command: list a CPU volume's files without typing into its terminal (<see cref="Sitrep.Contract.KosFilesListArgs"/>); the answer rides <see cref="RunPrefix"/>.</summary>
        public const string FilesListCommand = "kos.files.list";

        /// <summary>Command: read one file's text and content hash (<see cref="Sitrep.Contract.KosFilesReadArgs"/>); the answer rides <see cref="RunPrefix"/>.</summary>
        public const string FilesReadCommand = "kos.files.read";

        /// <summary>Command: save one file's text, compare-and-set on its hash (<see cref="Sitrep.Contract.KosFilesWriteArgs"/>); the answer rides <see cref="RunPrefix"/>.</summary>
        public const string FilesWriteCommand = "kos.files.write";

        /// <summary>Command: delete one file, compare-and-set on its hash (<see cref="Sitrep.Contract.KosFilesDeleteArgs"/>); the answer rides <see cref="RunPrefix"/>.</summary>
        public const string FilesDeleteCommand = "kos.files.delete";

        /// <summary>Command: rename one file within its volume, compare-and-set on its hash (<see cref="Sitrep.Contract.KosFilesRenameArgs"/>); the answer rides <see cref="RunPrefix"/>.</summary>
        public const string FilesRenameCommand = "kos.files.rename";

        /// <summary>
        /// Dynamic namespace prefix for the <c>kos.run</c> result channel:
        /// <c>kos.run.&lt;coreId&gt;</c> (<c>Delivery.ReliableOrdered</c>,
        /// <c>DelayRole.Delayed</c>). Payload = <see cref="Sitrep.Contract.KosRunResult"/>.
        /// </summary>
        public const string RunPrefix = "kos.run.";

        /// <summary>The concrete result sub-topic (relative to <see cref="RunPrefix"/>) for one CPU: the <c>KOSCoreId</c> as a string.</summary>
        public static string RunSubTopic(int coreId) => coreId.ToString(System.Globalization.CultureInfo.InvariantCulture);

        /// <summary>The full result topic for one CPU: <c>kos.run.&lt;coreId&gt;</c>.</summary>
        public static string RunTopic(int coreId) => RunPrefix + RunSubTopic(coreId);

        /// <summary>
        /// Dynamic namespace prefix for the log channel: <c>kos.log.&lt;coreId&gt;</c>
        /// (<c>Delivery.ReliableOrdered</c>, <c>DelayRole.Delayed</c>). Payload =
        /// <see cref="Sitrep.Contract.KosLogEntry"/>.
        /// </summary>
        public const string LogPrefix = "kos.log.";

        /// <summary>The full log topic for one CPU: <c>kos.log.&lt;coreId&gt;</c>.</summary>
        public static string LogTopic(int coreId) => LogPrefix + RunSubTopic(coreId);
    }
}
