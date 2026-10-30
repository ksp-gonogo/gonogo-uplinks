using System;
using Sitrep.Contract;

namespace Gonogo.ContractConfiguratorUplink
{
    /// <summary>
    /// Reaches the objective delay line through the kernel, and binds this
    /// Uplink as the owner of the changes it holds once the line can be reached.
    /// Capabilities are resolved after every Uplink has registered, so the line
    /// is asked for on each tick until it answers, and by the hooks when they
    /// fire.
    /// </summary>
    internal sealed class ObjectiveLineAccess : ISnapshotSampler
    {
        private readonly Kernel _kernel;
        private readonly Func<ObjectiveChange, Action?> _resolve;
        private IObjectiveDelayLine? _line;

        public ObjectiveLineAccess(Kernel kernel, Func<ObjectiveChange, Action?> resolve)
        {
            _kernel = kernel ?? throw new ArgumentNullException(nameof(kernel));
            _resolve = resolve ?? throw new ArgumentNullException(nameof(resolve));
        }

        /// <summary>How many ticks have passed, so a line still missing after one can be called missing.</summary>
        public int Ticks { get; private set; }

        /// <summary>The line, or null when the capability does not resolve (no game loaded, an older Gonogo).</summary>
        public IObjectiveDelayLine? Line
        {
            get
            {
                if (_line != null)
                {
                    return _line;
                }
                try
                {
                    var line = _kernel.Query<IObjectiveDelayLine>(ObjectiveDelayCapability.CapabilityId);
                    if (line == null)
                    {
                        return null;
                    }
                    line.Rebind(ObjectiveDelayCapability.ContractConfiguratorOwner, _resolve);
                    _line = line;
                    return line;
                }
                catch (Exception)
                {
                    return null;
                }
            }
        }

        public bool Missing => Ticks > 0 && _line == null;

        public void Sample(KspSnapshot snapshot)
        {
            Ticks++;
            _ = Line;
        }
    }
}
