using System;
using Sitrep.Contract;

namespace GonogoRp1Uplink
{
    /// <summary>
    /// Forbids a quicksave from mission control during an RP-1 simulated flight. A
    /// save that RP-1 does not manage reads as null, which forbids nothing.
    /// </summary>
    internal sealed class Rp1SaveGuard : ISaveGuard
    {
        private readonly Func<bool?> _isSimulatedFlight;

        public Rp1SaveGuard(Func<bool?> isSimulatedFlight)
        {
            _isSimulatedFlight = isSimulatedFlight;
        }

        public string ProviderId => "rp1";

        public bool ForbidsSaving => _isSimulatedFlight() == true;
    }
}
