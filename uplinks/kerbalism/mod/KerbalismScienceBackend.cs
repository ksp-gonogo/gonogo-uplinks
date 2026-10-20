using System.Collections.Generic;
using GonogoKerbalismUplink;
using Sitrep.Contract;

namespace Gonogo.KerbalismUplink
{
    /// <summary>
    /// Kerbalism's <see cref="IScienceBackend"/>: the provider that wins the
    /// <c>"science"</c> capability election when Kerbalism is installed, so the
    /// existing <c>science.*</c> topics carry Kerbalism's model instead of a stock
    /// walk that would report an empty vessel. Elected through
    /// <see cref="KerbalismProviders"/>, which hands reads to the stock backend
    /// until the reflection probe finds the mod.
    ///
    /// <para><b>Why it wins outright rather than augmenting.</b> Kerbalism does not
    /// add to stock science, it replaces it: results live on its own drives, not in
    /// <c>ModuleScienceExperiment</c>, so the stock backend genuinely has nothing to
    /// report on a Kerbalism vessel. Two parallel topics would have meant two
    /// widgets and two mental models permanently.</para>
    ///
    /// <para><b>Why this reads a stash rather than live Kerbalism.</b> The elected
    /// backend's read methods are called from a channel mapper, which runs on the
    /// engine's Courier thread, where touching a live KSP/Unity API is a crash or
    /// garbage-data risk. So the Uplink captures Kerbalism on the main thread
    /// through <c>AddSampledSource</c> (the seam that exists for exactly this) and
    /// hands the plain <see cref="ScienceRaw"/> bundle here via
    /// <see cref="Stash"/>; the mapping itself is pure and runs where it is asked
    /// to. Both the stash write (that source's handle-on-Courier half) and every
    /// read below are on the Courier thread, so there is no cross-thread hazard to
    /// guard: the hand-off across threads is the engine's, already done, in plain
    /// data.</para>
    ///
    /// <para>Before the first capture lands, and whenever Kerbalism is not
    /// modelling science, every read returns null: "nothing to say", which leaves
    /// the channel unborn and silent rather than publishing an empty list (see
    /// <see cref="IScienceBackend"/>).</para>
    /// </summary>
    public sealed class KerbalismScienceBackend : IScienceBackend, IScienceRunBackend
    {
        /// <summary>
        /// The latest main-thread capture. Written by the Uplink's handle-on-Courier
        /// half and read by the channel mappers on that thread, and by the command
        /// handlers on the main thread; a whole-reference swap, so a reader sees
        /// one capture or the next.
        /// </summary>
        private volatile ScienceRaw _latest = new ScienceRaw();

        private IKerbalismRunActuator? _runActuator;

        public string ProviderId => KerbalismScienceMap.ProviderId;

        /// <summary>Hand the tick's main-thread capture over. Called from the Courier thread.</summary>
        public void Stash(ScienceRaw raw) => _latest = raw;

        /// <summary>Supply the live module seam the start and stop commands act through.</summary>
        public void UseRunActuator(IKerbalismRunActuator actuator) => _runActuator = actuator;

        /// <summary>
        /// The latest capture, for the File Manager command handlers'
        /// KSP-free pre-filter (<see cref="KerbalismFileCommandProvider"/>).
        /// The same capture every read method below serves.
        ///
        /// <para>Refreshed every tick, because the capture that stashes it is
        /// registered ungated. The channel mappers above would be fine either way,
        /// since their topics are the ones a gate would key on. The command
        /// pre-filter would not: a caller that sends a file verb without having
        /// subscribed a science topic in this session would read the default
        /// bundle, whose <c>Modeled</c> is false, and every verb would refuse with
        /// ModeUnavailable, meaning "Kerbalism is not modelling science", about an
        /// install that is.</para>
        ///
        /// <para>That refusal was reachable. The shipped File Manager widget
        /// subscribes <c>science.experiments</c> and <c>science.lab</c> in the same
        /// component that sends the verbs, so it never saw it, but that is one
        /// client's construction rather than a guarantee: a command centre or an
        /// automation holding a subject id and no science subscription got the
        /// false refusal.</para>
        ///
        /// <para>The cost is real and is accepted here: the capture walks every
        /// drive and science module on the vessel, once per tick, whether or not
        /// anything is watching. Commands do read the live module at the moment
        /// they run, on the main thread, but resolving which module a command
        /// means from this capture keeps that step KSP-free and cheap.</para>
        /// </summary>
        public ScienceRaw Latest => _latest;

        public IReadOnlyList<ExperimentEntry>? Experiments(KspSnapshot? snapshot) => KerbalismScienceMap.Experiments(_latest);

        public IReadOnlyList<InstrumentEntry>? Instruments(KspSnapshot? snapshot) => KerbalismScienceMap.Instruments(_latest);

        public IReadOnlyList<SensorEntry>? Sensors(KspSnapshot? snapshot) => KerbalismScienceMap.Sensors(_latest);

        public IReadOnlyList<LabEntry>? Lab(KspSnapshot? snapshot) => KerbalismScienceMap.Lab(_latest);

