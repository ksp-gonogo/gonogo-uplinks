using System.Collections.Generic;
using Gonogo.KerbalismUplink;
using Sitrep.Contract;

namespace GonogoKerbalismUplink.Tests
{
    /// <summary>
    /// Test double for <see cref="IKerbalismRunActuator"/>: keeps a switch per
    /// experiment and per lab and answers the way the live one does, reporting a
    /// change only when the press moved the switch.
    /// </summary>
    internal sealed class FakeKerbalismRunActuator : IKerbalismRunActuator
    {
        private readonly Dictionary<string, bool> _on = new();

        public readonly List<string> Calls = new();

        public void Set(string partId, string experimentId, bool on) => _on[partId + "/" + experimentId] = on;

        public bool IsOn(string partId, string experimentId) => _on.TryGetValue(partId + "/" + experimentId, out var on) && on;

        public CommandResult SetExperimentRunning(string partId, string experimentId, bool run)
        {
            Calls.Add((run ? "start " : "stop ") + partId + "/" + experimentId);
            return Switch(partId + "/" + experimentId, run);
        }

        public CommandResult SetLabRunning(string partId, bool run)
        {
            Calls.Add((run ? "start lab " : "stop lab ") + partId);
            return Switch(partId + "/lab", run);
        }

        private CommandResult Switch(string key, bool run)
        {
            var before = _on.TryGetValue(key, out var on) && on;
            _on[key] = run;
            return KerbalismRunAnswer.From(new RunSwitchRaw
            {
                Outcome = before == run ? RunSwitchOutcome.AlreadyThere : RunSwitchOutcome.Switched,
                Running = run,
            });
        }
    }
}