        public IReadOnlyList<ExperimentBreakdownEntry>? ExperimentBreakdown(KspSnapshot? snapshot) => KerbalismScienceMap.ExperimentBreakdown(_latest);

        /// <summary>
        /// Kerbalism has no fire-once "run this experiment now": running is a
        /// continuous state its own state machine owns, started from the part's UI
        /// or by its automation, and gated on the requirements the
        /// <c>issue</c> field reports. There is no honest actuation for this command
        /// to perform, so it refuses with a typed
        /// <see cref="KerbalismErrorCodes.ContinuousScience"/> rather than reporting a
        /// success that changed nothing.
        ///
        /// <para>A start/stop command surface that fits both models is the right fix
        /// and belongs to the command-verb step, not here: adding it would change
        /// the shared command contract, which this pass deliberately does not
        /// touch.</para>
        /// </summary>
        public CommandResult DeployExperiment(ExperimentActionArgs args) =>
            CommandResult.Fail(KerbalismErrorCodes.ContinuousScience);

        /// <summary>
        /// Same as <see cref="DeployExperiment"/>: Kerbalism transmits continuously,
        /// draining files highest-value-first whenever the link and EC allow, so
        /// "transmit this now" has nothing to trigger. The live rate and the
        /// transmitting flag are on the entry's extension namespace, which is how a
        /// widget shows the operator what is happening instead of offering a button
        /// that does nothing.
        /// </summary>
        public CommandResult TransmitExperiment(ExperimentActionArgs args) =>
            CommandResult.Fail(KerbalismErrorCodes.ContinuousScience);

        /// <summary>
        /// Switch an experiment or SCANsat scanner on (<c>science.experiment.start</c>).
        /// Idempotent: an instrument already on answers with no change.
        /// </summary>
        public CommandResult StartExperiment(ExperimentActionArgs args) => SwitchExperiment(args, true);

        /// <summary>Switch an experiment or SCANsat scanner off (<c>science.experiment.stop</c>).</summary>
        public CommandResult StopExperiment(ExperimentActionArgs args) => SwitchExperiment(args, false);

        /// <summary>Switch the part's laboratory on (<c>science.lab.start</c>).</summary>
        public CommandResult StartLab(ExperimentActionArgs args) => SwitchLab(args, true);

        /// <summary>Switch the part's laboratory off (<c>science.lab.stop</c>).</summary>
        public CommandResult StopLab(ExperimentActionArgs args) => SwitchLab(args, false);

        private CommandResult SwitchExperiment(ExperimentActionArgs args, bool run)
        {
            if (string.IsNullOrEmpty(args.PartId)) return CommandResult.Fail(CommandErrorCode.NotFound);
            var capture = _latest;
            if (!capture.Modeled) return CommandResult.Fail(KerbalismErrorCodes.ScienceNotModelled);

            var experimentId = ResolveExperiment(capture, args.PartId, args.ExperimentId);
            if (experimentId == null) return CommandResult.Fail(CommandErrorCode.NotFound);

            var actuator = _runActuator;
            if (actuator == null) return CommandResult.Fail(KerbalismErrorCodes.ScienceNotModelled);
            return actuator.SetExperimentRunning(args.PartId, experimentId, run);
        }

        private CommandResult SwitchLab(ExperimentActionArgs args, bool run)
        {
            if (string.IsNullOrEmpty(args.PartId)) return CommandResult.Fail(CommandErrorCode.NotFound);
            var capture = _latest;
            if (!capture.Modeled) return CommandResult.Fail(KerbalismErrorCodes.ScienceNotModelled);

            var found = false;
            foreach (var lab in capture.Labs)
            {
                if (lab.PartId == args.PartId) { found = true; break; }
            }
            if (!found) return CommandResult.Fail(CommandErrorCode.NotFound);

            var actuator = _runActuator;
            if (actuator == null) return CommandResult.Fail(KerbalismErrorCodes.ScienceNotModelled);
            return actuator.SetLabRunning(args.PartId, run);
        }

        /// <summary>
        /// The id of the experiment or scanner a command means: the one named when
        /// the part carries it, the part's only one when none is named, and null
        /// when the part carries none or several and none is named.
        /// </summary>
        private static string? ResolveExperiment(ScienceRaw capture, string partId, string? experimentId)
        {
            string? only = null;
            var count = 0;
            foreach (var e in capture.Experiments)
            {
                if (e.PartId != partId) continue;
                if (!string.IsNullOrEmpty(experimentId) && e.ExperimentId == experimentId) return e.ExperimentId;
                only = e.ExperimentId;
                count++;
            }
            foreach (var s in capture.Scanners)
            {
                if (s.PartId != partId) continue;
                if (!string.IsNullOrEmpty(experimentId) && s.ExperimentId == experimentId) return s.ExperimentId;
                only = s.ExperimentId;
                count++;
            }
            return string.IsNullOrEmpty(experimentId) && count == 1 ? only : null;
        }
    }
}
